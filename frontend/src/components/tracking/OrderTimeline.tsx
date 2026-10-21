import { useCopy } from '../../lib/i18n';
import { formatDateTime } from '../../lib/dateTime';
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
  const c = useCopy();

  const currentStatus = order.status;
  const isCancelled = currentStatus === OrderStatus.CANCELLED;
  const currentStepIndex = getStatusStepIndex(currentStatus);

  return (
    <div className="space-y-8">
      {isCancelled && (
        <section className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          <XCircle aria-hidden="true" className="h-8 w-8 shrink-0" />
          <div>
            <h2 className="font-display text-lg font-bold">{c('Order Cancelled')}</h2>
            <p className="mt-2 text-sm">
              {order.statusHistory.find((log) => log.status === OrderStatus.CANCELLED)?.note ||
                c('This order has been cancelled.')}
            </p>
          </div>
        </section>
      )}
      {/* Visual Stepper */}
      {!isCancelled && (
        <div className="relative">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
            {STEP_CONFIG.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = currentStepIndex > idx;
              const isCurrent = currentStepIndex === idx;

              return (
                <div
                  key={step.status}
                  className={`relative flex flex-col items-center text-center p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'glass-panel border-teal-500 dark:border-teal-400 shadow-lg shadow-teal-500/15 scale-105'
                      : isCompleted
                        ? 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-800/40'
                        : 'bg-slate-50/50 border-slate-200/60 dark:bg-slate-900/30 dark:border-slate-800/40'
                  }`}
                >
                  {/* Node Icon */}
                  <div className="relative mb-3">
                    {isCurrent && (
                      <div className="absolute -inset-2 rounded-2xl bg-teal-500/20 dark:bg-teal-400/20 motion-safe:animate-pulse" />
                    )}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-xs ${
                        isCurrent
                          ? 'bg-gradient-to-tr from-emerald-700 to-teal-700 text-white shadow-teal-500/30'
                          : isCompleted
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Step Info */}
                  <div className="text-xs uppercase font-extrabold tracking-wider mb-0.5 text-slate-600 dark:text-slate-300">
                    {c('Step')} {idx + 1}
                  </div>
                  <div
                    className={`font-display font-bold text-sm ${
                      isCurrent
                        ? 'text-teal-700 dark:text-teal-400'
                        : isCompleted
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {c(step.label)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {c(step.desc)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Real-Time Live Activity Feed / Logs */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
              {c('Live Activity & Audit Trail')}{' '}
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {order.statusHistory?.length || 0} {c('Events Logged')}{' '}
          </span>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {order.statusHistory && order.statusHistory.length > 0 ? (
            order.statusHistory.map((log, i) => (
              <div
                key={log.id || i}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50 text-xs"
              >
                <div className="mt-0.5 w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {c(log.status.replace(/_/g, ' '))}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {formatDateTime(log.timestamp, 'timeSeconds')}
                    </span>
                  </div>
                  {log.note && (
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">{log.note}</p>
                  )}
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-1">
                    {c('Updated by')} {log.changedBy?.name || c('Kitchen Staff')} (
                    {c(log.changedBy?.role || 'SYSTEM')})
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm">
              {c('No status logs recorded yet.')}{' '}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
