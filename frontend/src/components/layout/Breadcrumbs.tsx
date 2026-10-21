import { Link, useLocation } from '@tanstack/react-router';
import { ChevronRight, House } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

type Crumb = { label: string; to?: '/' | '/account' | '/orders' | '/tracking' | '/courier' };

export function Breadcrumbs() {
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, '') || '/',
  });
  const { isCourier } = useAuth();
  const orderLabel = isCourier ? 'My Deliveries' : 'My Orders';
  const crumbs: Crumb[] = [];
  if (pathname.startsWith('/tracking/'))
    crumbs.push({ label: orderLabel, to: '/orders' }, { label: 'Order Tracking' });
  else if (pathname.startsWith('/courier/'))
    crumbs.push({ label: 'Available Deliveries', to: '/courier' }, { label: 'Manage Delivery' });
  else if (pathname.startsWith('/account/')) {
    const accountLabels: Record<string, string> = {
      '/account/register': 'Register',
      '/account/forgot': 'Forgot Password',
      '/account/reset': 'Reset Password',
    };
    const label = accountLabels[pathname] ?? 'Page Not Found';
    crumbs.push({ label: 'My Account', to: '/account' }, { label });
  } else if (pathname !== '/') {
    const labels: Record<string, string> = {
      '/orders': orderLabel,
      '/tracking': 'Live Tracking',
      '/courier': 'Available Deliveries',
      '/dispatch': 'Dispatch Station',
      '/users': 'Users',
      '/account': 'My Account',
    };
    crumbs.push({ label: labels[pathname] ?? 'Page Not Found' });
  }
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 text-xs font-medium text-slate-600 dark:text-slate-300"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <li>
          <Link
            to="/"
            aria-current={pathname === '/' ? 'page' : undefined}
            className="inline-flex items-center gap-1.5 rounded-md hover:text-teal-800 dark:hover:text-teal-200"
          >
            <House aria-hidden="true" className="h-3.5 w-3.5" /> Food Menu
          </Link>
        </li>
        {crumbs.map((crumb, index) => (
          <li key={crumb.label} className="inline-flex items-center gap-2">
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="rounded-md hover:text-teal-800 dark:hover:text-teal-200"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                className="font-semibold text-slate-800 dark:text-slate-100"
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
