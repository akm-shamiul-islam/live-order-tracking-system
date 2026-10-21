import { useCopy } from '../../lib/i18n';
import { formatDateTime } from '../../lib/dateTime';
import type { OrderDetails } from '@kitchentodoor/shared';
import { ReceiptText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ReceiptDownloadButton } from '../customer/ReceiptDownloadButton';

export function OrderSummary({ order }: { order: OrderDetails }) {
  const c = useCopy();
  const { isCourier } = useAuth();

  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-6" aria-labelledby="order-summary-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          id="order-summary-title"
          className="font-display flex items-center gap-2 text-lg font-bold"
        >
          <ReceiptText aria-hidden="true" className="h-5 w-5 text-teal-700 dark:text-teal-300" />
          {c('Order Details')}{' '}
        </h2>
        {!isCourier && (
          <ReceiptDownloadButton
            orderId={order.id}
            orderNumber={order.orderNumber}
            variant="button"
          />
        )}
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <ul className="space-y-3">
            {order.items.map((item, index) => (
              <li
                key={`${item.itemId}-${index}`}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <span className="text-slate-700 dark:text-slate-200">
                  {item.quantity} × {c(item.name)}
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
                <dt>{c(label)}</dt>
                <dd className="font-mono">${amount.toFixed(2)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-3 text-sm">
          <h3 className="font-bold">
            {c('Delivery to')} {order.customer.name}
          </h3>
          <p className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">
            {order.customer.address}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            {c('Phone:')} {order.customer.phone}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {c('Placed')} <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
          </p>
          {order.estimatedDeliveryAt && !['CANCELLED', 'DELIVERED'].includes(order.status) && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {c('Estimated delivery:')} {formatDateTime(order.estimatedDeliveryAt, 'time')}
              {c('. Timing may change as the kitchen prepares your order.')}{' '}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
