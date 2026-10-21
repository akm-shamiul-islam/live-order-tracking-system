import { useCopy } from '../lib/i18n';
import { IconAction, IconActionLink } from '../components/ui/IconAction';
import { formatDateTime } from '../lib/dateTime';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, Clock3, RefreshCw, Send, PackageCheck, Eye } from 'lucide-react';
import { paginate } from '@kitchentodoor/shared';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useOrderListUpdates } from '../hooks/useOrderListUpdates';
import { PageSkeleton, Spinner } from '../components/layout/Loading';
import { Pagination } from '../components/layout/Pagination';
import { clientSettings } from '../lib/clientSettings';

export function CourierDashboard() {
  const c = useCopy();

  const { user, isCourier } = useAuth();
  const { page, size } = useSearch({ from: '/staff/courier/' });
  const navigate = useNavigate({ from: '/courier' });
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ['available-deliveries', user?.id, page, size],
    queryFn: () => api.orders.available(page, size),
    refetchInterval: clientSettings.VITE_ORDER_LIST_REFRESH_MS,
  });
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  useOrderListUpdates();
  const pagination = result.data?.pagination ?? paginate(0, page, size);
  const resolvedPage = result.data?.pagination.page;
  useEffect(() => {
    if (resolvedPage !== undefined && resolvedPage !== page)
      void navigate({ search: (previous) => ({ ...previous, page: resolvedPage }), replace: true });
  }, [resolvedPage, page, navigate]);
  async function request(id: string) {
    if (pending) return;
    setPending(id);
    setError(undefined);
    try {
      await api.orders.requestDelivery(id);
      await queryClient.invalidateQueries({ queryKey: ['available-deliveries'] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request this delivery.');
    } finally {
      setPending(undefined);
    }
  }
  return (
    <div className="mx-auto w-full min-w-0 space-y-6">
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 flex-1">
          <h1 className="font-display flex items-center gap-3 text-2xl font-extrabold">
            <Bike aria-hidden="true" className="h-7 w-7 text-teal-700 dark:text-teal-300" />
            {c('Available Deliveries')}{' '}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {isCourier && (
            <Link
              to="/orders"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800"
            >
              <PackageCheck aria-hidden="true" className="h-4 w-4" />
              {c('My Deliveries')}{' '}
            </Link>
          )}
          <button
            onClick={() => void result.refetch()}
            disabled={result.isFetching}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold dark:border-slate-600"
          >
            {result.isFetching ? <Spinner /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
            {c('Refresh')}{' '}
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
          {c(
            'Request a delivery below. After an administrator approves you, it moves to My Deliveries and is removed from other couriers’ available lists.',
          )}{' '}
        </p>
      </div>
      {(error || result.error) && (
        <p
          role="alert"
          className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {c(error || result.error?.message)}
        </p>
      )}
      {result.isLoading ? (
        <PageSkeleton label={c('Finding available deliveries…')} />
      ) : (
        !result.error && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.data?.orders.length ? (
              result.data.orders.map((order) => (
                <article key={order.id} className="glass-panel flex flex-col gap-4 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-mono text-sm font-bold text-teal-800 dark:text-teal-200">
                      {order.orderNumber}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {c(order.status.replaceAll('_', ' '))}
                    </span>
                  </div>
                  <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                    {order.items.map((item) => `${c(item.name)} ×${item.quantity}`).join(', ')}
                  </p>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Clock3 aria-hidden="true" className="h-4 w-4" />
                      <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
                    </span>
                    <span className="font-mono font-bold">${order.total.toFixed(2)}</span>
                  </div>
                  {order.request ? (
                    <p
                      role="status"
                      className={`rounded-xl p-3 text-sm ${order.request.status === 'PENDING' ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                    >
                      {order.request.status === 'PENDING'
                        ? c('Request sent. Awaiting administrator approval.')
                        : c('Your delivery request was declined.')}
                    </p>
                  ) : isCourier ? (
                    <IconAction
                      icon={Send}
                      tone="primary"
                      label={pending === order.id ? c('Sending Request…') : c('Request Delivery')}
                      pending={pending === order.id}
                      disabled={!!pending}
                      onClick={() => void request(order.id)}
                    />
                  ) : (
                    <IconActionLink
                      to="/tracking/$orderId"
                      orderId={order.id}
                      icon={Eye}
                      label={c('Review in Dispatch')}
                    />
                  )}
                </article>
              ))
            ) : (
              <div className="glass-panel col-span-full rounded-2xl p-12 text-center">
                <Bike
                  aria-hidden="true"
                  className="mx-auto mb-4 h-10 w-10 text-teal-700 dark:text-teal-300"
                />
                <h2 className="font-display text-xl font-bold">{c('No Deliveries Available')}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {c('New unassigned orders will appear here automatically.')}{' '}
                </p>
              </div>
            )}
          </div>
        )
      )}
      {!result.error && (
        <Pagination
          pagination={pagination}
          disabled={result.isFetching || !!pending}
          onPageChange={(next) =>
            void navigate({ search: (previous) => ({ ...previous, page: next }) })
          }
          onPageSizeChange={(next) =>
            void navigate({ search: (previous) => ({ ...previous, size: next, page: 1 }) })
          }
        />
      )}
    </div>
  );
}
