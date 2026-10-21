import { useStore } from 'zustand';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { logoutFeedbackStore } from '../../lib/authSession';
import { api } from '../../lib/api';

export function SessionNotice() {
  const { failed, pending } = useStore(logoutFeedbackStore);
  if (!failed && !pending) return null;
  return (
    <div
      role={failed ? 'alert' : 'status'}
      className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      {pending ? (
        <RefreshCw aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin" />
      ) : (
        <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
      )}
      <p className="flex-1 min-w-48">
        {pending
          ? 'You are signed out on this device. Signing out your other sessions…'
          : 'You are signed out on this device. We could not sign out your other sessions. Reconnect and try again.'}
      </p>
      {failed && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void api.auth.logout()}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-500 px-3 py-2 font-bold hover:bg-amber-100 disabled:opacity-50 dark:hover:bg-amber-900"
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />{' '}
          Retry Sign Out
        </button>
      )}
      {failed && (
        <button
          type="button"
          aria-label="Dismiss sign out warning"
          onClick={() => logoutFeedbackStore.setState({ failed: false })}
          className="rounded-lg p-2 hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
