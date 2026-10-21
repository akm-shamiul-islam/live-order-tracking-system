import { useCopy } from '../lib/i18n';
import { lazy, Suspense } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { OrderIdentifierSchema, OrderLookupSchema, OrderStatus } from '@kitchentodoor/shared';
import { Search, Navigation, AlertCircle, RefreshCw } from 'lucide-react';
import { useOrderSocket } from '../hooks/useOrderSocket';
import { useAuth } from '../hooks/useAuth';
import { useZodForm } from '../hooks/useZodForm';
import { FieldError } from '../components/forms/FieldError';
import { ApiError } from '../lib/api';
import { PageSkeleton, LoadingState } from '../components/layout/Loading';
import { OrderTimeline } from '../components/tracking/OrderTimeline';
import { LiveMapTracker } from '../components/tracking/LiveMapTracker';
import { OrderSummary } from '../components/tracking/OrderSummary';
import { clientSettings } from '../lib/clientSettings';

const CourierSimulator = lazy(() =>
  import('../components/tracking/CourierSimulator').then((m) => ({ default: m.CourierSimulator })),
);
const DeliveryAssignment = lazy(() =>
  import('../components/tracking/DeliveryAssignment').then((module) => ({
    default: module.DeliveryAssignment,
  })),
);
const CourierLocationSharing = lazy(() =>
  import('../components/tracking/CourierLocationSharing').then((module) => ({
    default: module.CourierLocationSharing,
  })),
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
  const c = useCopy();

  const { user, isAdmin, isCourier } = useAuth();
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
            {view === 'courier' ? c('Courier Delivery Station') : c('Live Order Telemetry')}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {order
              ? c('Currently tracking: {{number}}', { number: order.orderNumber })
              : c('Enter your order number or tracking ID.')}
          </p>
          {order && canDispatch && (
            <Link
              to={view === 'courier' ? '/tracking/$orderId' : '/courier/$orderId'}
              params={{ orderId: order.id }}
              className="mt-2 inline-block text-xs font-bold text-teal-700 underline dark:text-teal-400"
            >
              {view === 'courier' ? c('Open Live Tracking') : c('Open Courier Controls')}
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
              {c('Order number or tracking ID')}{' '}
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
                placeholder={c('Private tracking ID or staff order number…')}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-xs text-slate-900 shadow-xs placeholder-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
              />
            </div>
            <FieldError id="tracking-orderId-error" message={fieldMessage} />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 text-xs font-bold text-white shadow-sm hover:from-emerald-800 hover:to-teal-800"
          >
            <Navigation aria-hidden="true" className="h-4 w-4" />
            <span>{c('Track')}</span>
          </button>
        </form>
      </div>

      {isLoading ? (
        <PageSkeleton label={c('Loading your order…')} />
      ) : error ? (
        <div role="alert" className="glass-panel rounded-3xl border-rose-500/30 p-12 text-center">
          <AlertCircle aria-hidden="true" className="mx-auto mb-3 h-12 w-12 text-rose-500" />
          <h2 className="font-display text-lg font-bold">
            {error instanceof ApiError && error.status === 404
              ? c('Order Not Found')
              : c('Unable to Load Order')}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {c(error.message)}
          </p>
          <button
            onClick={() => void refetch()}
            className="mt-3 inline-flex items-center gap-2 font-bold text-teal-700 underline dark:text-teal-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {c('Try Again')}{' '}
          </button>
        </div>
      ) : order ? (
        <Suspense fallback={<PageSkeleton label={c('Loading tracking…')} />}>
          <div className="space-y-8">
            <OrderSummary order={order} />
            {view === 'tracking' && <OrderTimeline order={order} />}
            {canDispatch && !deliveryFinished && (
              <Suspense fallback={<LoadingState label={c('Loading delivery controls…')} />}>
                <DeliveryAssignment order={order} />
              </Suspense>
            )}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div
                className={
                  isCourier || (isAdmin && clientSettings.VITE_ENABLE_COURIER_SIMULATOR)
                    ? 'lg:col-span-2'
                    : 'lg:col-span-3'
                }
              >
                <LiveMapTracker order={order} />
              </div>
              {isAdmin && clientSettings.VITE_ENABLE_COURIER_SIMULATOR && !deliveryFinished && (
                <CourierSimulator
                  key={order.id}
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  destLat={order.deliveryCoordinates.lat}
                  destLng={order.deliveryCoordinates.lng}
                  initialLat={order.deliveryCoordinates.lat - 0.015}
                  initialLng={order.deliveryCoordinates.lng - 0.018}
                />
              )}
              {isCourier &&
                order.courierId === user?.id &&
                order.status === OrderStatus.OUT_FOR_DELIVERY && (
                  <Suspense fallback={<LoadingState label={c('Loading location controls…')} />}>
                    <CourierLocationSharing key={order.id} orderId={order.id} />
                  </Suspense>
                )}
              {canDispatch && deliveryFinished && (
                <p
                  role="status"
                  className="glass-panel rounded-2xl p-6 text-sm text-slate-500 dark:text-slate-400"
                >
                  {c('This order is')} {order.status.toLowerCase()}
                  {c('. Location sharing has stopped.')}{' '}
                </p>
              )}
            </div>
          </div>
        </Suspense>
      ) : (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <Navigation aria-hidden="true" className="mx-auto mb-3 h-12 w-12 text-teal-500" />
          <h2 className="font-display text-lg font-bold">
            {orderId ? c('Check Your Order Number') : c('No Order Selected')}
          </h2>
          <p className="mx-auto mt-1 mb-6 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {c('Search above or select an order from')}{' '}
            {view === 'courier' ? c('the dispatch station') : c('your order history')}.
          </p>
          <Link
            to={view === 'courier' ? '/orders' : '/'}
            className="inline-flex rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
          >
            {view === 'courier' ? c('My Deliveries') : c('Explore Food Menu')}
          </Link>
        </div>
      )}
    </div>
  );
}
