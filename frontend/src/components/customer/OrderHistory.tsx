import { formatDateTime } from '../../lib/dateTime';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { paginate } from '@kitchentodoor/shared';
import { z } from '@kitchentodoor/shared/zod';
import { api, ApiError } from '../../lib/api';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { Search, Clock, Eye, ShoppingBag, RefreshCw } from 'lucide-react';
import { Pagination } from '../layout/Pagination';
import { useAuth } from '../../hooks/useAuth';
import { PageSkeleton, Spinner } from '../layout/Loading';
import { useOrderListUpdates } from '../../hooks/useOrderListUpdates';
import { clientSettings } from '../../lib/clientSettings';

const SearchSchema = z.object({ q: z.string().trim().max(100, 'Use at most 100 characters') });

export function OrderHistory() {
  const { q } = useSearch({ from: '/orders' });
  return <OrderHistoryContent key={q} />;
}

function OrderHistoryContent() {
  const { user, isCourier } = useAuth();
  const { page, size, q } = useSearch({ from: '/orders' });
  const navigate = useNavigate({ from: '/orders' });
  const form = useZodForm(SearchSchema, { q }, 'history');
  useOrderListUpdates();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['my-orders', user?.id, user?.role, q, page, size],
    queryFn: () => api.orders.getHistoryPage(undefined, page, size, q),
    enabled: !!user,
    refetchInterval: clientSettings.VITE_ORDER_LIST_REFRESH_MS,
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
    if (values.q === q && page === 1) void refetch();
    else void navigate({ search: (previous) => ({ ...previous, q: values.q, page: 1 }) });
  };

  const searchError =
    form.errors.q ||
    (form.values.q === q && error instanceof ApiError ? error.fieldErrors.q : undefined);

  return (
    <div className="w-full min-w-0 space-y-6 mx-auto">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-100">
          {isCourier ? 'My Deliveries' : 'My Order History'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {isCourier
            ? 'Only deliveries approved and assigned to your account appear here.'
            : 'All orders placed with your account. Other customers cannot access these details.'}
        </p>
      </div>

      {/* Phone lookup form */}
      <form
        noValidate
        onSubmit={handleSearch}
        className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-start gap-3 shadow-xs"
      >
        <div className="w-full min-w-0 flex-1">
          <label htmlFor="history-q" className="sr-only">
            Search your order number
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400"
            >
              <Search className="h-4 w-4" />
            </span>
            <input
              type="search"
              {...form.field('q')}
              aria-invalid={searchError ? true : undefined}
              aria-describedby={searchError ? 'history-q-error' : undefined}
              autoComplete="off"
              placeholder="Search your order number…"
              className="h-11 w-full pl-11 pr-4 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
          </div>
          <FieldError id="history-q-error" message={searchError} />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white transition-colors shadow-sm shadow-emerald-500/20 active:scale-95 cursor-pointer"
        >
          {isFetching ? <Spinner /> : <Search aria-hidden="true" className="h-4 w-4" />}
          <span>Search Orders</span>
        </button>
      </form>

      {/* Orders List */}
      <div className="space-y-4">
        {isLoading ? (
          <PageSkeleton label="Loading your orders…" />
        ) : error ? (
          <div
            role="alert"
            className="glass-panel rounded-2xl p-6 text-center text-sm text-rose-700 dark:text-rose-300"
          >
            <p>{error.message}</p>
            <button
              onClick={() => void refetch()}
              className="mt-3 inline-flex items-center gap-2 font-bold underline"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="glass-panel text-center py-12 rounded-2xl">
            <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <h2 className="font-display font-bold text-base text-slate-700 dark:text-slate-300">
              No orders found
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              {isCourier
                ? 'Request an available delivery and wait for administrator approval.'
                : 'Place your first order or try a different order number.'}
            </p>
            <Link
              to={isCourier ? '/courier' : '/'}
              className="mt-4 inline-block font-bold text-teal-800 underline dark:text-teal-200"
            >
              {isCourier ? 'Find Available Deliveries' : 'Explore Food Menu'}
            </Link>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="glass-panel p-5 rounded-2xl hover:border-teal-500/40 hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400 text-sm">
                    {order.orderNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                  {order.items.map((i) => `${i.name} (${i.quantity}x)`).join(', ')}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatDateTime(order.createdAt, 'date')} at{' '}
                    {formatDateTime(order.createdAt, 'time')}
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
                  to={isCourier ? '/courier/$orderId' : '/tracking/$orderId'}
                  params={{ orderId: order.trackingId || order.id }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white transition active:scale-95 shadow-xs shadow-emerald-500/20 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isCourier ? 'Manage Delivery' : 'Live Tracking'}</span>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
      {!error && (
        <Pagination
          pagination={pagination}
          disabled={isFetching}
          onPageChange={(next) =>
            void navigate({ search: (previous) => ({ ...previous, page: next }) })
          }
          onPageSizeChange={(next) =>
            void navigate({
              search: (previous) => ({ ...previous, size: next, page: 1 }),
            })
          }
        />
      )}
    </div>
  );
}
