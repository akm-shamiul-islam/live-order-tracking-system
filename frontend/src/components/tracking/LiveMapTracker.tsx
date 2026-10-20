import { motion, useReducedMotion } from 'motion/react';
import { OrderDetails } from '@kitchentodoor/shared';
import { Bike, Home, Store, Compass, Navigation } from 'lucide-react';

interface LiveMapTrackerProps {
  order: OrderDetails;
}

export function LiveMapTracker({ order }: LiveMapTrackerProps) {
  const shouldReduceMotion = useReducedMotion();
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
          <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
            Real-Time Courier Telemetry Radar
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-teal-500" />
            <span>
              GPS: {courierLat.toFixed(4)}, {courierLng.toFixed(4)}
            </span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 font-bold border border-teal-500/20">
            Live Telemetry
          </span>
        </div>
      </div>

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
            Kitchen (Origin)
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
            Customer Doorstep
          </div>
        </div>

        {/* Courier Beacon */}
        <motion.div
          className="absolute z-30 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          animate={{ left: `${courierX}%`, top: `${courierY}%` }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 20, stiffness: 60 }
          }
        >
          <div className="relative">
            {/* Pulsing Beacon Rings */}
            <div className="absolute -inset-3 rounded-full bg-teal-400/30 animate-radar-ripple" />
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-teal-500/60 border-2 border-white dark:border-slate-950">
              <Bike className="w-6 h-6 animate-bounce" />
            </div>
          </div>
          <div className="mt-1.5 px-2.5 py-0.5 rounded-md bg-teal-500 text-slate-950 font-extrabold text-[10px] whitespace-nowrap shadow-md tracking-tight">
            Courier Beacon
          </div>
        </motion.div>
      </div>

      {/* Telemetry Status Bar */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50">
          <span className="text-slate-400 font-medium block mb-0.5">Delivery Destination</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
            {order.customer.address}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50">
          <span className="text-slate-400 font-medium block mb-0.5">Estimated Arrival</span>
          <span className="font-semibold text-teal-600 dark:text-teal-400 font-mono block">
            {order.status === 'DELIVERED'
              ? 'Delivered'
              : order.estimatedDeliveryAt
                ? new Date(order.estimatedDeliveryAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '25-35 mins'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50">
          <span className="text-slate-400 font-medium block mb-0.5">Telemetry Status</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">
            {order.status === 'OUT_FOR_DELIVERY' ? 'Active In-Transit' : order.status}
          </span>
        </div>
      </div>
    </div>
  );
}
