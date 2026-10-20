import { useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { useTheme } from '../../hooks/useTheme';
import { ConnectionBadge } from '../tracking/ConnectionBadge';
import {
  Sun,
  Moon,
  Utensils,
  Navigation,
  Clock,
  Shield,
  ShoppingBag,
  Menu as MenuIcon,
  X,
  Bike,
} from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenAdminLogin: () => void;
  isAuthenticatedAdmin: boolean;
  onLogoutAdmin: () => void;
}

export function Navbar({
  cartCount,
  onOpenCart,
  onOpenAdminLogin,
  isAuthenticatedAdmin,
  onLogoutAdmin,
}: NavbarProps) {
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = useLocation({ select: (location) => location.pathname });

  const navItems = [
    { to: '/', label: 'Order Food', icon: Utensils },
    { to: '/tracking', label: 'Live Tracking', icon: Navigation },
    { to: '/orders', label: 'My Orders', icon: Clock },
    { to: '/courier', label: 'Courier Telemetry', icon: Bike },
    { to: '/dispatch', label: 'Dispatch Station', icon: Shield },
  ] as const;

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          onClick={handleNavClick}
          className="flex items-center gap-2.5 text-left group transition transform hover:scale-[1.02] shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition">
            <span className="text-xl">🍳</span>
          </div>
          <div>
            <div className="font-display font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 dark:from-emerald-400 dark:via-teal-300 dark:to-sky-400 bg-clip-text text-transparent whitespace-nowrap">
              KitchenToDoor
            </div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Live Order Telemetry
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Main navigation"
          className="hidden xl:flex items-center gap-0.5 lg:gap-1.5 shrink-0"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.to || (item.to !== '/' && pathname.startsWith(`${item.to}/`));
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === '/' }}
                onClick={handleNavClick}
                className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60 font-medium'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 shrink-0">
          {/* Real-time Socket Connection Badge */}
          <div className="hidden sm:block">
            <ConnectionBadge />
          </div>

          {/* Cart Trigger */}
          <button
            onClick={onOpenCart}
            className="relative p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 transition cursor-pointer shadow-xs shrink-0"
            title="View Cart"
            aria-label={`View cart, ${cartCount} items`}
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-[11px] rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center shadow-md shadow-emerald-600/30">
                {cartCount}
              </span>
            )}
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 transition cursor-pointer shadow-xs shrink-0"
            aria-label="Toggle dark mode"
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-teal-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* Admin Login / Logout */}
          {isAuthenticatedAdmin ? (
            <button
              onClick={onLogoutAdmin}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:text-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 dark:hover:bg-rose-900/50 dark:hover:text-rose-100 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={onOpenAdminLogin}
              className="group hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 hover:text-teal-950 border border-teal-200 hover:border-teal-300 dark:bg-slate-800 dark:text-teal-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-teal-100 dark:hover:border-teal-500/50 transition cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              <Shield className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 group-hover:text-teal-900 dark:group-hover:text-teal-200 transition-colors" />
              <span>Staff Sign In</span>
            </button>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 shrink-0"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="xl:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top duration-200"
        >
          <div className="flex justify-between items-center py-2 px-3 mb-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Connection Status
            </span>
            <ConnectionBadge />
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.to || (item.to !== '/' && pathname.startsWith(`${item.to}/`));
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === '/' }}
                onClick={handleNavClick}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 font-bold'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            {isAuthenticatedAdmin ? (
              <button
                onClick={() => {
                  onLogoutAdmin();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 dark:hover:bg-rose-900/50 dark:hover:text-rose-100 transition cursor-pointer"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => {
                  onOpenAdminLogin();
                  setMobileMenuOpen(false);
                }}
                className="group w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 hover:text-teal-950 border border-teal-200 dark:bg-slate-800 dark:text-teal-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-teal-100 transition cursor-pointer"
              >
                <Shield className="w-4 h-4 text-teal-700 dark:text-teal-400 group-hover:text-teal-900 dark:group-hover:text-teal-200 transition-colors" />
                <span>Staff Sign In</span>
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
