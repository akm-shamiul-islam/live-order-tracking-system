import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { ArrowRight, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { useCopy } from '../../lib/i18n';
import { clientSettings } from '../../lib/clientSettings';
import { Tooltip } from '../ui/Tooltip';
import { NotificationList } from './NotificationList';
import { ProfileChangeModal } from './ProfileChangeModal';
import { LoadingState } from '../layout/Loading';

export function NotificationBell() {
  const c = useCopy();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>();
  const {
    refs: elements,
    floatingStyles,
    context,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    strategy: 'fixed',
    placement: 'bottom-end',
    middleware: [offset(10), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  const setReference = useCallback(
    (node: HTMLElement | null) => elements.setReference(node),
    [elements],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => elements.setFloating(node),
    [elements],
  );
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ]);
  const result = useQuery({
    queryKey: ['notifications', user?.id, 'dropdown'],
    queryFn: () => api.notifications.list({ view: 'dropdown' }),
    enabled: !!user,
    refetchInterval: clientSettings.VITE_NOTIFICATIONS_POLL_MS,
    refetchOnWindowFocus: true,
  });
  const { refetch } = result;
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);
  if (!user) return null;
  const count = result.data?.unreadCount ?? 0;
  return (
    <>
      <Tooltip label={c('Notifications')} triggerRef={setReference}>
        <button
          {...getReferenceProps()}
          type="button"
          aria-label={c('Notifications, {{count}} unread', { count })}
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700/80 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10 dark:hover:text-teal-200"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950"
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </Tooltip>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              {...getFloatingProps()}
              ref={setFloating}
              style={floatingStyles}
              aria-label={c('Notifications')}
              className="z-50 w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <h2 className="font-display font-bold">{c('Notifications')}</h2>
                <span className="text-xs text-teal-800 dark:text-teal-200">
                  {c('{{count}} unread', { count })}
                </span>
              </div>
              <div
                role="region"
                aria-label={c('Recent Notifications')}
                tabIndex={0}
                className="notification-scroll max-h-[min(65dvh,30rem)] overflow-y-auto overscroll-contain p-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
              >
                {result.isLoading ? (
                  <LoadingState />
                ) : result.error ? (
                  <p role="alert" className="p-3 text-sm text-rose-700 dark:text-rose-300">
                    {c(result.error.message)}
                  </p>
                ) : result.data?.notifications.length ? (
                  <NotificationList
                    notifications={result.data.notifications}
                    allowDismiss
                    onOpen={(id) => {
                      setSelected(id);
                      setOpen(false);
                    }}
                  />
                ) : (
                  <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {c('You have no notifications yet.')}
                  </p>
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 border-t border-slate-200 px-4 py-3 text-sm font-bold text-teal-800 transition-colors hover:bg-teal-50 dark:border-slate-700 dark:text-teal-200 dark:hover:bg-teal-500/10"
              >
                {c('View All Notifications')}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
      {selected && <ProfileChangeModal id={selected} onClose={() => setSelected(undefined)} />}
    </>
  );
}
