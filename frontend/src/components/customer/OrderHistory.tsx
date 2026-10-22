import { useCopy } from '../../lib/i18n';
import { IconActionLink } from '../ui/IconAction';
import { formatDateTime } from '../../lib/dateTime';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ORDER_STATUS_SEQUENCE, OrderStatus, paginate } from '@kitchentodoor/shared';
import { z } from '@kitchentodoor/shared/zod';
import { api, ApiError } from '../../lib/api';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { SearchClearButton } from '../forms/SearchClearButton';
import { Bike, Search, Clock, Navigation, ShoppingBag, RefreshCw, ListFilter } from 'lucide-react';
import { Pagination } from '../layout/Pagination';
import { useAuth } from '../../hooks/useAuth';
import { PageSkeleton, Spinner } from '../layout/Loading';
import { useOrderListUpdates } from '../../hooks/useOrderListUpdates';
import { clientSettings } from '../../lib/clientSettings';
import { ReceiptDownloadButton } from './ReceiptDownloadButton';
import { ThemedSelect } from '../forms/ThemedSelect';
import { orderStatusBadgeClass } from '../../lib/orderStatusBadge';

const SearchSchema = z.object({ q: z.string().trim().max(100, 'Use at most 100 characters') });
const historyStatuses = ['ALL', ...ORDER_STATUS_SEQUENCE, OrderStatus.CANCELLED].map((value) => ({
  value,
  label: value.replace(/_/g, ' '),
}));
type HistoryStatus = 'ALL' | OrderStatus;
function isHistoryStatus(value: string): value is HistoryStatus {
  return value === 'ALL' || Object.values(OrderStatus).some((status) => status === value);
}

export function OrderHistory() {
  const { q, status } = useSearch({ from: '/orders' });
  return <OrderHistoryContent key={`${q}:${status}`} />;
}

function OrderHistoryContent() {
  const c = useCopy();

  const { user, isCourier } = useAuth();
  const { page, size, q, status } = useSearch({ from: '/orders' });
  const navigate = useNavigate({ from: '/orders' });
  const form = useZodForm(SearchSchema, { q }, 'history');
  const [draftStatus, setDraftStatus] = useState(status);
  useOrderListUpdates();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['my-orders', user?.id, user?.role, q, status, page, size],
    queryFn: () =>
      api.orders.getHistoryPage(undefined, page, size, q, status === 'ALL' ? undefined : status),
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
          {isCourier ? c('My Deliveries') : c('My Order History')}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {isCourier
            ? c('Only deliveries approved and assigned to your account appear here.')
            : c(
                'All orders placed with your account. Other customers cannot access these details.',
              )}
        </p>
      </div>

      {/* Phone lookup form */}
      <div className="glass-panel relative z-20 flex flex-col gap-5 rounded-2xl p-4 shadow-xs sm:p-5 xl:flex-row xl:items-end xl:justify-between">
        {isCourier && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void navigate({
                search: (previous) => ({ ...previous, status: draftStatus, page: 1 }),
              });
            }}
            className="w-full xl:w-auto"
          >
            <div className="flex items-end gap-2.5">
              <div className="w-full sm:w-56">
                <span
                  id="history-status-label"
                  className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400"
                >
                  {c('Order Status')}
                </span>
                <ThemedSelect
                  label={c('Order Status')}
                  labelId="history-status-label"
                  value={draftStatus}
                  options={historyStatuses}
                  onChange={(value) => {
                    if (isHistoryStatus(value)) setDraftStatus(value);
                  }}
                  size="small"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 text-xs font-bold text-white shadow-sm shadow-teal-500/15 transition-[background-color,transform] hover:from-emerald-800 hover:to-teal-800 active:scale-[0.98]"
              >
                <ListFilter aria-hidden="true" className="h-4 w-4" />
                <span>{c('Filter')}</span>
              </button>
            </div>
          </form>
        )}
        <form noValidate onSubmit={handleSearch} className="w-full sm:ml-auto sm:w-auto">
          <label
            htmlFor="history-q"
            className="mb-2 block text-[11px] font-bold text-slate-500 dark:text-slate-400"
          >
            {c('Search Orders')}{' '}
          </label>
          <div className="flex items-end gap-2.5">
            <div className="min-w-0 flex-1 sm:w-[360px] sm:flex-none">
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400"
                >
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  role="searchbox"
                  enterKeyHint="search"
                  {...form.field('q')}
                  aria-invalid={searchError ? true : undefined}
                  aria-describedby={searchError ? 'history-q-error' : undefined}
                  autoComplete="off"
                  placeholder={c('Search your order number…')}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-xs text-slate-800 shadow-xs placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <SearchClearButton
                  visible={form.values.q.length > 0}
                  onClear={() => form.setValue('q', '')}
                />
              </div>
              <FieldError id="history-q-error" message={searchError} />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 text-xs font-bold text-white shadow-sm shadow-teal-500/15 transition-[background-color,transform] hover:from-emerald-800 hover:to-teal-800 active:scale-[0.98]"
            >
              {isFetching ? <Spinner /> : <Search aria-hidden="true" className="h-4 w-4" />}
              <span>{c('Search')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {isLoading ? (
          <PageSkeleton label={c('Loading your orders…')} />
        ) : error ? (
          <div
            role="alert"
            className="glass-panel rounded-2xl p-6 text-center text-sm text-rose-700 dark:text-rose-300"
          >
            <p>{c(error.message)}</p>
            <button
              onClick={() => void refetch()}
              className="mt-3 inline-flex items-center gap-2 font-bold underline"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {c('Try Again')}{' '}
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="glass-panel text-center py-12 rounded-2xl">
            <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <h2 className="font-display font-bold text-base text-slate-700 dark:text-slate-300">
              {c('No orders found')}{' '}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              {isCourier
                ? c('Request an available delivery and wait for administrator approval.')
                : c('Place your first order or try a different order number.')}
            </p>
            <Link
              to={isCourier ? '/courier' : '/'}
              className="mt-4 inline-flex items-center gap-2 font-bold text-teal-800 underline dark:text-teal-200"
            >
              {isCourier ? (
                <Bike aria-hidden="true" className="h-4 w-4" />
              ) : (
                <ShoppingBag aria-hidden="true" className="h-4 w-4" />
              )}
              {isCourier ? c('Find Available Deliveries') : c('Explore Food Menu')}
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
                  <span
                    className={`whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${orderStatusBadgeClass(order.status)}`}
                  >
                    {c(order.status.replace(/_/g, ' '))}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                  {order.items.map((i) => `${c(i.name)} (${i.quantity}x)`).join(', ')}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatDateTime(order.createdAt, 'date')} {c('at')}{' '}
                    {formatDateTime(order.createdAt, 'time')}
                  </span>
                  <span>•</span>
                  <span>
                    {c('Deliver to:')} {order.customer.address}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                <span className="font-display font-extrabold text-lg text-slate-900 dark:text-slate-100 font-mono">
                  ${order.pricing.total.toFixed(2)}
                </span>
                <div className="flex items-center gap-2">
                  {!isCourier && (
                    <ReceiptDownloadButton
                      orderId={order.id}
                      orderNumber={order.orderNumber}
                      variant="icon"
                    />
                  )}
                  <IconActionLink
                    to={isCourier ? '/courier/$orderId' : '/tracking/$orderId'}
                    orderId={order.id}
                    icon={Navigation}
                    label={isCourier ? c('Manage Delivery') : c('Live Tracking')}
                  />
                </div>
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
