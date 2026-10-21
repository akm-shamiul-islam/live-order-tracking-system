import { formatDateTime } from '../../lib/dateTime';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OrderStatus, type OrderDetails } from '@kitchentodoor/shared';
import { Bike, Check, X, Save } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { ThemedSelect } from '../forms/ThemedSelect';
import { OrderStatusControl } from './OrderStatusControl';
import { Spinner } from '../layout/Loading';

export function DeliveryAssignment({ order }: { order: OrderDetails }) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<{
    value: string;
    original: string | null | undefined;
  }>();
  const selected =
    selection && selection.original === order.courierId ? selection.value : order.courierId || '';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const couriers = useQuery({
    queryKey: ['couriers'],
    queryFn: () => api.orders.getCouriers(),
    enabled: isAdmin,
  });
  const assignedToMe = order.courierId === user?.id;
  const canAssign =
    isAdmin &&
    ![OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED].some(
      (status) => status === order.status,
    );
  const requests = (order.deliveryRequests ?? []).filter((request) => request.status === 'PENDING');
  async function act(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['available-deliveries'] }),
        queryClient.invalidateQueries({ queryKey: ['my-orders'] }),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this delivery.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="glass-panel space-y-4 rounded-2xl p-5"
      aria-labelledby="delivery-assignment-title"
    >
      <h2 id="delivery-assignment-title" className="font-display flex items-center gap-2 font-bold">
        <Bike aria-hidden="true" className="h-5 w-5 text-teal-500" />
        Delivery assignment
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {assignedToMe
          ? 'This delivery is assigned to you.'
          : order.courierId
            ? 'A courier is assigned to this order.'
            : 'Assign a courier before starting delivery.'}
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {isAdmin && couriers.error && (
        <p role="alert" className="text-sm text-rose-600">
          {couriers.error.message}
        </p>
      )}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {canAssign && (
          <>
            <ThemedSelect
              label="Assigned courier"
              value={selected}
              disabled={pending || couriers.isLoading}
              options={[
                { value: '', label: 'Unassigned' },
                ...(couriers.data ?? []).map((courier) => ({
                  value: courier.id,
                  label: courier.name,
                })),
              ]}
              onChange={(value) => setSelection({ value, original: order.courierId })}
            />
            <button
              type="button"
              disabled={pending || couriers.isLoading}
              onClick={() => void act(() => api.orders.assignCourier(order.id, selected || null))}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {pending ? <Spinner /> : <Save aria-hidden="true" className="h-4 w-4" />}
              Save assignment
            </button>
          </>
        )}
      </div>
      {isAdmin && requests.length > 0 && !order.courierId && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <h3 className="text-sm font-bold">Delivery Requests ({requests.length})</h3>
          {requests.map((request) => (
            <div
              key={request.courierId}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700"
            >
              <div>
                <p className="text-sm font-bold">{request.courierName}</p>
                <time
                  dateTime={request.requestedAt}
                  className="text-xs text-slate-600 dark:text-slate-300"
                >
                  {formatDateTime(request.requestedAt)}
                </time>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    void act(() =>
                      api.orders.reviewDelivery(order.id, request.courierId, 'APPROVE'),
                    )
                  }
                  aria-label={`Approve ${request.courierName}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-3 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {pending ? <Spinner /> : <Check aria-hidden="true" className="h-4 w-4" />}Approve
                </button>
                <button
                  disabled={pending}
                  onClick={() =>
                    void act(() => api.orders.reviewDelivery(order.id, request.courierId, 'REJECT'))
                  }
                  aria-label={`Decline ${request.courierName}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 px-3 text-xs font-bold text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <OrderStatusControl order={order} />
    </section>
  );
}
