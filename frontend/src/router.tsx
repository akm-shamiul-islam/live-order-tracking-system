import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  stripSearchParams,
} from '@tanstack/react-router';
import { App } from './App';
import { StaffOnly } from './components/auth/StaffOnly';
import { AccountRequired } from './components/auth/AccountRequired';
import {
  MenuSearchSchema,
  DispatchSearchSchema,
  HistorySearchSchema,
  UsersSearchSchema,
} from './lib/listSearch';
import { safeReturnTo } from './lib/access';
import { z } from '@kitchentodoor/shared/zod';
import { PageSkeleton } from './components/layout/Loading';
import { MenuPage } from './pages/MenuPage';
import { RefreshCw } from 'lucide-react';

function NotFoundPage() {
  return (
    <section className="glass-panel rounded-2xl p-12 text-center">
      <h1 className="font-display text-2xl font-bold">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-500">Check the address or return to the food menu.</p>
      <Link
        to="/"
        className="mt-4 inline-block font-bold text-teal-700 underline dark:text-teal-400"
      >
        Open Food Menu
      </Link>
    </section>
  );
}

const rootRoute = createRootRoute({ component: App, notFoundComponent: NotFoundPage });
const HistoryComponent = lazyRouteComponent(
  () => import('./components/customer/OrderHistory'),
  'OrderHistory',
);
const menuRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: MenuSearchSchema,
  search: { middlewares: [stripSearchParams({ category: 'all', page: 1, size: 8 })] },
  component: MenuPage,
});
const trackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tracking',
  component: AccountRequired,
});
const trackingIndexRoute = createRoute({
  getParentRoute: () => trackingRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./pages/TrackingPage'), 'TrackingPage'),
});
const trackingOrderRoute = createRoute({
  getParentRoute: () => trackingRoute,
  path: '$orderId',
  component: lazyRouteComponent(() => import('./pages/TrackingPage'), 'TrackingPage'),
});
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'orders',
  validateSearch: HistorySearchSchema,
  search: { middlewares: [stripSearchParams({ page: 1, size: 10, q: '' })] },
  component: () => (
    <AccountRequired>
      <HistoryComponent />
    </AccountRequired>
  ),
});
const staffRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'staff',
  component: StaffOnly,
});
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'account',
  component: Outlet,
  validateSearch: z.object({ redirect: z.unknown().optional().transform(safeReturnTo) }),
});
const accountComponent = lazyRouteComponent(() => import('./pages/AccountPage'), 'AccountPage');
const accountIndexRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/',
  component: accountComponent,
});
const accountRegisterRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'register',
  component: accountComponent,
});
const accountForgotRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'forgot',
  component: accountComponent,
});
const accountResetRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'reset',
  component: accountComponent,
});
const dispatchRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: 'dispatch',
  validateSearch: DispatchSearchSchema,
  search: { middlewares: [stripSearchParams({ status: 'ALL', q: '', page: 1, size: 10 })] },
  component: lazyRouteComponent(
    () => import('./components/admin/AdminOrdersTable'),
    'AdminOrdersTable',
  ),
});
const courierRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: 'courier',
  component: Outlet,
});
const courierIndexRoute = createRoute({
  getParentRoute: () => courierRoute,
  path: '/',
  validateSearch: HistorySearchSchema,
  search: { middlewares: [stripSearchParams({ page: 1, size: 10, q: '' })] },
  component: lazyRouteComponent(() => import('./pages/CourierDashboard'), 'CourierDashboard'),
});
const usersRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: 'users',
  validateSearch: UsersSearchSchema,
  search: { middlewares: [stripSearchParams({ page: 1, size: 10, q: '', role: 'ALL' })] },
  component: lazyRouteComponent(() => import('./pages/UsersPage'), 'UsersPage'),
});
const courierOrderRoute = createRoute({
  getParentRoute: () => courierRoute,
  path: '$orderId',
  component: lazyRouteComponent(() => import('./pages/TrackingPage'), 'CourierPage'),
});

export const routeTree = rootRoute.addChildren([
  menuRoute,
  trackingRoute.addChildren([trackingIndexRoute, trackingOrderRoute]),
  historyRoute,
  accountRoute.addChildren([
    accountIndexRoute,
    accountRegisterRoute,
    accountForgotRoute,
    accountResetRoute,
  ]),
  staffRoute.addChildren([
    dispatchRoute,
    usersRoute,
    courierRoute.addChildren([courierIndexRoute, courierOrderRoute]),
  ]),
]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPendingComponent: PageSkeleton,
  defaultErrorComponent: ({ reset }) => (
    <section role="alert" className="glass-panel rounded-2xl p-8 text-center">
      <h1 className="font-display text-xl font-bold">This Page Could Not Be Loaded</h1>
      <p className="mt-2 text-sm text-slate-500">Check your connection and try again.</p>
      <button
        onClick={reset}
        className="mt-4 inline-flex items-center gap-2 font-bold text-teal-700 underline"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Try Again
      </button>
    </section>
  ),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
