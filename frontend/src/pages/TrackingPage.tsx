import { lazy, Suspense } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { OrderIdentifierSchema, OrderLookupSchema, OrderStatus } from '@kitchentodoor/shared';
import { Search, Navigation, AlertCircle } from 'lucide-react';
import { useOrderSocket } from '../hooks/useOrderSocket';
import { useAuth } from '../hooks/useAuth';
import { useZodForm } from '../hooks/useZodForm';
import { FieldError } from '../components/forms/FieldError';
import { ApiError } from '../lib/api';

const OrderTimeline = lazy(() =>
  import('../components/tracking/OrderTimeline').then((m) => ({ default: m.OrderTimeline })),
);
const LiveMapTracker = lazy(() =>
  import('../components/tracking/LiveMapTracker').then((m) => ({ default: m.LiveMapTracker })),
);
const CourierSimulator = lazy(() =>
  import('../components/tracking/CourierSimulator').then((m) => ({ default: m.CourierSimulator })),
);

export function TrackingPage() {
  const { orderId = '' } = useParams({ strict: false });
  return <OrderTrackingPage key={orderId} orderId={orderId} view="tracking" />;
}

export function CourierPage() {
  const { orderId = '' } = useParams({ strict: false });
  return <OrderTrackingPage key={orderId} orderId={orderId} view="courier" />;
}

function OrderTrackingPage({ orderId, view }: { orderId: string; view: 'tracking' | 'courier' }) {
  const { isAdmin, isCourier } = useAuth();
  const canDispatch = isAdmin || isCourier;
  const navigate = useNavigate();
  const form = useZodForm(OrderLookupSchema, { orderId }, 'tracking');
  const identifier = OrderIdentifierSchema.safeParse(orderId);
  const {
    data: order,
    isLoading,
    error,
    refetch,
  } = useOrderSocket(identifier.success ? identifier.data : undefined);
  const deliveryFinished =
    order?.status === OrderStatus.DELIVERED || order?.status === OrderStatus.CANCELLED;
  const fieldMessage =
    form.errors.orderId ||
    (form.values.orderId === orderId && orderId
      ? !identifier.success
        ? identifier.error.issues[0]?.message
        : error instanceof ApiError && error.status === 404
          ? 'No order was found. Check the order number and try again.'
          : undefined
      : undefined);

  return (
    <div className="space-y-8">
      <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-xl font-extrabold">
            {view === 'courier' ? 'Courier Delivery Station' : 'Live Order Telemetry'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {order
              ? `Currently tracking: ${order.orderNumber}`
              : 'Enter your order number or tracking ID.'}
          </p>
          {order && canDispatch && (
            <Link
              to={view === 'courier' ? '/tracking/$orderId' : '/courier/$orderId'}
              params={{ orderId: order.id }}
              className="mt-2 inline-block text-xs font-bold text-teal-600 underline dark:text-teal-400"
            >
              {view === 'courier' ? 'Open Live Tracking' : 'Open Courier Controls'}
            </Link>
          )}
        </div>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const values = form.validate(event.currentTarget);
            if (values)
              void navigate({
                to: view === 'courier' ? '/courier/$orderId' : '/tracking/$orderId',
                params: { orderId: values.orderId },
              });
          }}
          className="flex w-full items-start gap-2 lg:w-auto"
        >
          <div className="min-w-0 flex-1 lg:w-72">
            <label htmlFor="tracking-orderId" className="sr-only">
              Order number or tracking ID
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 h-10 w-10 p-3 text-slate-400"
              />
              <input
                {...form.field('orderId')}
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={fieldMessage ? true : undefined}
                aria-describedby={fieldMessage ? 'tracking-orderId-error' : undefined}
                placeholder="Order number (e.g. KTD-1234)…"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-xs text-slate-900 shadow-xs placeholder-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
              />
            </div>
            <FieldError id="tracking-orderId-error" message={fieldMessage} />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 text-xs font-bold text-white shadow-sm hover:from-emerald-600 hover:to-teal-700"
          >
            <Navigation aria-hidden="true" className="h-4 w-4" />
            <span>Track</span>
          </button>
        </form>
      </div>

      {isLoading ? (
        <div role="status" className="glass-panel rounded-3xl p-16 text-center">
          <h2 className="font-display text-lg font-bold">Loading Your Order…</h2>
          <p className="mt-1 text-xs text-slate-500">Connecting to live order updates.</p>
        </div>
      ) : error ? (
        <div role="alert" className="glass-panel rounded-3xl border-rose-500/30 p-12 text-center">
          <AlertCircle aria-hidden="true" className="mx-auto mb-3 h-12 w-12 text-rose-500" />
          <h2 className="font-display text-lg font-bold">
            {error instanceof ApiError && error.status === 404
              ? 'Order Not Found'
              : 'Unable to Load Order'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {error.message}
          </p>
          <button
            onClick={() => void refetch()}
            className="mt-3 font-bold text-teal-600 underline dark:text-teal-400"
          >
            Try Again
          </button>
        </div>
      ) : order ? (
        <Suspense
          fallback={
            <p role="status" className="p-8 text-center">
              Loading Tracking…
            </p>
          }
        >
          <div className="space-y-8">
            {view === 'tracking' && <OrderTimeline order={order} />}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className={canDispatch ? 'lg:col-span-2' : 'lg:col-span-3'}>
                <LiveMapTracker order={order} />
              </div>
              {canDispatch && !deliveryFinished && (
                <CourierSimulator
                  key={order.id}
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  destLat={order.deliveryCoordinates.lat}
                  destLng={order.deliveryCoordinates.lng}
                />
              )}
              {canDispatch && deliveryFinished && (
                <p
                  role="status"
                  className="glass-panel rounded-2xl p-6 text-sm text-slate-500 dark:text-slate-400"
                >
                  This order is {order.status.toLowerCase()}. Courier simulation has stopped.
                </p>
              )}
            </div>
          </div>
        </Suspense>
      ) : (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <Navigation aria-hidden="true" className="mx-auto mb-3 h-12 w-12 text-teal-500" />
          <h2 className="font-display text-lg font-bold">
            {orderId ? 'Check Your Order Number' : 'No Order Selected'}
          </h2>
          <p className="mx-auto mt-1 mb-6 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Search above or select an order from{' '}
            {view === 'courier' ? 'the dispatch station' : 'your order history'}.
          </p>
          <Link
            to={view === 'courier' ? '/dispatch' : '/'}
            className="inline-flex rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
          >
            {view === 'courier' ? 'Open Dispatch Station' : 'Explore Food Menu'}
          </Link>
        </div>
      )}
    </div>
  );
}
