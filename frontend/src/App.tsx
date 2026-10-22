import { useCopy } from './lib/i18n';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useRouter } from '@tanstack/react-router';
import { UserRole } from '@kitchentodoor/shared';
import { Navbar, NavigationDrawer } from './components/layout/Navbar';
import { AppActionsContext } from './components/layout/AppActionsContext';
import { useAuth } from './hooks/useAuth';
import { useCart } from './hooks/useCart';
import { useDesktopLayout } from './hooks/useDesktopLayout';
import { PageSkeleton, LoadingState } from './components/layout/Loading';
import { PageMetadata } from './components/layout/PageMetadata';
import { Breadcrumbs } from './components/layout/Breadcrumbs';
import { useNavigationDrawer } from './hooks/useNavigationDrawer';
import { SessionNotice } from './components/auth/SessionNotice';
import { AuthLoadingOverlay } from './components/auth/AuthLoadingOverlay';
import { authStore } from './lib/authSession';

const CartDrawer = lazy(() =>
  import('./components/customer/CartDrawer').then((m) => ({ default: m.CartDrawer })),
);
const CheckoutModal = lazy(() =>
  import('./components/customer/CheckoutModal').then((m) => ({ default: m.CheckoutModal })),
);
const AdminLoginModal = lazy(() =>
  import('./components/admin/AdminLoginModal').then((m) => ({ default: m.AdminLoginModal })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const loadingPanel = <PageSkeleton />;

export function App() {
  const c = useCopy();

  const { user, isAuthenticated, logout } = useAuth();
  const cart = useCart(user?.id);
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useNavigationDrawer();
  const desktop = useDesktopLayout();
  const leaveGuard = useRef<(() => Promise<boolean>) | null>(null);
  useEffect(
    () =>
      router.subscribe('onResolved', ({ fromLocation, toLocation }) => {
        if (fromLocation?.href !== toLocation.href) setProfileOpen(false);
      }),
    [router],
  );
  useEffect(
    () =>
      authStore.subscribe((next, previous) => {
        if (next.user?.id === previous.user?.id) return;
        setProfileOpen(false);
        setCheckoutOpen(false);
        setCartOpen(false);
        setAdminLoginOpen(false);
      }),
    [],
  );
  const registerLeaveGuard = useCallback((guard: () => Promise<boolean>) => {
    leaveGuard.current = guard;
    return () => {
      if (leaveGuard.current === guard) leaveGuard.current = null;
    };
  }, []);
  function signOut() {
    void (async () => {
      if (leaveGuard.current && !(await leaveGuard.current())) return;
      void logout();
      void navigate({ to: '/' });
    })();
  }
  function closeNavigation() {
    setNavigationOpen(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>('header button[aria-controls="site-navigation"]')
        ?.focus(),
    );
  }

  return (
    <AppActionsContext
      value={{
        addToCart: cart.add,
        updateCartQuantity: cart.updateQuantity,
        getCartQuantity: cart.quantity,
        openStaffLogin: () => setAdminLoginOpen(true),
        openProfile: () => setProfileOpen(true),
        registerLeaveGuard,
      }}
    >
      <PageMetadata />
      <AuthLoadingOverlay />
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:text-slate-900"
        >
          {c('Skip to Content')}{' '}
        </a>
        <Navbar
          cartCount={cart.items.reduce((sum, item) => sum + item.quantity, 0)}
          onOpenCart={() => setCartOpen(true)}
          isAuthenticatedAdmin={isAuthenticated}
          onLogoutAdmin={signOut}
          navigationOpen={navigationOpen}
          onToggleNavigation={() => setNavigationOpen((previous) => !previous)}
          onOpenProfile={() => setProfileOpen(true)}
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
          <footer className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-slate-600 dark:text-slate-300">
            <p>{c('KitchenToDoor © 2026. Real-Time Order Lifecycle & Telemetry Platform.')}</p>
          </footer>
        </div>
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40">
              <div className="glass-panel rounded-2xl">
                <LoadingState label={c('Opening…')} />
              </div>
            </div>
          }
        >
          {cartOpen && (
            <CartDrawer
              isOpen={cartOpen}
              onClose={() => setCartOpen(false)}
              items={cart.items}
              onUpdateQuantity={cart.updateQuantity}
              onRemoveItem={cart.remove}
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
              cartItems={cart.items}
              onOrderSuccess={(orderId) => {
                cart.clear();
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
          {profileOpen && isAuthenticated && <ProfilePage onClose={() => setProfileOpen(false)} />}
        </Suspense>
      </div>
    </AppActionsContext>
  );
}
