import { Outlet } from '@tanstack/react-router';
import { useAuth } from '../../hooks/useAuth';
import { useAppActions } from '../layout/AppActionsContext';

export function StaffOnly() {
  const { isAdmin, isCourier } = useAuth();
  const { openStaffLogin } = useAppActions();
  if (isAdmin || isCourier) return <Outlet />;
  return (
    <section
      className="glass-panel rounded-2xl p-8 text-center"
      aria-labelledby="staff-access-title"
    >
      <h1 id="staff-access-title" className="font-display text-xl font-bold">
        Staff Sign In Required
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Sign in with your kitchen or courier account to open this page.
      </p>
      <button
        onClick={openStaffLogin}
        className="mt-4 rounded-xl bg-teal-600 px-5 py-2 font-bold text-white hover:bg-teal-700"
      >
        Staff Sign In
      </button>
    </section>
  );
}
