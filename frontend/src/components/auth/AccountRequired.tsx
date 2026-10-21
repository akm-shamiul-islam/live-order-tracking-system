import { useCopy } from '../../lib/i18n';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { LockKeyhole, UserRound, LogIn, UserRoundPlus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { canOpenPage } from '../../lib/access';

export function AccountRequired({ children }: { children?: ReactNode }) {
  const c = useCopy();

  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  if (isAuthenticated && canOpenPage(location.pathname, user?.role)) return children ?? <Outlet />;
  return (
    <section
      className="glass-panel mx-auto max-w-lg space-y-4 rounded-3xl p-8 text-center"
      aria-labelledby="account-required-title"
    >
      <LockKeyhole
        aria-hidden="true"
        className="mx-auto h-10 w-10 text-teal-700 dark:text-teal-300"
      />
      <h1 id="account-required-title" className="font-display text-2xl font-bold">
        {isAuthenticated ? c('Access Restricted') : c('Sign In to Continue')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {isAuthenticated
          ? c(
              'Your account does not have access to this workspace. Contact an administrator if your role needs to change.',
            )
          : c('Sign in or create a customer account to place orders and view your deliveries.')}
      </p>
      {isAuthenticated ? (
        <Link
          to="/account"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800"
        >
          <UserRound aria-hidden="true" className="h-4 w-4" />
          {c('My Account')}{' '}
        </Link>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/account"
            search={{ redirect: location.href }}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800"
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            {c('Sign In')}{' '}
          </Link>
          <Link
            to="/account/register"
            search={{ redirect: location.href }}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-600 px-5 py-3 text-sm font-bold text-teal-800 dark:text-teal-200"
          >
            <UserRoundPlus aria-hidden="true" className="h-4 w-4" />
            {c('Create Account')}{' '}
          </Link>
        </div>
      )}
    </section>
  );
}
