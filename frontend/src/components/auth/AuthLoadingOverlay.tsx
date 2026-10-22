import { useStore } from 'zustand';
import { Bike, ChefHat, ShieldCheck, ShoppingBag } from 'lucide-react';
import { authProgressStore } from '../../lib/authSession';
import { useCopy } from '../../lib/i18n';
import { useDialog } from '../../hooks/useDialog';
import { Spinner } from '../layout/Loading';

function Overlay({ action }: { action: 'login' | 'register' | 'logout' }) {
  const c = useCopy();
  const dialog = useDialog(true);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="auth-progress-title"
      aria-describedby="auth-progress-description"
      aria-busy="true"
      onCancel={(event) => event.preventDefault()}
      className="fixed inset-0 m-0 grid h-dvh max-h-none w-screen max-w-none place-items-center border-0 bg-slate-50/75 p-5 text-slate-900 backdrop:bg-slate-950/20 backdrop:backdrop-blur-md dark:bg-slate-950/75 dark:text-slate-100"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[10%] top-[15%] h-60 w-60 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute bottom-[10%] right-[10%] h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
      </div>
      <div
        role="status"
        aria-live="polite"
        className="glass-panel relative w-full max-w-sm rounded-[2rem] border border-white/60 p-9 text-center shadow-2xl shadow-teal-950/10 dark:border-slate-700/70"
      >
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-teal-500/20">
          <ChefHat aria-hidden="true" className="h-10 w-10" />
        </div>
        <p className="font-display text-xl font-extrabold">{c('KitchenToDoor')}</p>
        <Spinner className="mx-auto my-6 h-10 w-10 text-teal-700 dark:text-teal-300" />
        <h2 id="auth-progress-title" className="font-display text-lg font-bold">
          {c(
            action === 'logout'
              ? 'Signing Out…'
              : action === 'register'
                ? 'Creating Account…'
                : 'Signing In…',
          )}
        </h2>
        <p
          id="auth-progress-description"
          className="mt-2 text-sm text-slate-600 dark:text-slate-300"
        >
          {c('Please wait while we secure your session.')}
        </p>
        <div
          aria-hidden="true"
          className="mt-7 flex justify-center gap-5 text-teal-700/60 dark:text-teal-300/60"
        >
          <ShoppingBag className="h-5 w-5" />
          <ShieldCheck className="h-5 w-5" />
          <Bike className="h-5 w-5" />
        </div>
      </div>
    </dialog>
  );
}
export function AuthLoadingOverlay() {
  const action = useStore(authProgressStore, (state) => state.action);
  return action ? <Overlay action={action} /> : null;
}
