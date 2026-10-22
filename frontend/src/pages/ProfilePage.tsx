import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  CheckCircle2,
  ClipboardList,
  LockKeyhole,
  PencilLine,
  Save,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react';
import { RegisterSchema, UserRole, type ProfileResponse } from '@kitchentodoor/shared';
import { z } from '@kitchentodoor/shared/zod';
import { api, ApiError } from '../lib/api';
import { clearSession, getSession, saveSession } from '../lib/authSession';
import { useCopy } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import { useZodForm } from '../hooks/useZodForm';
import { LoadingState, PageSkeleton, Spinner } from '../components/layout/Loading';
import { ProfilePhotoUploader } from '../components/profile/ProfilePhotoUploader';
import { FieldError } from '../components/forms/FieldError';
import {
  dangerButton,
  formInput,
  primaryButton,
  secondaryButton,
} from '../components/ui/formStyles';
import { ProfileChangeModal } from '../components/notifications/ProfileChangeModal';
import { Modal } from '../components/ui/Modal';
import { useUnsavedProfileChanges } from '../hooks/useUnsavedProfileChanges';

const profileFormSchema = z
  .object({
    name: RegisterSchema.shape.name,
    phone: z.union([RegisterSchema.shape.phone, z.literal('')]),
    address: RegisterSchema.shape.address.default(''),
    currentPassword: z.string(),
    password: z.union([z.literal(''), RegisterSchema.shape.password]),
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    if (value.password && !value.currentPassword)
      context.addIssue({
        code: 'custom',
        path: ['currentPassword'],
        message: 'Enter your current password to change it',
      });
    if (value.password !== value.confirmPassword)
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    if (!value.password && (value.currentPassword || value.confirmPassword))
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Enter a new password or clear the password fields',
      });
  });

export function ProfilePage({ onClose }: { onClose?: () => void } = {}) {
  const c = useCopy();
  const { user } = useAuth();
  const [message, setMessage] = useState<string>();
  const result = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => api.profile.get(),
    // Fetch the current revision before starting a new draft, even if the header
    // populated a still-fresh cache entry during an earlier visit.
    refetchOnMount: 'always',
    // A background focus refresh must not replace a profile draft while it is being edited.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (result.isLoading || !result.isFetchedAfterMount)
    return onClose ? (
      <Modal title={c('Profile')} icon={UserRound} maxWidth="max-w-5xl" onClose={onClose}>
        <LoadingState label={c('Loading profile…')} />
      </Modal>
    ) : (
      <PageSkeleton label={c('Loading profile…')} />
    );
  if (result.error)
    return onClose ? (
      <Modal title={c('Profile')} icon={UserRound} maxWidth="max-w-5xl" onClose={onClose}>
        <p role="alert" className="glass-panel rounded-2xl p-6 text-rose-700 dark:text-rose-300">
          {c(result.error.message)}
        </p>
      </Modal>
    ) : (
      <p role="alert" className="glass-panel rounded-2xl p-6 text-rose-700 dark:text-rose-300">
        {c(result.error.message)}
      </p>
    );
  if (!result.data) return null;
  const form = (
    <ProfileForm
      key={`${result.data.user.id}:${result.data.user.profileVersion ?? 0}:${result.data.pending?.id ?? ''}`}
      profile={result.data}
      message={message}
      onSaved={setMessage}
      onRequestClose={onClose}
    />
  );
  if (onClose) return form;
  return (
    <section className="w-full space-y-6">
      <div>
        <h1 className="font-display flex items-center gap-3 text-2xl font-extrabold">
          <UserRound aria-hidden="true" className="h-7 w-7 text-teal-700 dark:text-teal-300" />
          {c('Profile')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {c('Manage your personal details, delivery address and profile photo.')}
        </p>
      </div>
      {form}
    </section>
  );
}

function ProfileForm({
  profile,
  message,
  onSaved,
  onRequestClose,
}: {
  profile: ProfileResponse;
  message?: string;
  onSaved: (message: string) => void;
  onRequestClose?: () => void;
}) {
  const c = useCopy();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { user, pending: pendingChange } = profile;
  const form = useZodForm(
    profileFormSchema,
    {
      name: user.name,
      phone: user.phone || '',
      address: user.address || '',
      currentPassword: '',
      password: '',
      confirmPassword: '',
    },
    'profile',
  );
  const [photo, setPhoto] = useState<string | null>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [viewing, setViewing] = useState(false);
  const disabled = pending || !!pendingChange;
  const dirty =
    !pendingChange &&
    (form.values.name !== user.name ||
      form.values.phone !== (user.phone || '') ||
      form.values.address !== (user.address || '') ||
      !!form.values.currentPassword ||
      !!form.values.password ||
      !!form.values.confirmPassword ||
      (photo !== undefined && (photo !== null || !!user.photoId)));
  const unsaved = useUnsavedProfileChanges(user.id, dirty, pending);
  async function requestClose() {
    if (onRequestClose && (await unsaved.ask())) onRequestClose();
  }
  const resetDraft = () => {
    form.reset();
    setPhoto(undefined);
    setError(undefined);
  };
  const editor = (
    <>
      {onRequestClose && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {c('Manage your personal details, delivery address and profile photo.')}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          {c(message)}
        </p>
      )}
      {pendingChange && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-600/40 dark:bg-amber-500/10">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {c('Your profile changes are awaiting administrator approval.')}
          </p>
          <button type="button" onClick={() => setViewing(true)} className={secondaryButton}>
            <ClipboardList aria-hidden="true" className="h-4 w-4" />
            {c('View Request')}
          </button>
        </div>
      )}
      <form
        noValidate
        className="glass-panel space-y-6 rounded-3xl p-5 sm:p-7"
        aria-busy={pending}
        onSubmit={async (event) => {
          event.preventDefault();
          if (disabled || !unsaved.dirty) return;
          const element = event.currentTarget;
          const values = form.validate(element);
          if (!values) return;
          setPending(true);
          setError(undefined);
          try {
            const result = await api.profile.update({
              name: values.name,
              phone: values.phone,
              address: values.address,
              ...(photo !== undefined ? { photo } : {}),
              ...(values.password
                ? { password: values.password, currentPassword: values.currentPassword }
                : {}),
              expectedProfileVersion: user.profileVersion ?? 0,
            });
            if (getSession().user?.id !== user.id) return;
            unsaved.markSaved();
            if (result.change.status === 'APPROVED' && values.password) {
              clearSession();
              void navigate({ to: '/account' });
              return;
            }
            const token = getSession().token;
            if (token) saveSession({ accessToken: token, user: result.profile.user });
            onSaved(
              result.change.status === 'APPROVED'
                ? 'Your profile has been updated.'
                : 'Your profile changes were submitted for administrator review.',
            );
            client.setQueryData(['profile', user.id], result.profile);
            await client.invalidateQueries({ queryKey: ['notifications'] });
          } catch (cause) {
            if (cause instanceof ApiError) form.setServerErrors(cause.fieldErrors, element);
            setError(cause instanceof Error ? cause.message : 'Unable to update your profile.');
          } finally {
            setPending(false);
          }
        }}
      >
        <ProfilePhotoUploader
          name={form.values.name}
          photoId={pendingChange ? pendingChange.proposed.photoId : user.photoId}
          value={photo}
          onChange={setPhoto}
          disabled={disabled}
        />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 space-y-2">
            <label htmlFor="profile-name" className="block text-sm font-semibold">
              {c('Full Name')}
            </label>
            <input
              {...form.field('name')}
              type="text"
              autoComplete="name"
              disabled={disabled}
              className={formInput}
            />
            <FieldError id="profile-name-error" message={form.errors.name} />
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor="profile-email" className="block text-sm font-semibold">
              {c('Email Address')}
            </label>
            <input
              id="profile-email"
              value={user.email}
              readOnly
              type="email"
              aria-describedby="profile-email-help"
              className={formInput}
            />
            <p id="profile-email-help" className="text-xs text-slate-500 dark:text-slate-400">
              {c('Your email address can only be changed by an administrator.')}
            </p>
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor="profile-phone" className="block text-sm font-semibold">
              {c('Phone Number')}
            </label>
            <input
              {...form.field('phone')}
              type="tel"
              autoComplete="tel"
              disabled={disabled}
              className={formInput}
            />
            <FieldError id="profile-phone-error" message={form.errors.phone} />
          </div>
          <div className="col-span-full space-y-2">
            <label htmlFor="profile-address" className="block text-sm font-semibold">
              {c('Delivery Address')}
            </label>
            <textarea
              {...form.field('address')}
              autoComplete="street-address"
              rows={3}
              maxLength={500}
              disabled={disabled}
              className={formInput}
            />
            <FieldError id="profile-address-error" message={form.errors.address} />
          </div>
        </div>
        <fieldset
          disabled={disabled}
          className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 pb-5 pt-3 dark:border-slate-700 dark:bg-slate-800/20 sm:px-5"
        >
          <legend className="font-display flex items-center gap-2 px-2 text-base font-bold">
            <LockKeyhole aria-hidden="true" className="h-5 w-5 text-teal-600" />
            {c('Change Password')}
          </legend>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {c('Leave these fields empty to keep your current password.')}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {(['currentPassword', 'password', 'confirmPassword'] as const).map((field) => (
              <div key={field} className="space-y-2">
                <label htmlFor={`profile-${field}`} className="block text-sm font-semibold">
                  {c(
                    field === 'currentPassword'
                      ? 'Current Password'
                      : field === 'password'
                        ? 'New Password'
                        : 'Confirm New Password',
                  )}
                </label>
                <input
                  {...form.field(field)}
                  type="password"
                  autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'}
                  className={formInput}
                />
                <FieldError id={`profile-${field}-error`} message={form.errors[field]} />
              </div>
            ))}
          </div>
        </fieldset>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {c(
            user.role === UserRole.ADMIN
              ? 'Administrator profile changes are applied immediately and recorded in history.'
              : 'Changes remain inactive until an administrator approves them.',
          )}
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {c(error)}
          </p>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {unsaved.dirty && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400"
              />
              {c('Unsaved Changes')}
            </p>
          )}
          <div className="ml-auto flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              disabled={pending || (!onRequestClose && (disabled || !unsaved.dirty))}
              onClick={() => {
                if (onRequestClose) void requestClose();
                else void unsaved.ask();
              }}
              className={`${secondaryButton} w-full sm:w-auto`}
            >
              <X aria-hidden="true" className="h-4 w-4" />
              {c('Cancel')}
            </button>
            <button
              disabled={disabled || !unsaved.dirty}
              className={`${primaryButton} w-full sm:w-auto`}
            >
              {pending ? <Spinner /> : <Save aria-hidden="true" className="h-4 w-4" />}
              {c(user.role === UserRole.ADMIN ? 'Save Changes' : 'Submit for Approval')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
  return (
    <>
      {onRequestClose ? (
        <Modal
          title={c('Profile')}
          icon={UserRound}
          maxWidth="max-w-5xl"
          busy={pending}
          onClose={() => void requestClose()}
        >
          {editor}
        </Modal>
      ) : (
        <div className="space-y-5">{editor}</div>
      )}
      {unsaved.confirming && (
        <Modal
          title={c('Discard Unsaved Changes?')}
          icon={TriangleAlert}
          busy={pending}
          onClose={unsaved.keepEditing}
          footer={
            <>
              <button
                type="button"
                disabled={pending}
                className={secondaryButton}
                onClick={unsaved.keepEditing}
              >
                <PencilLine aria-hidden="true" className="h-4 w-4" />
                {c('Keep Editing')}
              </button>
              <button
                type="button"
                disabled={pending}
                className={dangerButton}
                onClick={() => {
                  resetDraft();
                  unsaved.discard();
                }}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {c('Discard Changes')}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {c('Your unsaved profile changes will be lost.')}
          </p>
          {pending && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-teal-800 dark:text-teal-200"
            >
              <Spinner />
              {c('Saving your profile changes…')}
            </p>
          )}
        </Modal>
      )}
      {viewing && pendingChange && (
        <ProfileChangeModal id={pendingChange.id} onClose={() => setViewing(false)} />
      )}
    </>
  );
}
