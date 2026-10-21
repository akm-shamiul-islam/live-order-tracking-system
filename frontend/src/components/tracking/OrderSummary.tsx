import { formatDateTime } from '../../lib/dateTime';
import type { OrderDetails } from '@kitchentodoor/shared';
import { ReceiptText } from 'lucide-react';

export function OrderSummary({ order }: { order: OrderDetails }) {
  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-6" aria-labelledby="order-summary-title">
      <h2
        id="order-summary-title"
        className="font-display flex items-center gap-2 text-lg font-bold"
      >
        <ReceiptText aria-hidden="true" className="h-5 w-5 text-teal-700 dark:text-teal-300" />
        Order Details
      </h2>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <ul className="space-y-3">
            {order.items.map((item, index) => (
              <li
                key={`${item.itemId}-${index}`}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <span className="text-slate-700 dark:text-slate-200">
                  {item.quantity} × {item.name}
                </span>
                <span className="font-mono font-semibold">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
            {(
              [
                ['Subtotal', order.pricing.subtotal],
                ['Delivery', order.pricing.deliveryFee],
                ['Tax', order.pricing.tax],
                ['Total', order.pricing.total],
              ] as const
            ).map(([label, amount]) => (
              <div
                key={label}
                className={`flex justify-between gap-4 ${label === 'Total' ? 'text-base font-extrabold' : 'text-slate-600 dark:text-slate-300'}`}
              >
                <dt>{label}</dt>
                <dd className="font-mono">${amount.toFixed(2)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-3 text-sm">
          <h3 className="font-bold">Delivery to {order.customer.name}</h3>
          <p className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">
            {order.customer.address}
          </p>
          <p className="text-slate-600 dark:text-slate-300">Phone: {order.customer.phone}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Placed <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
          </p>
          {order.estimatedDeliveryAt && !['CANCELLED', 'DELIVERED'].includes(order.status) && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Estimated delivery: {formatDateTime(order.estimatedDeliveryAt, 'time')}. Timing may
              change as the kitchen prepares your order.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
