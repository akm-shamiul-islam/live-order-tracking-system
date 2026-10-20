import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { OrderHistorySearchSchema, paginate } from '@kitchentodoor/shared';
import { api, ApiError } from '../../lib/api';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { Search, Clock, Eye, ShoppingBag } from 'lucide-react';
import { Pagination } from '../layout/Pagination';

export function OrderHistory() {
  const { page, size } = useSearch({ from: '/orders' });
  const navigate = useNavigate({ from: '/orders' });
  const [initialPhone] = useState(() => {
    try {
      const saved = OrderHistorySearchSchema.safeParse({
        phone: localStorage.getItem('ktd_last_phone') || '',
      });
      return saved.success ? saved.data.phone : '';
    } catch {
      return '';
    }
  });
  const form = useZodForm(OrderHistorySearchSchema, { phone: initialPhone }, 'history');
  const [searchPhone, setSearchPhone] = useState(initialPhone);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['my-orders', searchPhone, page, size],
    queryFn: () => api.orders.getHistoryPage(searchPhone, page, size),
    enabled: !!searchPhone,
  });
  const orders = data?.orders ?? [];
  const pagination = data?.pagination ?? paginate(0, page, size);
  const resolvedPage = data?.pagination.page;
  useEffect(() => {
    if (resolvedPage !== undefined && resolvedPage !== page) {
      void navigate({ search: (previous) => ({ ...previous, page: resolvedPage }), replace: true });
    }
  }, [resolvedPage, navigate, page]);

  const handleSearch = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = form.validate(e.currentTarget);
    if (!values) return;
    try {
      localStorage.setItem('ktd_last_phone', values.phone);
    } catch {
      /* Storage may be blocked. */
    }
    if (values.phone === searchPhone && page === 1) void refetch();
    else {
      setSearchPhone(values.phone);
      void navigate({ search: (previous) => ({ ...previous, page: 1 }) });
    }
  };

  const phoneError =
    form.errors.phone ||
    (form.values.phone === searchPhone && error instanceof ApiError
      ? error.fieldErrors.phone
      : undefined);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-100">
          My Order History
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Look up past orders using your mobile phone number
        </p>
      </div>

      {/* Phone lookup form */}
      <form
        noValidate
        onSubmit={handleSearch}
        className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-start gap-3 shadow-xs"
      >
        <div className="w-full min-w-0 flex-1">
          <label htmlFor="history-phone" className="sr-only">
            Phone number used to place your order
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400"
            >
              <Search className="h-4 w-4" />
            </span>
            <input
              type="tel"
              {...form.field('phone')}
              inputMode="tel"
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? 'history-phone-error' : undefined}
              autoComplete="tel"
              required
              placeholder="Phone number (e.g. 555-1234)…"
              className="h-11 w-full pl-11 pr-4 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
          </div>
          <FieldError id="history-phone-error" message={phoneError} />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition-colors shadow-sm shadow-emerald-500/20 active:scale-95 cursor-pointer"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          <span>Search Orders</span>
        </button>
      </form>

      {/* Orders List */}
      <div className="space-y-4">
        {isLoading ? (
          <div role="status" className="text-center py-12 text-slate-400">
            Loading your orders…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="glass-panel rounded-2xl p-6 text-center text-sm text-rose-700 dark:text-rose-300"
          >
            <p>{error.message}</p>
            <button onClick={() => void refetch()} className="mt-3 font-bold underline">
              Try Again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="glass-panel text-center py-12 rounded-2xl">
            <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <h4 className="font-display font-bold text-base text-slate-700 dark:text-slate-300">
              No orders found
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Enter your phone number above or place an order from the food menu.
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="glass-panel p-5 rounded-2xl hover:border-teal-500/40 hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm">
                    {order.orderNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                  {order.items.map((i) => `${i.name} (${i.quantity}x)`).join(', ')}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(order.createdAt).toLocaleDateString()} at{' '}
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>•</span>
                  <span>Deliver to: {order.customer.address}</span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                <span className="font-display font-extrabold text-lg text-slate-900 dark:text-slate-100 font-mono">
                  ${order.pricing.total.toFixed(2)}
                </span>
                <Link
                  to="/tracking/$orderId"
                  params={{ orderId: order.id }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition active:scale-95 shadow-xs shadow-emerald-500/20 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Tracking</span>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
      {searchPhone && !error && (
        <Pagination
          pagination={pagination}
          disabled={isFetching}
          onPageChange={(next) =>
            void navigate({ search: (previous) => ({ ...previous, page: next }) })
          }
          onPageSizeChange={(next) =>
            void navigate({
              search: (previous) => ({ ...previous, size: next as typeof size, page: 1 }),
            })
          }
        />
      )}
    </div>
  );
}
