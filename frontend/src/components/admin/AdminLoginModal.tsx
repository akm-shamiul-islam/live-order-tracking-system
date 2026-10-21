import { useState } from 'react';
import { Spinner } from '../layout/Loading';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../hooks/useDialog';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { ApiError } from '../../lib/api';
import { LoginSchema, UserRole } from '@kitchentodoor/shared';
import { X, Shield, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole) => void;
}

export function AdminLoginModal({ isOpen, onClose, onLoginSuccess }: AdminLoginModalProps) {
  const { login, logout } = useAuth();
  const form = useZodForm(LoginSchema, { email: '', password: '' }, 'staff');
  const [showPassword, setShowPassword] = useState(false);
  const dialogRef = useDialog(isOpen);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const formElement = e.currentTarget;
    const values = form.validate(formElement);
    if (!values) return;
    setLoading(true);

    try {
      const result = await login(values.email, values.password);
      if (result.user.role !== UserRole.ADMIN && result.user.role !== UserRole.COURIER) {
        void logout();
        setError('This sign-in is for kitchen staff and couriers. Please use your staff account.');
        return;
      }
      setError(null);
      onLoginSuccess(result.user.role);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        form.setServerErrors(
          {
            email: 'Check the email address for your staff account.',
            password: 'Email or password is incorrect. Please try again.',
          },
          formElement,
        );
      } else {
        if (err instanceof ApiError) form.setServerErrors(err.fieldErrors, formElement);
        setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="staff-login-title"
      aria-describedby="staff-login-description"
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-0 bg-transparent backdrop:bg-slate-950/70 backdrop:backdrop-blur-xs"
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="staff-login-title"
                className="font-display font-extrabold text-lg text-slate-900 dark:text-slate-100"
              >
                Staff Sign In
              </h2>
              <p
                id="staff-login-description"
                className="text-xs text-slate-500 dark:text-slate-400"
              >
                For kitchen dispatchers and delivery couriers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Close sign-in"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            id="staff-login-error"
            className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          noValidate
          onSubmit={handleSubmit}
          aria-busy={loading}
          aria-describedby={error ? 'staff-login-error' : undefined}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="staff-email"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                {...form.field('email')}
                autoComplete="username"
                spellCheck={false}
                disabled={loading}
                required
                placeholder="admin@kitchentodoor.io"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
              />
            </div>
            <FieldError id="staff-email-error" message={form.errors.email} />
          </div>

          <div>
            <label
              htmlFor="staff-password"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                {...form.field('password')}
                autoComplete="current-password"
                disabled={loading}
                required
                placeholder="Enter password"
                className="w-full pl-10 pr-12 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1.5 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <FieldError id="staff-password-error" message={form.errors.password} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 py-3 rounded-xl font-display font-bold text-sm bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white transition shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Spinner /> : <Shield aria-hidden="true" className="h-4 w-4" />}
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
      </div>
    </dialog>
  );
}
