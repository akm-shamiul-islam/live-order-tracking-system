import { lazy, Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { UserRole } from '@kitchentodoor/shared';
import { Navbar, NavigationDrawer } from './components/layout/Navbar';
import { AppActionsContext } from './components/layout/AppActionsContext';
import type { MenuItem } from './components/customer/MenuCatalog';
import type { CartItem } from './components/customer/CartDrawer';
import { useAuth } from './hooks/useAuth';
import { useDesktopLayout } from './hooks/useDesktopLayout';
import { PageSkeleton, LoadingState } from './components/layout/Loading';
import { PageMetadata } from './components/layout/PageMetadata';
import { Breadcrumbs } from './components/layout/Breadcrumbs';
import { useNavigationDrawer } from './hooks/useNavigationDrawer';
import { SessionNotice } from './components/auth/SessionNotice';

const CartDrawer = lazy(() =>
  import('./components/customer/CartDrawer').then((m) => ({ default: m.CartDrawer })),
);
const CheckoutModal = lazy(() =>
  import('./components/customer/CheckoutModal').then((m) => ({ default: m.CheckoutModal })),
);
const AdminLoginModal = lazy(() =>
  import('./components/admin/AdminLoginModal').then((m) => ({ default: m.AdminLoginModal })),
);
const loadingPanel = <PageSkeleton />;

export function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useNavigationDrawer();
  const desktop = useDesktopLayout();
  function signOut() {
    void logout();
    void navigate({ to: '/' });
  }
  function closeNavigation() {
    setNavigationOpen(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>('header button[aria-controls="site-navigation"]')
        ?.focus(),
    );
  }

  function addToCart(item: MenuItem) {
    setCart((previous) => {
      if (previous.some((entry) => entry.id === item.id)) {
        return previous.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: Math.min(99, entry.quantity + 1) } : entry,
        );
      }
      return [...previous, { ...item, quantity: 1 }];
    });
  }

  return (
    <AppActionsContext value={{ addToCart, openStaffLogin: () => setAdminLoginOpen(true) }}>
      <PageMetadata />
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:text-slate-900"
        >
          Skip to Content
        </a>
        <Navbar
          cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
          onOpenCart={() => setCartOpen(true)}
          isAuthenticatedAdmin={isAuthenticated}
          onLogoutAdmin={signOut}
          navigationOpen={navigationOpen}
          onToggleNavigation={() => setNavigationOpen((previous) => !previous)}
        />
        <SessionNotice />
        <NavigationDrawer
          open={navigationOpen}
          desktop={desktop}
          onClose={closeNavigation}
          isStaff={isAuthenticated}
          onStaffAction={
            isAuthenticated
              ? signOut
              : () => {
                  void navigate({ to: '/account' });
                }
          }
        />
        <div
          className={`app-content flex min-w-0 flex-1 flex-col ${navigationOpen ? 'navigation-is-open' : ''}`}
        >
          <main
            id="main-content"
            tabIndex={-1}
            className="route-page flex-1 min-w-0 w-full px-4 sm:px-6 lg:px-8 py-8"
          >
            <Breadcrumbs />
            <Suspense fallback={loadingPanel}>
              <Outlet />
            </Suspense>
          </main>
          <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-600 dark:text-slate-300">
            <p>KitchenToDoor © 2026. Real-Time Order Lifecycle & Telemetry Platform.</p>
          </footer>
        </div>
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40">
              <div className="glass-panel rounded-2xl">
                <LoadingState label="Opening…" />
              </div>
            </div>
          }
        >
          {cartOpen && (
            <CartDrawer
              isOpen={cartOpen}
              onClose={() => setCartOpen(false)}
              items={cart}
              onUpdateQuantity={(id, delta) =>
                setCart((previous) =>
                  previous
                    .map((item) =>
                      item.id === id
                        ? { ...item, quantity: Math.min(99, item.quantity + delta) }
                        : item,
                    )
                    .filter((item) => item.quantity > 0),
                )
              }
              onRemoveItem={(id) =>
                setCart((previous) => previous.filter((item) => item.id !== id))
              }
              onProceedToCheckout={() => {
                setCartOpen(false);
                if (isAuthenticated) setCheckoutOpen(true);
                else void navigate({ to: '/account', search: { redirect: '/' } });
              }}
            />
          )}
          {checkoutOpen && isAuthenticated && (
            <CheckoutModal
              key={user?.id}
              isOpen={checkoutOpen}
              onClose={() => setCheckoutOpen(false)}
              cartItems={cart}
              onOrderSuccess={(orderId) => {
                setCart([]);
                setCheckoutOpen(false);
                void navigate({ to: '/tracking/$orderId', params: { orderId } });
              }}
            />
          )}
          {adminLoginOpen && (
            <AdminLoginModal
              isOpen={adminLoginOpen}
              onClose={() => setAdminLoginOpen(false)}
              onLoginSuccess={(role) => {
                // Preserve shared staff URLs, including the selected courier order.
                if (pathname === '/dispatch' || pathname.startsWith('/courier')) return;
                void navigate({ to: role === UserRole.COURIER ? '/courier' : '/dispatch' });
              }}
            />
          )}
        </Suspense>
      </div>
    </AppActionsContext>
  );
}
