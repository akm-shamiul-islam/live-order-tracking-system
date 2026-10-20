import { motion } from 'motion/react';
import { OrderStatus, getStatusStepIndex, OrderDetails } from '@kitchentodoor/shared';
import { CheckCircle2, Clock, ChefHat, PackageCheck, Bike, Home, XCircle } from 'lucide-react';

interface OrderTimelineProps {
  order: OrderDetails;
}

const STEP_CONFIG = [
  {
    status: OrderStatus.PLACED,
    label: 'Order Received',
    desc: 'Sent to restaurant kitchen',
    icon: Clock,
  },
  {
    status: OrderStatus.CONFIRMED,
    label: 'Kitchen Confirmed',
    desc: 'Order accepted by chef',
    icon: CheckCircle2,
  },
  {
    status: OrderStatus.PREPARING,
    label: 'Freshly Preparing',
    desc: 'Cooking in the kitchen',
    icon: ChefHat,
  },
  {
    status: OrderStatus.READY_FOR_PICKUP,
    label: 'Ready for Pickup',
    desc: 'Packaged & hot',
    icon: PackageCheck,
  },
  {
    status: OrderStatus.OUT_FOR_DELIVERY,
    label: 'Out for Delivery',
    desc: 'Courier on the road',
    icon: Bike,
  },
  {
    status: OrderStatus.DELIVERED,
    label: 'Delivered',
    desc: 'Handed to your doorstep',
    icon: Home,
  },
];

export function OrderTimeline({ order }: OrderTimelineProps) {
  const currentStatus = order.status;
  const isCancelled = currentStatus === OrderStatus.CANCELLED;
  const currentStepIndex = getStatusStepIndex(currentStatus);

  if (isCancelled) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200">
        <div className="flex items-center gap-3">
          <XCircle className="w-8 h-8 text-rose-500 shrink-0" />
          <div>
            <h3 className="font-display font-bold text-lg">Order Cancelled</h3>
            <p className="text-sm opacity-90">
              This order was cancelled. No further tracking updates will be broadcast.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Visual Stepper */}
      <div className="relative">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
          {STEP_CONFIG.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = currentStepIndex > idx;
            const isCurrent = currentStepIndex === idx;

            return (
              <motion.div
                key={step.status}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className={`relative flex flex-col items-center text-center p-4 rounded-2xl border transition-all ${
                  isCurrent
                    ? 'glass-panel border-teal-500 dark:border-teal-400 shadow-lg shadow-teal-500/15 scale-105'
                    : isCompleted
                      ? 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-800/40'
                      : 'bg-slate-50/50 border-slate-200/60 dark:bg-slate-900/30 dark:border-slate-800/40 opacity-70'
                }`}
              >
                {/* Node Icon */}
                <div className="relative mb-3">
                  {isCurrent && (
                    <motion.div
                      layoutId="pulse-ring"
                      className="absolute -inset-2 rounded-2xl bg-teal-500/20 dark:bg-teal-400/20 animate-pulse"
                    />
                  )}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-xs ${
                      isCurrent
                        ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-teal-500/30'
                        : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                </div>

                {/* Step Info */}
                <div className="text-xs uppercase font-extrabold tracking-wider mb-0.5 text-slate-400 dark:text-slate-500">
                  Step {idx + 1}
                </div>
                <div
                  className={`font-display font-bold text-sm ${
                    isCurrent
                      ? 'text-teal-600 dark:text-teal-400'
                      : isCompleted
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {step.desc}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Real-Time Live Activity Feed / Logs */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
              Live Activity & Audit Trail
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {order.statusHistory?.length || 0} Events Logged
          </span>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {order.statusHistory && order.statusHistory.length > 0 ? (
            order.statusHistory.map((log, i) => (
              <motion.div
                key={log.id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50 text-xs"
              >
                <div className="mt-0.5 w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {log.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  {log.note && (
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">{log.note}</p>
                  )}
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Updated by {log.changedBy?.name || 'Kitchen Staff'} (
                    {log.changedBy?.role || 'SYSTEM'})
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm">
              No status logs recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
