import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CancellationReasonSchema,
  OrderStatus,
  OrderStatusChangeSchema,
  isValidStatusTransition,
  type OrderDetails,
} from '@kitchentodoor/shared';
import { z } from '@kitchentodoor/shared/zod';
import { CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../hooks/useDialog';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { ThemedSelect } from '../forms/ThemedSelect';
import { Spinner } from '../layout/Loading';

const reasonSchema = z.object({ reason: CancellationReasonSchema });

function CancellationModal({
  order,
  onClose,
  onSaved,
}: {
  order: OrderDetails;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const dialog = useDialog(true);
  const form = useZodForm(reasonSchema, { reason: '' }, 'cancel-order');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <dialog
      ref={dialog}
      aria-labelledby="cancellation-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <form
        noValidate
        aria-busy={pending}
        className="space-y-5 p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const element = event.currentTarget;
          const values = form.validate(element);
          if (!values) return;
          setPending(true);
          setError(undefined);
          try {
            await api.orders.updateStatus(order.id, OrderStatus.CANCELLED, values.reason);
            await onSaved();
            onClose();
          } catch (cause) {
            if (cause instanceof ApiError)
              form.setServerErrors(
                { reason: cause.fieldErrors.note || cause.fieldErrors.reason || '' },
                element,
              );
            setError(cause instanceof Error ? cause.message : 'Unable to cancel this order.');
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <AlertTriangle
              aria-hidden="true"
              className="mb-3 h-7 w-7 text-rose-700 dark:text-rose-300"
            />
            <h2 id="cancellation-title" className="font-display text-xl font-bold">
              Cancel {order.orderNumber}?
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close cancellation dialog"
            disabled={pending}
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The customer will see this reason in their order history. Cancellation is final.
        </p>
        {error && (
          <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <label htmlFor="cancel-order-reason" className="block text-sm font-bold">
            Reason for cancellation{' '}
            <span className="text-rose-700 dark:text-rose-300">(required)</span>
          </label>
          <textarea
            {...form.field('reason')}
            rows={4}
            maxLength={500}
            disabled={pending}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-950"
            placeholder="Explain why this order needs to be cancelled…"
          />
          <FieldError id="cancel-order-reason-error" message={form.errors.reason} />
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold dark:border-slate-600"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            Keep Order
          </button>
          <button
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60"
          >
            {pending ? <Spinner /> : <X aria-hidden="true" className="h-4 w-4" />}
            {pending ? 'Cancelling…' : 'Cancel Order'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function OrderStatusControl({ order }: { order: OrderDetails }) {
  const { user, isAdmin, isCourier } = useAuth();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<{ value: OrderStatus; original: OrderStatus }>();
  const selected = selection?.original === order.status ? selection.value : order.status;
  const [pending, setPending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState<string>();
  const allowed = Object.values(OrderStatus).filter((status) =>
    isValidStatusTransition(order.status, status),
  );
  if (!(isAdmin || (isCourier && user?.id === order.courierId)) || !allowed.length) return null;
  const refresh = async () => {
    await Promise.all(
      ['order', 'admin-orders', 'my-orders', 'available-deliveries'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
  return (
    <section
      className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700"
      aria-label="Update order status"
    >
      <h3 className="text-sm font-bold">Update Status</h3>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Move through each stage in order. Cancellation requires an explanation.
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <ThemedSelect
          label="Order status"
          value={selected}
          options={[order.status, ...allowed].map((status) => ({
            value: status,
            label: status.replaceAll('_', ' '),
          }))}
          disabled={pending}
          onChange={(value) => {
            const parsed = OrderStatusChangeSchema.shape.status.safeParse(value);
            if (parsed.success) setSelection({ value: parsed.data, original: order.status });
          }}
        />
        <button
          disabled={
            pending ||
            selected === order.status ||
            (selected === OrderStatus.OUT_FOR_DELIVERY && !order.courierId)
          }
          onClick={async () => {
            if (selected === OrderStatus.CANCELLED) {
              setCancelOpen(true);
              return;
            }
            setPending(true);
            setError(undefined);
            try {
              await api.orders.updateStatus(order.id, selected);
              await refresh();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to update this order.');
            } finally {
              setPending(false);
            }
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {pending ? <Spinner /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
          {pending ? 'Updating…' : 'Update Status'}
        </button>
      </div>
      {selected === OrderStatus.OUT_FOR_DELIVERY && !order.courierId && (
        <p className="text-sm text-amber-900 dark:text-amber-200">
          Assign a courier before starting delivery.
        </p>
      )}
      {cancelOpen && (
        <CancellationModal order={order} onClose={() => setCancelOpen(false)} onSaved={refresh} />
      )}
    </section>
  );
}
