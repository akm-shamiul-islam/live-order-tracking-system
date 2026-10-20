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
import { MenuSearchSchema, DispatchSearchSchema, HistorySearchSchema } from './lib/listSearch';

function NotFoundPage() {
  return (
    <section className="glass-panel rounded-2xl p-12 text-center">
      <h1 className="font-display text-2xl font-bold">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-500">Check the address or return to the food menu.</p>
      <Link
        to="/"
        className="mt-4 inline-block font-bold text-teal-600 underline dark:text-teal-400"
      >
        Open Food Menu
      </Link>
    </section>
  );
}

const rootRoute = createRootRoute({ component: App, notFoundComponent: NotFoundPage });
const menuRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: MenuSearchSchema,
  search: { middlewares: [stripSearchParams({ category: 'all', page: 1, size: 10 })] },
  component: lazyRouteComponent(() => import('./pages/MenuPage'), 'MenuPage'),
});
const trackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tracking',
  component: Outlet,
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
  search: { middlewares: [stripSearchParams({ page: 1, size: 10 })] },
  component: lazyRouteComponent(() => import('./components/customer/OrderHistory'), 'OrderHistory'),
});
const staffRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'staff',
  component: StaffOnly,
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
  component: lazyRouteComponent(() => import('./pages/TrackingPage'), 'CourierPage'),
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
  staffRoute.addChildren([
    dispatchRoute,
    courierRoute.addChildren([courierIndexRoute, courierOrderRoute]),
  ]),
]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPendingComponent: () => (
    <p role="status" className="p-8 text-center text-sm">
      Loading…
    </p>
  ),
  defaultErrorComponent: ({ reset }) => (
    <section role="alert" className="glass-panel rounded-2xl p-8 text-center">
      <h1 className="font-display text-xl font-bold">This Page Could Not Be Loaded</h1>
      <p className="mt-2 text-sm text-slate-500">Check your connection and try again.</p>
      <button onClick={reset} className="mt-4 font-bold text-teal-600 underline">
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
