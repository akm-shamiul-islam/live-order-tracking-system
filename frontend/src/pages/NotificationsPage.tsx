import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Bell, RefreshCw } from 'lucide-react';
import { paginate } from '@kitchentodoor/shared';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useCopy } from '../lib/i18n';
import { clientSettings } from '../lib/clientSettings';
import { NotificationList } from '../components/notifications/NotificationList';
import { ProfileChangeModal } from '../components/notifications/ProfileChangeModal';
import { Pagination } from '../components/layout/Pagination';
import { LoadingState } from '../components/layout/Loading';
import { NotificationFilters } from '../components/notifications/NotificationFilters';
import { secondaryButton } from '../components/ui/formStyles';

export function NotificationsPage() {
  const c = useCopy();
  const { user } = useAuth();
  const { page, size, status, q } = useSearch({ from: '/notifications' });
  const navigate = useNavigate({ from: '/notifications' });
  const [selected, setSelected] = useState<string>();
  const result = useQuery({
    queryKey: ['notifications', user?.id, 'history', page, size, status, q],
    queryFn: () =>
      api.notifications.list({
        page,
        limit: size,
        status: status === 'ALL' ? undefined : status,
        q,
      }),
    refetchInterval: clientSettings.VITE_NOTIFICATIONS_POLL_MS,
  });
  const pagination = result.data?.pagination ?? paginate(0, page, size);
  const resolvedPage = result.data?.pagination.page;
  useEffect(() => {
    if (resolvedPage !== undefined && resolvedPage !== page)
      void navigate({ search: (previous) => ({ ...previous, page: resolvedPage }), replace: true });
  }, [resolvedPage, page, navigate]);
  return (
    <section className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display flex items-center gap-3 text-2xl font-extrabold">
            <Bell aria-hidden="true" className="h-7 w-7 text-teal-700 dark:text-teal-300" />
            {c('Notifications')}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {c('Profile requests, review decisions and your notification history.')}
          </p>
        </div>
        <button
          type="button"
          className={secondaryButton}
          disabled={result.isFetching}
          onClick={() => void result.refetch()}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {c('Refresh')}
        </button>
      </div>
      <NotificationFilters
        key={`${status}:${q}`}
        status={status}
        search={q}
        onFilter={(value) =>
          void navigate({ search: (previous) => ({ ...previous, status: value, page: 1 }) })
        }
        onSearch={(value) =>
          void navigate({ search: (previous) => ({ ...previous, q: value, page: 1 }) })
        }
      />
      {result.isLoading ? (
        <LoadingState />
      ) : result.error ? (
        <p role="alert" className="glass-panel rounded-2xl p-6 text-rose-700 dark:text-rose-300">
          {c(result.error.message)}
        </p>
      ) : result.data?.notifications.length ? (
        <NotificationList notifications={result.data.notifications} onOpen={setSelected} />
      ) : (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <Bell aria-hidden="true" className="mx-auto h-12 w-12 text-teal-600 dark:text-teal-300" />
          <h2 className="font-display mt-4 text-xl font-bold">{c('No Notifications')}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {q || status !== 'ALL'
              ? c('No notifications match these filters.')
              : c('You have no notifications yet.')}
          </p>
        </div>
      )}
      {!result.error && (
        <Pagination
          pagination={pagination}
          disabled={result.isFetching}
          onPageChange={(next) =>
            void navigate({ search: (previous) => ({ ...previous, page: next }) })
          }
          onPageSizeChange={(next) =>
            void navigate({ search: (previous) => ({ ...previous, size: next, page: 1 }) })
          }
        />
      )}{' '}
      {selected && <ProfileChangeModal id={selected} onClose={() => setSelected(undefined)} />}
    </section>
  );
}
