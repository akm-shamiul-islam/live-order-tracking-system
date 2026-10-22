import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, ClipboardList, MessageSquareX, X } from 'lucide-react';
import { z } from '@kitchentodoor/shared/zod';
import type { ProfileChange, ProfileDecisionDto } from '@kitchentodoor/shared';
import { useAuth } from '../../hooks/useAuth';
import { useCopy } from '../../lib/i18n';
import { api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { dangerButton, formInput, primaryButton, secondaryButton } from '../ui/formStyles';
import { LoadingState, Spinner } from '../layout/Loading';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { FieldError } from '../forms/FieldError';
import { useZodForm } from '../../hooks/useZodForm';
import { getSession, saveSession } from '../../lib/authSession';
import { formatDateTime } from '../../lib/dateTime';
import { useNotificationActions } from '../../hooks/useNotificationActions';

export function ChangeStatusBadge({ status }: { status: ProfileChange['status'] }) {
  const c = useCopy();
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${status === 'APPROVED' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300' : status === 'REJECTED' ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'}`}
    >
      {c(
        status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Awaiting Review',
      )}
    </span>
  );
}
export function ProfileChangeModal({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useCopy();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { read } = useNotificationActions();
  const result = useQuery({
    queryKey: ['profile-change', user?.id, id],
    queryFn: () => api.notifications.get(id),
  });
  const [pending, setPending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string>();
  const [readError, setReadError] = useState<string>();
  const change = result.data;
  useEffect(() => {
    if (!change?.unread) return;
    void read(change, false)
      .then(() => setReadError(undefined))
      .catch((cause: unknown) =>
        setReadError(
          cause instanceof Error ? cause.message : 'Unable to update this notification.',
        ),
      );
  }, [change, read]);
  useEffect(() => {
    if (!change || change.status === 'PENDING' || change.userId !== user?.id) return;
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    if (change.status !== 'APPROVED') return;
    const before = getSession();
    void api.auth
      .getMe()
      .then(async (fresh) => {
        if (
          before.token &&
          getSession().token === before.token &&
          fresh.id === getSession().user?.id
        )
          saveSession({ accessToken: before.token, user: fresh });
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
      })
      .catch(() => undefined);
  }, [change, user?.id, queryClient]);
  async function review(body: ProfileDecisionDto) {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const updated = await api.notifications.review(id, body);
      queryClient.setQueryData(['profile-change', user?.id, id], updated);
      await Promise.all(
        ['notifications', 'profile', 'users', 'auth-session'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      setRejecting(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to review this request.');
      await result.refetch();
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={c('Profile Change Request')}
      icon={ClipboardList}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" disabled={pending} onClick={onClose} className={secondaryButton}>
            <X aria-hidden="true" className="h-4 w-4" />
            {c('Cancel')}
          </button>
          {isAdmin && change?.status === 'PENDING' && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => setRejecting(true)}
                className={dangerButton}
              >
                <MessageSquareX aria-hidden="true" className="h-4 w-4" />
                {c('Reject')}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void review({ decision: 'APPROVE' })}
                className={primaryButton}
              >
                {pending ? <Spinner /> : <Check aria-hidden="true" className="h-4 w-4" />}
                {c('Approve')}
              </button>
            </>
          )}
        </>
      }
    >
      {result.isLoading ? (
        <LoadingState />
      ) : result.error ? (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {c(result.error.message)}
        </p>
      ) : (
        change && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{change.before.name}</p>
                <p className="break-all text-sm text-slate-500 dark:text-slate-400">
                  {change.email}
                </p>
                <time
                  dateTime={change.updatedAt}
                  className="mt-1 block text-xs text-slate-500 dark:text-slate-400"
                >
                  {formatDateTime(change.updatedAt, 'date')}{' '}
                  {formatDateTime(change.updatedAt, 'time')}
                </time>
              </div>
              <ChangeStatusBadge status={change.status} />
            </div>
            {change.status === 'PENDING' && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {c('Changes remain inactive until an administrator approves them.')}
              </p>
            )}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[440px] table-fixed text-left text-sm">
                <caption className="sr-only">
                  {c('Previous and Requested Profile Information')}
                </caption>
                <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-800">
                  <tr>
                    <th scope="col" className="w-1/4 p-3 text-center">
                      {c('Field')}
                    </th>
                    <th scope="col" className="p-3 text-center">
                      {c('Previous')}
                    </th>
                    <th scope="col" className="p-3 text-center">
                      {c('Requested')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {(['name', 'phone', 'address'] as const).map((field) => (
                    <tr
                      key={field}
                      className={
                        change.before[field] !== change.proposed[field]
                          ? 'bg-teal-50/50 dark:bg-teal-500/5'
                          : ''
                      }
                    >
                      <th scope="row" className="p-3 font-semibold">
                        {c(
                          field === 'name'
                            ? 'Name'
                            : field === 'phone'
                              ? 'Phone Number'
                              : 'Delivery Address',
                        )}
                      </th>
                      <td
                        className={`break-words p-3 whitespace-pre-wrap ${change.before[field] !== change.proposed[field] ? 'bg-rose-50/70 font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : ''}`}
                      >
                        {change.before[field] || '—'}
                      </td>
                      <td
                        className={`break-words p-3 whitespace-pre-wrap ${change.before[field] !== change.proposed[field] ? 'bg-emerald-50/70 font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : ''}`}
                      >
                        {change.proposed[field] || '—'}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="p-3">
                      {c('Profile Photo')}
                    </th>
                    <td
                      className={`p-3 ${change.before.photoId !== change.proposed.photoId ? 'bg-rose-50/70 dark:bg-rose-500/10' : ''}`}
                    >
                      <ProfileAvatar
                        photoId={change.before.photoId}
                        name={change.before.name}
                        className="h-16 w-16"
                      />
                    </td>
                    <td
                      className={`p-3 ${change.before.photoId !== change.proposed.photoId ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : ''}`}
                    >
                      <ProfileAvatar
                        photoId={change.proposed.photoId}
                        name={change.proposed.name}
                        className="h-16 w-16"
                      />
                    </td>
                  </tr>
                  {change.passwordChanged && (
                    <tr>
                      <th scope="row" className="p-3">
                        {c('Password')}
                      </th>
                      <td className="bg-rose-50/70 p-3 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        ••••••••
                      </td>
                      <td className="bg-emerald-50/70 p-3 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {c('A new password was requested. Passwords are never displayed.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {change.passwordChanged && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                {c(
                  'An approved password change signs out all sessions. Sign in again using the new password.',
                )}
              </p>
            )}
            {change.feedback && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                <p className="mb-2 text-sm font-bold">{c('Review Feedback')}</p>
                <p className="whitespace-pre-wrap break-words text-sm">{c(change.feedback)}</p>
              </div>
            )}
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <BadgeCheck aria-hidden="true" className="h-4 w-4" />
              {change.reviewedBy
                ? c('Reviewed by {{name}}', { name: change.reviewedBy })
                : c('Waiting for an administrator')}
              {change.reviewedByEmail && (
                <span className="break-all">({change.reviewedByEmail})</span>
              )}
              {change.reviewedBy && !change.reviewedByEmail && (
                <span>{c('Reviewer email was not recorded for this earlier notification.')}</span>
              )}
            </p>
          </>
        )
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {c(error)}
        </p>
      )}
      {readError && change?.unread && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-rose-700 dark:text-rose-300"
        >
          <p>{c(readError)}</p>
          <button
            type="button"
            className={secondaryButton}
            onClick={() =>
              void read(change, false)
                .then(() => setReadError(undefined))
                .catch((cause: unknown) =>
                  setReadError(
                    cause instanceof Error ? cause.message : 'Unable to update this notification.',
                  ),
                )
            }
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            {c('Mark as Read')}
          </button>
        </div>
      )}
      {rejecting && (
        <RejectModal
          busy={pending}
          error={error}
          onClose={() => setRejecting(false)}
          onConfirm={(feedback) => void review({ decision: 'REJECT', feedback })}
        />
      )}
    </Modal>
  );
}

const rejectionSchema = z.object({
  feedback: z
    .string()
    .trim()
    .min(3, 'Explain why this request is rejected')
    .max(1000, 'Use at most 1000 characters'),
});
function RejectModal({
  busy,
  error,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (feedback: string) => void;
}) {
  const c = useCopy();
  const form = useZodForm(rejectionSchema, { feedback: '' }, 'profile-rejection');
  return (
    <Modal
      title={c('Reject Profile Changes')}
      icon={MessageSquareX}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" disabled={busy} onClick={onClose} className={secondaryButton}>
            <X aria-hidden="true" className="h-4 w-4" />
            {c('Cancel')}
          </button>
          <button type="submit" form="reject-profile-form" disabled={busy} className={dangerButton}>
            {busy ? <Spinner /> : <Check aria-hidden="true" className="h-4 w-4" />}
            {c('Confirm Rejection')}
          </button>
        </>
      }
    >
      <form
        id="reject-profile-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const values = form.validate(event.currentTarget);
          if (values) onConfirm(values.feedback);
        }}
        className="space-y-3"
      >
        <label htmlFor="profile-rejection-feedback" className="block text-sm font-semibold">
          {c('Reason for Rejection')}
        </label>
        <textarea
          {...form.field('feedback')}
          disabled={busy}
          rows={5}
          maxLength={1000}
          className={formInput}
        />
        <FieldError id="profile-rejection-feedback-error" message={form.errors.feedback} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {c('This feedback will be included in the user’s notification.')}
        </p>
        {error && (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {c(error)}
          </p>
        )}
      </form>
    </Modal>
  );
}
