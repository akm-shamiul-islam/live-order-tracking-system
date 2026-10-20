import { lazy, Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { UserRole } from '@kitchentodoor/shared';
import { Navbar } from './components/layout/Navbar';
import { AppActionsContext } from './components/layout/AppActionsContext';
import type { MenuItem } from './components/customer/MenuCatalog';
import type { CartItem } from './components/customer/CartDrawer';
import { useAuth } from './hooks/useAuth';

const CartDrawer = lazy(() =>
  import('./components/customer/CartDrawer').then((m) => ({ default: m.CartDrawer })),
);
const CheckoutModal = lazy(() =>
  import('./components/customer/CheckoutModal').then((m) => ({ default: m.CheckoutModal })),
);
const AdminLoginModal = lazy(() =>
  import('./components/admin/AdminLoginModal').then((m) => ({ default: m.AdminLoginModal })),
);
const loadingPanel = (
  <p role="status" className="p-8 text-center text-sm text-slate-500">
    Loading…
  </p>
);

export function App() {
  const { isAdmin, isCourier, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);

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
          onOpenAdminLogin={() => setAdminLoginOpen(true)}
          isAuthenticatedAdmin={isAdmin || isCourier}
          onLogoutAdmin={() => {
            logout();
            void navigate({ to: '/' });
          }}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8"
        >
          <Suspense fallback={loadingPanel}>
            <Outlet />
          </Suspense>
        </main>
        <Suspense fallback={loadingPanel}>
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
                setCheckoutOpen(true);
              }}
            />
          )}
          {checkoutOpen && (
            <CheckoutModal
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
        <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400">
          <p>KitchenToDoor © 2026. Real-Time Order Lifecycle & Telemetry Platform.</p>
        </footer>
      </div>
    </AppActionsContext>
  );
}
