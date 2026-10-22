import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, X } from 'lucide-react';
import { paginate, type NotificationQuery } from '@kitchentodoor/shared';
import { useCopy } from '../../lib/i18n';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../ui/Modal';
import { secondaryButton } from '../ui/formStyles';
import { LoadingState } from '../layout/Loading';
import { Pagination } from '../layout/Pagination';
import { NotificationList } from './NotificationList';
import { ProfileChangeModal } from './ProfileChangeModal';
import { formatDateTime } from '../../lib/dateTime';

export function ProfileHistoryModal({
  userId,
  name,
  onClose,
}: {
  userId: string;
  name: string;
  onClose: () => void;
}) {
  const c = useCopy();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<NotificationQuery['limit']>(10);
  const [selected, setSelected] = useState<string>();
  const result = useQuery({
    queryKey: ['notifications', user?.id, 'history', userId, page, size],
    queryFn: () => api.notifications.list({ page, limit: size, userId }),
  });
  const audit = useQuery({
    queryKey: ['users', user?.id, 'history', userId],
    queryFn: () => api.users.history(userId),
  });
  const fieldLabels: Record<string, string> = {
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Delivery Address',
    role: 'Role',
    disabled: 'Account Status',
  };
  return (
    <Modal
      title={c('Profile Change History')}
      icon={History}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={secondaryButton}>
          <X aria-hidden="true" className="h-4 w-4" />
          {c('Cancel')}
        </button>
      }
    >
      <p className="text-sm font-semibold">{name}</p>
      {result.isLoading ? (
        <LoadingState />
      ) : result.error ? (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {c(result.error.message)}
        </p>
      ) : result.data?.notifications.length ? (
        <NotificationList notifications={result.data.notifications} onOpen={setSelected} />
      ) : (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {c('No profile changes have been requested.')}
        </p>
      )}
      <Pagination
        pagination={result.data?.pagination ?? paginate(0, page, size)}
        disabled={result.isFetching}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setSize(value);
          setPage(1);
        }}
      />
      <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-700">
        <h3 className="font-display font-bold">{c('Account Administration History')}</h3>
        {audit.isLoading ? (
          <LoadingState />
        ) : audit.error ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {c(audit.error.message)}
          </p>
        ) : audit.data?.length ? (
          <ol className="space-y-3">
            {audit.data.map((entry) => (
              <li
                key={`${entry.timestamp}:${entry.actorName}`}
                className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"
              >
                <p className="font-semibold">
                  {c('Reviewed by {{name}}', { name: c(entry.actorName) })}
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  {entry.fields.map((field) => c(fieldLabels[field] || field)).join(', ') ||
                    c('No fields changed')}
                </p>
                <time
                  dateTime={entry.timestamp}
                  className="mt-1 block text-xs text-slate-500 dark:text-slate-400"
                >
                  {formatDateTime(entry.timestamp, 'date')}{' '}
                  {formatDateTime(entry.timestamp, 'time')}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {c('No administrator edits have been recorded.')}
          </p>
        )}
      </section>
      {selected && <ProfileChangeModal id={selected} onClose={() => setSelected(undefined)} />}
    </Modal>
  );
}
