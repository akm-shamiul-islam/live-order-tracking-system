import { useCopy } from '../../lib/i18n';
import { IconAction } from '../ui/IconAction';
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
  const c = useCopy();

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
        {c('Delivery assignment')}{' '}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {assignedToMe
          ? c('This delivery is assigned to you.')
          : order.courierId
            ? c('A courier is assigned to this order.')
            : c('Assign a courier before starting delivery.')}
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {c(error)}
        </p>
      )}
      {isAdmin && couriers.error && (
        <p role="alert" className="text-sm text-rose-600">
          {c(couriers.error.message)}
        </p>
      )}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {canAssign && (
          <>
            <ThemedSelect
              label={c('Assigned courier')}
              value={selected}
              disabled={pending || couriers.isLoading}
              options={[
                { value: '', label: 'Unassigned' },
                ...(couriers.data ?? []).map((courier) => ({
                  value: courier.id,
                  label: courier.name,
                  translate: false,
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
              {c('Save assignment')}{' '}
            </button>
          </>
        )}
      </div>
      {isAdmin && requests.length > 0 && !order.courierId && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <h3 className="text-sm font-bold">
            {c('Delivery Requests ({{count}})', { count: requests.length })}
          </h3>
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
                <IconAction
                  icon={Check}
                  tone="primary"
                  label={c('Approve')}
                  aria-label={c('Approve {{name}}', { name: request.courierName })}
                  disabled={pending}
                  pending={pending}
                  onClick={() =>
                    void act(() =>
                      api.orders.reviewDelivery(order.id, request.courierId, 'APPROVE'),
                    )
                  }
                />
                <IconAction
                  icon={X}
                  tone="danger"
                  label={c('Decline')}
                  aria-label={c('Decline {{name}}', { name: request.courierName })}
                  disabled={pending}
                  onClick={() =>
                    void act(() => api.orders.reviewDelivery(order.id, request.courierId, 'REJECT'))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <OrderStatusControl order={order} />
    </section>
  );
}
