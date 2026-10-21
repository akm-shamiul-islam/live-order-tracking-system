import { useCopy } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Pencil, Search, Users, X, RefreshCw, Save } from 'lucide-react';
import {
  ROLE_LABELS,
  UpdateUserSchema,
  UserRoleSchema,
  paginate,
  type ManagedUser,
  type UserRole,
} from '@kitchentodoor/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useDialog } from '../hooks/useDialog';
import { useZodForm } from '../hooks/useZodForm';
import { ThemedSelect } from '../components/forms/ThemedSelect';
import { FieldError } from '../components/forms/FieldError';
import { Pagination } from '../components/layout/Pagination';
import { Spinner, TableSkeleton } from '../components/layout/Loading';
import { IconAction } from '../components/ui/IconAction';

const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
const profileSchema = UpdateUserSchema.pick({ name: true, email: true, phone: true }).required();
const inputClass =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900';
const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60';

function EditUserModal({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const c = useCopy();

  const { user: actor } = useAuth();
  const dialog = useDialog(true);
  const queryClient = useQueryClient();
  const form = useZodForm(
    profileSchema,
    { name: user.name, email: user.email, phone: user.phone || '' },
    'edit-user',
  );
  const [role, setRole] = useState<UserRole>(user.role);
  const [disabled, setDisabled] = useState(user.disabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const self = actor?.id === user.id;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="edit-user-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <form
        noValidate
        aria-busy={pending}
        className="space-y-5 p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const element = event.currentTarget;
          const values = form.validate(element);
          if (!values) return;
          setPending(true);
          setError(undefined);
          try {
            await api.users.update(user.id, {
              ...values,
              role,
              disabled,
              expectedUpdatedAt: user.updatedAt,
            });
            await Promise.all(
              ['users', 'couriers', 'admin-orders'].map((key) =>
                queryClient.invalidateQueries({ queryKey: [key] }),
              ),
            );
            if (self) await api.auth.getMe().catch(() => undefined);
            onClose();
          } catch (cause) {
            if (cause instanceof ApiError) form.setServerErrors(cause.fieldErrors, element);
            setError(cause instanceof Error ? cause.message : 'Unable to save this user.');
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="edit-user-title" className="font-display text-xl font-bold">
            {c('Edit User')}{' '}
          </h2>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            aria-label={c('Close user editor')}
            className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {c(error)}
          </p>
        )}
        {(['name', 'email', 'phone'] as const).map((field) => (
          <div key={field} className="space-y-2">
            <label htmlFor={`edit-user-${field}`} className="block text-sm font-semibold">
              {field === 'name'
                ? c('Full name')
                : field === 'email'
                  ? c('Email address')
                  : c('Phone number')}
            </label>
            <input
              {...form.field(field)}
              type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
              autoComplete="off"
              disabled={pending}
              className={inputClass}
            />
            <FieldError id={`edit-user-${field}-error`} message={form.errors[field]} />
          </div>
        ))}
        <div className="space-y-2">
          <p className="text-sm font-semibold">{c('Role')}</p>
          <ThemedSelect
            label={c('User role')}
            value={role}
            options={roleOptions}
            disabled={pending || self}
            onChange={(value) => {
              const parsed = UserRoleSchema.safeParse(value);
              if (parsed.success) setRole(parsed.data);
            }}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">{c('Account Status')}</p>
          <ThemedSelect
            label={c('Account Status')}
            value={disabled ? 'disabled' : 'active'}
            disabled={pending || self}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            onChange={(value) => setDisabled(value === 'disabled')}
          />
        </div>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {self ? c('Your own administrator access stays active. ') : ''}
          {c(
            'Changing email, role, or account access signs the affected user out. Reassign active deliveries before removing a courier’s access.',
          )}{' '}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            {c('Cancel')}{' '}
          </button>
          <button disabled={pending} className={buttonClass}>
            {pending ? <Spinner /> : <Save aria-hidden="true" className="h-4 w-4" />}
            {pending ? c('Saving…') : c('Save Changes')}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function UserFilters({ q, role }: { q: string; role: 'ALL' | UserRole }) {
  const c = useCopy();

  const navigate = useNavigate({ from: '/users' });
  const [search, setSearch] = useState(q);
  const [selected, setSelected] = useState(role);
  return (
    <form
      className="glass-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        void navigate({
          search: (previous) => ({ ...previous, q: search.trim(), role: selected, page: 1 }),
        });
      }}
    >
      <ThemedSelect
        label={c('Filter users by role')}
        value={selected}
        options={[{ value: 'ALL', label: 'All Roles' }, ...roleOptions]}
        onChange={(value) => {
          if (value === 'ALL') setSelected(value);
          else {
            const parsed = UserRoleSchema.safeParse(value);
            if (parsed.success) setSelected(parsed.data);
          }
        }}
      />
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-11 w-11 p-3.5 text-slate-500"
        />
        <label htmlFor="users-search" className="sr-only">
          {c('Search users by name, email, or phone')}{' '}
        </label>
        <input
          id="users-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={100}
          placeholder={c('Search name, email, or phone…')}
          className={`${inputClass} pl-11`}
        />
      </div>
      <button className={buttonClass}>
        <Search aria-hidden="true" className="h-4 w-4" />
        {c('Search Users')}{' '}
      </button>
    </form>
  );
}

export function UsersPage() {
  const c = useCopy();

  const { page, size, q, role } = useSearch({ from: '/staff/users' });
  const navigate = useNavigate({ from: '/users' });
  const [editing, setEditing] = useState<ManagedUser>();
  const result = useQuery({
    queryKey: ['users', page, size, q, role],
    queryFn: () => api.users.list(page, size, q, role === 'ALL' ? undefined : role),
  });
  const pagination = result.data?.pagination ?? paginate(0, page, size);
  const resolvedPage = result.data?.pagination.page;
  useEffect(() => {
    if (resolvedPage !== undefined && resolvedPage !== page)
      void navigate({ search: (previous) => ({ ...previous, page: resolvedPage }), replace: true });
  }, [resolvedPage, page, navigate]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display flex items-center gap-3 text-2xl font-extrabold">
            <Users aria-hidden="true" className="h-7 w-7 text-teal-700 dark:text-teal-300" />
            {c('Users')}{' '}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {c('Manage customer accounts, courier access, and administrators.')}{' '}
          </p>
        </div>
        <button
          onClick={() => void result.refetch()}
          disabled={result.isFetching}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold dark:border-slate-600"
        >
          {result.isFetching ? <Spinner /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
          {c('Refresh')}{' '}
        </button>
      </div>
      <UserFilters key={`${q}:${role}`} q={q} role={role} />
      {result.error ? (
        <div role="alert" className="glass-panel rounded-2xl p-6 text-rose-800 dark:text-rose-200">
          {c(result.error.message)}
          <button
            onClick={() => void result.refetch()}
            className="ml-3 inline-flex items-center gap-2 font-bold underline"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {c('Try Again')}{' '}
          </button>
        </div>
      ) : (
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[800px] text-left text-sm">
            <caption className="sr-only">{c('Registered users and account access')}</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                {['Name', 'Email', 'Phone', 'Role', 'Account', 'Actions'].map((label) => (
                  <th key={label} scope="col" className="px-5 py-4 text-center">
                    {c(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {result.isLoading ? (
                <TableSkeleton columns={6} />
              ) : result.data?.users.length ? (
                result.data.users.map((user) => (
                  <tr key={user.id} className="hover:bg-teal-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-bold">{user.name}</td>
                    <td className="px-5 py-4">{user.email}</td>
                    <td className="px-5 py-4 text-center">{user.phone || '—'}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-bold text-teal-900 dark:bg-teal-500/10 dark:text-teal-200">
                        {c(ROLE_LABELS[user.role])}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {user.disabled ? c('Disabled') : c('Active')}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <IconAction
                        onClick={() => setEditing(user)}
                        aria-label={c('Edit {{name}}', { name: user.name })}
                        icon={Pencil}
                        label={c('Edit User')}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-600 dark:text-slate-300">
                    {c('No users match these filters.')}{' '}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
      )}
      {editing && (
        <EditUserModal key={editing.id} user={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
