import { Mail, MailOpen, Trash2 } from 'lucide-react';
import type { ProfileChange } from '@kitchentodoor/shared';
import { useId, useState } from 'react';
import { useCopy } from '../../lib/i18n';
import { useAuth } from '../../hooks/useAuth';
import { useNotificationActions } from '../../hooks/useNotificationActions';
import { IconAction } from '../ui/IconAction';
import { ChangeStatusBadge } from './ProfileChangeModal';
import { formatDateTime } from '../../lib/dateTime';

export function NotificationList({
  notifications,
  onOpen,
  allowDismiss = false,
}: {
  notifications: ProfileChange[];
  onOpen: (id: string) => void;
  allowDismiss?: boolean;
}) {
  const c = useCopy();
  const listId = useId();
  const { user, isAdmin } = useAuth();
  const actions = useNotificationActions();
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {c(error)}
        </p>
      )}
      {notifications.map((item) => {
        const own = item.userId === user?.id;
        const name = item.status === 'APPROVED' ? item.proposed.name : item.before.name;
        const message =
          item.status === 'PENDING'
            ? own
              ? 'Your profile changes are awaiting administrator review.'
              : 'Review the requested profile changes.'
            : item.status === 'APPROVED'
              ? own
                ? isAdmin
                  ? 'Your profile changes were saved.'
                  : 'Your profile changes were approved and applied.'
                : 'Profile changes were approved and applied.'
              : own
                ? 'Your profile changes were rejected. Open to read the feedback.'
                : 'Profile changes were rejected. Open to read the feedback.';
        const update = (action: () => Promise<void>) => {
          setPending(item.id);
          setError(undefined);
          void action()
            .catch((cause: unknown) =>
              setError(
                cause instanceof Error ? cause.message : 'Unable to update this notification.',
              ),
            )
            .finally(() => setPending(undefined));
        };
        return (
          <div
            key={item.id}
            data-notification-id={item.id}
            data-unread={item.unread}
            className={`relative rounded-2xl border p-3 transition-colors hover:border-teal-400 dark:hover:border-teal-500/60 sm:p-4 ${item.unread ? 'border-teal-200 bg-teal-50/70 dark:border-teal-500/30 dark:bg-teal-500/10' : 'border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/30'}`}
          >
            <button
              type="button"
              onClick={() => {
                // Persist the click even if the preview closes before its detail request finishes.
                if (item.unread) update(() => actions.read(item, false));
                onOpen(item.id);
              }}
              aria-label={c('Open Notification for {{name}}', { name })}
              aria-describedby={`${listId}-${item.id}-time ${listId}-${item.id}-message`}
              className="notification-open block w-full min-w-0 rounded-lg text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span className="flex items-start justify-between gap-3">
                <span
                  data-notification-name
                  className={`min-w-0 break-words text-sm ${item.unread ? 'font-bold' : 'font-normal'}`}
                >
                  {name}
                </span>
                <ChangeStatusBadge status={item.status} />
              </span>
              <time
                id={`${listId}-${item.id}-time`}
                dateTime={item.updatedAt}
                className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400"
              >
                {formatDateTime(item.updatedAt, 'date')} {formatDateTime(item.updatedAt, 'time')}
              </time>
              <span
                id={`${listId}-${item.id}-message`}
                data-notification-message
                className={`mt-2 flex min-h-11 items-center text-sm leading-relaxed text-slate-600 dark:text-slate-300 ${allowDismiss ? 'pr-28' : 'pr-14'} ${item.unread ? 'font-bold' : 'font-normal'}`}
              >
                {c(message)}
              </span>
            </button>
            <div className="absolute bottom-3 right-3 flex items-center gap-2 sm:bottom-4 sm:right-4">
              <IconAction
                icon={item.unread ? MailOpen : Mail}
                label={c(item.unread ? 'Mark as Read' : 'Mark as Unread')}
                pending={pending === item.id}
                disabled={!!pending}
                onClick={() => update(() => actions.read(item, !item.unread))}
              />
              {allowDismiss && (
                <IconAction
                  icon={Trash2}
                  tone="danger"
                  label={c('Remove from Dropdown')}
                  pending={pending === item.id}
                  disabled={!!pending}
                  onClick={() => update(() => actions.dismiss(item))}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
