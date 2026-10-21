import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import {
  Sun,
  Moon,
  Utensils,
  Navigation,
  Clock,
  Shield,
  ShoppingBag,
  Menu,
  X,
  Bike,
  ChevronRight,
  LogOut,
  ArrowUpRight,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { UserRole } from '@kitchentodoor/shared';
import { useAuth } from '../../hooks/useAuth';
import { canOpenPage } from '../../lib/access';
import { useTheme } from '../../hooks/useTheme';
import { useDialog } from '../../hooks/useDialog';
import { useIdleReady } from '../../hooks/useIdleReady';
import { Spinner } from './Loading';
const ConnectionBadge = lazy(() =>
  import('../tracking/ConnectionBadge').then((module) => ({ default: module.ConnectionBadge })),
);

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  isAuthenticatedAdmin: boolean;
  onLogoutAdmin: () => void;
  navigationOpen: boolean;
  onToggleNavigation: () => void;
}

const navigationItems = [
  {
    to: '/',
    label: 'Order Food',
    description: 'Something delicious awaits',
    icon: Utensils,
    section: 'Your account',
  },
  {
    to: '/tracking',
    label: 'Live Tracking',
    description: 'Follow your delivery',
    icon: Navigation,
    section: 'Your account',
  },
  {
    to: '/orders',
    label: 'My Orders',
    description: 'Your recent orders',
    icon: Clock,
    section: 'Your account',
  },
  {
    to: '/account',
    label: 'My Account',
    description: 'Profile and sign-in options',
    icon: UserRound,
    section: 'Your account',
  },
  {
    to: '/courier',
    label: 'Available Deliveries',
    description: 'Request a delivery assignment',
    icon: Bike,
    section: 'Delivery workspace',
  },
  {
    to: '/dispatch',
    label: 'Dispatch Station',
    description: 'Manage the kitchen queue',
    icon: Shield,
    section: 'Administration',
  },
  {
    to: '/users',
    label: 'Users',
    description: 'Manage profiles and roles',
    icon: UsersRound,
    section: 'Administration',
  },
] as const;

export function Navbar({
  cartCount,
  onOpenCart,
  isAuthenticatedAdmin,
  onLogoutAdmin,
  navigationOpen,
  onToggleNavigation,
}: NavbarProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const livePage = ['/tracking', '/courier', '/dispatch'].some((prefix) =>
    pathname.startsWith(prefix),
  );
  const liveReady = useIdleReady(livePage && isAuthenticatedAdmin);
  const { isDark, toggleTheme } = useTheme();
  const iconButton =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700/80 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10 dark:hover:text-teal-200';
  return (
    <header className="glass-panel sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onToggleNavigation}
            className={iconButton}
            aria-label={navigationOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navigationOpen}
            aria-controls="site-navigation"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-700 text-xl shadow-md shadow-emerald-500/15 sm:flex"
              aria-hidden="true"
            >
              🍳
            </span>
            <span className="min-w-0">
              <span className="font-display block truncate bg-gradient-to-r from-emerald-700 to-sky-600 bg-clip-text text-lg font-extrabold tracking-tight text-transparent sm:text-xl dark:from-emerald-400 dark:to-sky-400">
                KitchenToDoor
              </span>
              <span className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300 sm:block">
                Fresh food. Live updates.
              </span>
            </span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {livePage && isAuthenticatedAdmin && (
            <div className="hidden md:block">
              <Suspense
                fallback={
                  <span role="status" className="text-xs text-slate-600 dark:text-slate-300">
                    Connecting…
                  </span>
                }
              >
                {liveReady ? (
                  <ConnectionBadge />
                ) : (
                  <span
                    role="status"
                    className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <Spinner /> Connecting…
                  </span>
                )}
              </Suspense>
            </div>
          )}
          <button
            type="button"
            onClick={onOpenCart}
            className={`${iconButton} relative`}
            aria-label={`View cart, ${cartCount} items`}
          >
            <ShoppingBag aria-hidden="true" className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950">
                {cartCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className={iconButton}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? (
              <Sun aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Moon aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={
              isAuthenticatedAdmin
                ? onLogoutAdmin
                : () => {
                    void navigate({ to: '/account' });
                  }
            }
            className={`hidden h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-colors sm:inline-flex ${isAuthenticatedAdmin ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40' : 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-700/40 dark:bg-teal-500/10 dark:text-teal-200 dark:hover:bg-teal-500/20'}`}
          >
            {isAuthenticatedAdmin ? (
              <LogOut aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Shield aria-hidden="true" className="h-4 w-4" />
            )}
            {isAuthenticatedAdmin ? 'Sign Out' : 'Sign In / Register'}
          </button>
        </div>
      </div>
    </header>
  );
}

export function NavigationDrawer({
  open,
  desktop,
  onClose,
  isStaff,
  onStaffAction,
}: {
  open: boolean;
  desktop: boolean;
  onClose: () => void;
  isStaff: boolean;
  onStaffAction: () => void;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { user } = useAuth();
  const visibleItems = navigationItems.filter((item) => canOpenPage(item.to, user?.role));
  const dialogRef = useDialog(open && !desktop);
  const content = (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-5 dark:border-slate-800">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-400">
            KitchenToDoor
          </span>
          <h2
            id="navigation-title"
            className="font-display mt-1 text-xl font-extrabold text-slate-900 dark:text-white"
          >
            Explore
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation drawer"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <nav
        id="site-navigation"
        aria-label="Main navigation"
        className="flex-1 space-y-2 overflow-y-auto p-3.5"
      >
        {(['Your account', 'Delivery workspace', 'Administration'] as const).map((section) => {
          const items = visibleItems.filter((item) => item.section === section);
          if (!items.length) return null;
          return (
            <div key={section} className="space-y-2 pb-3">
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                {section}
              </p>
              {items.map(({ to, label, description, icon: Icon }) => {
                const active = pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
                return (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: to === '/', includeSearch: false }}
                    onClick={() => {
                      if (!desktop) onClose();
                    }}
                    className={`group flex items-center gap-3 rounded-2xl border p-3 transition-colors ${active ? 'border-teal-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-teal-800 dark:border-teal-500/25 dark:from-emerald-500/15 dark:to-teal-500/10 dark:text-teal-200' : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'}`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-teal-700 text-white shadow-sm shadow-teal-600/15 dark:bg-teal-400/15 dark:text-teal-300' : 'bg-slate-100 text-slate-400 group-hover:text-teal-600 dark:bg-slate-800 dark:group-hover:text-teal-300'}`}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold">
                        {to === '/orders' && user?.role === UserRole.COURIER
                          ? 'My Deliveries'
                          : label}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">
                        {to === '/orders' && user?.role === UserRole.COURIER
                          ? 'Your approved delivery assignments'
                          : description}
                      </span>
                    </span>
                    {active && (
                      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-teal-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="m-3.5 mt-auto rounded-2xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-500/15 dark:bg-teal-500/5">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Shield aria-hidden="true" className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          {isStaff ? `Welcome, ${user?.name || 'back'}` : 'Your next meal awaits'}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {isStaff
            ? 'Your workspace follows your account access.'
            : 'Create an account to order and track your delivery.'}
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onStaffAction();
          }}
          className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
        >
          {isStaff ? 'Sign Out' : 'Sign In / Register'}
          {isStaff ? (
            <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </>
  );
  if (desktop)
    return (
      <aside
        inert={!open}
        aria-hidden={!open}
        aria-labelledby="navigation-title"
        className={`navigation-sidebar ${open ? 'is-open' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        {content}
      </aside>
    );
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="navigation-title"
      className="navigation-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX > bounds.right || event.clientX < bounds.left) onClose();
        }
      }}
    >
      <div className="flex h-full flex-col">{content}</div>
    </dialog>
  );
}
