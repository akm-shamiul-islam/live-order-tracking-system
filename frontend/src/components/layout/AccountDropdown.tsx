import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LogOut, UserRoundPen } from 'lucide-react';
import { UserRole } from '@kitchentodoor/shared';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { useCopy } from '../../lib/i18n';
import { Tooltip } from '../ui/Tooltip';
import { ProfileAvatar } from '../profile/ProfileAvatar';

export function AccountDropdown({
  onOpenProfile,
  onSignOut,
}: {
  onOpenProfile: () => void;
  onSignOut: () => void;
}) {
  const c = useCopy();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const profile = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => api.profile.get(),
    enabled: !!user,
    // This cache is shared with the profile editor. A focus/reconnect refresh must
    // not replace an unsaved draft when an administrator has updated the account.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const photoId = profile.data
    ? profile.data.pending
      ? profile.data.pending.proposed.photoId
      : profile.data.user.photoId
    : user?.photoId;

  useEffect(() => {
    if (!open) return undefined;
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [open]);

  if (!user) return null;
  const role =
    user.role === UserRole.ADMIN
      ? 'Admin'
      : user.role === UserRole.COURIER
        ? 'Courier'
        : 'Customer';

  return (
    <div ref={root} className="relative">
      <Tooltip label={c('Open Account Menu')} triggerRef={trigger}>
        <button
          type="button"
          aria-label={c('Open Account Menu')}
          aria-expanded={open}
          aria-controls="account-menu"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal-300 bg-teal-50 p-0.5 shadow-sm ring-2 ring-transparent transition-all hover:border-teal-500 hover:ring-teal-500/20 focus-visible:outline-none focus-visible:ring-teal-500/40 dark:border-teal-700 dark:bg-slate-800 dark:hover:border-teal-400"
        >
          <ProfileAvatar
            photoId={photoId}
            name={user.name}
            className="h-full w-full rounded-full border-0 bg-transparent text-teal-700 dark:text-teal-200"
          />
        </button>
      </Tooltip>
      <div
        id="account-menu"
        role="region"
        aria-label={c('Account details')}
        aria-hidden={!open}
        inert={!open}
        className={`absolute right-0 top-[calc(100%+0.65rem)] z-[60] w-[min(22rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 transition duration-150 dark:border-slate-700 dark:bg-slate-900 ${open ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible -translate-y-1 scale-[.98] opacity-0'}`}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-5 text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
          <ProfileAvatar photoId={photoId} name={user.name} className="h-16 w-16 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-base font-extrabold" title={user.name}>
              {user.name}
            </p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-400" title={user.email}>
              {user.email}
            </p>
            <span className="mt-2 inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:border-teal-500/25 dark:bg-teal-500/10 dark:text-teal-200">
              {c(role)}
            </span>
          </div>
        </div>
        <div className="p-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenProfile();
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-teal-50 hover:text-teal-900 dark:text-slate-100 dark:hover:bg-teal-500/10 dark:hover:text-teal-100"
          >
            <UserRoundPen aria-hidden="true" className="h-5 w-5 text-teal-700 dark:text-teal-300" />
            {c('Profile')}
          </button>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" />
            {c('Sign Out')}
          </button>
        </div>
      </div>
    </div>
  );
}
