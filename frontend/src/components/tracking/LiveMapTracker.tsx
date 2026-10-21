import { useCopy } from '../../lib/i18n';
import { formatDateTime } from '../../lib/dateTime';
import { lazy, Suspense } from 'react';
import { OrderDetails } from '@kitchentodoor/shared';
import { Home, Store, Compass, Navigation } from 'lucide-react';
import { CourierMarker, MARKER_CLASS } from './CourierMarker';
const AnimatedCourierBeacon = lazy(() => import('./AnimatedCourierBeacon'));

interface LiveMapTrackerProps {
  order: OrderDetails;
}

export function LiveMapTracker({ order }: LiveMapTrackerProps) {
  const c = useCopy();

  const hasLocation = order.courierCoordinates?.lat != null && order.courierCoordinates.lng != null;
  if (!order.deliveryLocationProvided || !hasLocation)
    return (
      <section
        className="glass-panel space-y-3 rounded-2xl p-6"
        aria-label={c('Delivery location')}
      >
        <h2 className="font-display flex items-center gap-2 font-bold">
          <Navigation aria-hidden="true" className="h-5 w-5 text-teal-700 dark:text-teal-300" />
          {c('Delivery Location')}{' '}
        </h2>
        <p className="break-words text-sm text-slate-700 dark:text-slate-200">
          {order.customer.address}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {hasLocation
            ? c(
                'Courier GPS: {{lat}}, {{lng}}. The delivery address has no customer-provided map pin.',
                {
                  lat: order.courierCoordinates!.lat!.toFixed(5),
                  lng: order.courierCoordinates!.lng!.toFixed(5),
                },
              )
            : c(
                'Waiting for the assigned courier to share their location after starting delivery.',
              )}
        </p>
      </section>
    );
  const deliveryLat = order.deliveryCoordinates?.lat ?? 40.7128;
  const deliveryLng = order.deliveryCoordinates?.lng ?? -74.006;

  // If courier coordinates are present, use them; otherwise default relative to delivery
  const courierLat = order.courierCoordinates?.lat ?? deliveryLat - 0.015;
  const courierLng = order.courierCoordinates?.lng ?? deliveryLng - 0.018;

  // Approximate relative percentage on a normalized 2D grid for visual presentation
  const kitchenX = 18;
  const kitchenY = 80;

  const destX = 82;
  const destY = 22;

  // Interpolate courier percentage between kitchen and destination based on coordinates
  const latDelta = Math.abs(deliveryLat - courierLat);
  const lngDelta = Math.abs(deliveryLng - courierLng);
  const distanceRatio = Math.min(1, Math.max(0, 1 - (latDelta + lngDelta) * 20));

  const courierX =
    kitchenX +
    (destX - kitchenX) * (order.status === 'DELIVERED' ? 1 : Math.max(0.15, distanceRatio));
  const courierY =
    kitchenY +
    (destY - kitchenY) * (order.status === 'DELIVERED' ? 1 : Math.max(0.15, distanceRatio));

  return (
    <div className="glass-panel p-6 rounded-2xl overflow-hidden relative">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-teal-500 animate-pulse" />
          <h2 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
            {c('Live Delivery Progress')}{' '}
          </h2>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-teal-500" />
            <span>
              {c('GPS:')} {courierLat.toFixed(4)}, {courierLng.toFixed(4)}
            </span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 font-bold border border-teal-500/20">
            {c('Live Telemetry')}{' '}
          </span>
        </div>
      </div>

      <p className="mb-4 text-xs text-slate-600 dark:text-slate-300">
        {c('Illustrated progress from GPS updates. Use the delivery address for navigation.')}{' '}
      </p>

      {/* Radar Map Canvas Container */}
      <div className="relative w-full h-80 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
        {/* Radar concentric range rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[120px] h-[120px] rounded-full border border-teal-500/20" />
          <div className="w-[220px] h-[220px] rounded-full border border-teal-500/20" />
          <div className="w-[320px] h-[320px] rounded-full border border-teal-500/20" />
          {/* Radar sweeping scanline */}
          <div className="absolute w-[320px] h-[320px] rounded-full pointer-events-none animate-radar-sweep origin-center overflow-hidden">
            <div className="w-1/2 h-1/2 bg-gradient-to-br from-teal-400/25 to-transparent" />
          </div>
        </div>

        {/* Grid crosshairs */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-full h-px bg-teal-400" />
          <div className="h-full w-px bg-teal-400" />
        </div>

        {/* Path Connection Line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <line
            x1={`${kitchenX}%`}
            y1={`${kitchenY}%`}
            x2={`${destX}%`}
            y2={`${destY}%`}
            stroke="rgba(20, 184, 166, 0.55)"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
        </svg>

        {/* Origin: Restaurant Kitchen */}
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
          style={{ left: `${kitchenX}%`, top: `${kitchenY}%` }}
        >
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/40 border border-sky-400">
            <Store className="w-5 h-5" />
          </div>
          <div className="mt-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-sky-300 border border-sky-500/30 font-bold text-[10px] whitespace-nowrap shadow-sm">
            {c('Kitchen (Origin)')}{' '}
          </div>
        </div>

        {/* Destination: Customer Doorstep */}
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
          style={{ left: `${destX}%`, top: `${destY}%` }}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 border border-emerald-400">
            <Home className="w-5 h-5" />
          </div>
          <div className="mt-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] whitespace-nowrap shadow-sm">
            {c('Customer Doorstep')}{' '}
          </div>
        </div>

        {/* Courier Beacon */}
        <Suspense
          fallback={
            <div className={MARKER_CLASS} style={{ left: `${courierX}%`, top: `${courierY}%` }}>
              <CourierMarker />
            </div>
          }
        >
          <AnimatedCourierBeacon x={courierX} y={courierY} />
        </Suspense>
      </div>

      {/* Telemetry Status Bar */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50">
          <span className="text-slate-400 font-medium block mb-0.5">
            {c('Delivery Destination')}
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
            {order.customer.address}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50">
          <span className="text-slate-400 font-medium block mb-0.5">{c('Estimated Arrival')}</span>
          <span className="font-semibold text-teal-700 dark:text-teal-400 font-mono block">
            {order.status === 'DELIVERED'
              ? c('Delivered')
              : order.estimatedDeliveryAt
                ? formatDateTime(order.estimatedDeliveryAt, 'time')
                : c('25-35 mins')}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50">
          <span className="text-slate-400 font-medium block mb-0.5">{c('Telemetry Status')}</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">
            {order.status === 'OUT_FOR_DELIVERY' ? c('Active In-Transit') : c(order.status)}
          </span>
        </div>
      </div>
    </div>
  );
}
