import { useState, type InputHTMLAttributes } from 'react';
import { Link, useLocation, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import {
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  UserRole,
} from '@kitchentodoor/shared';
import { z } from '@kitchentodoor/shared/zod';
import {
  UserRound,
  ArrowRight,
  CheckCircle2,
  UserRoundPlus,
  Mail,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useZodForm } from '../hooks/useZodForm';
import { api, ApiError } from '../lib/api';
import { FieldError } from '../components/forms/FieldError';
import { Spinner } from '../components/layout/Loading';
import { safeReturnTo, roleHome, canOpenPage } from '../lib/access';
import type { AuthResponse } from '@kitchentodoor/shared';

const RegisterFormSchema = RegisterSchema.omit({ role: true })
  .extend({ confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
const inputClass =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const buttonClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60';

function AccountField({
  label,
  error,
  field,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  field: InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={field.id} className="block text-sm font-semibold">
        {label}
      </label>
      <input {...field} {...props} className={inputClass} />
      <FieldError id={`${field.id}-error`} message={error} />
    </div>
  );
}

function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          {success}
        </p>
      )}
    </>
  );
}

function useAfterSignIn() {
  const router = useRouter();
  const search = useSearch({ from: '/account' });
  return (auth: AuthResponse) => {
    const target = safeReturnTo(search.redirect);
    const path = target?.split(/[?#]/)[0] || '';
    router.history.push(
      target && canOpenPage(path, auth.user.role) ? target : roleHome(auth.user.role),
    );
  };
}

function SignInForm() {
  const complete = useAfterSignIn();
  const search = useSearch({ from: '/account' });
  const form = useZodForm(LoginSchema, { email: '', password: '' }, 'customer-login');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      aria-busy={pending}
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const element = event.currentTarget;
        const values = form.validate(element);
        if (!values) return;
        setPending(true);
        setError(null);
        try {
          complete(await api.auth.login(values.email, values.password));
        } catch (cause) {
          if (cause instanceof ApiError)
            form.setServerErrors(
              cause.status === 401
                ? { password: 'Check your email and password.' }
                : cause.fieldErrors,
              element,
            );
          setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');
        } finally {
          setPending(false);
        }
      }}
    >
      <Feedback error={error} />
      <AccountField
        label="Email address"
        type="email"
        autoComplete="username"
        spellCheck={false}
        disabled={pending}
        field={form.field('email')}
        error={form.errors.email}
      />
      <AccountField
        label="Password"
        type="password"
        autoComplete="current-password"
        disabled={pending}
        field={form.field('password')}
        error={form.errors.password}
      />
      <Link
        to="/account/forgot"
        className="inline-block text-sm font-semibold text-teal-800 underline dark:text-teal-200"
      >
        Forgot Password?
      </Link>
      <button disabled={pending} className={buttonClass}>
        {pending ? <Spinner /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
        {pending ? 'Signing In…' : 'Sign In'}
      </button>
      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        New to KitchenToDoor?{' '}
        <Link
          to="/account/register"
          search={search}
          className="font-bold text-teal-800 underline dark:text-teal-200"
        >
          Create an Account
        </Link>
      </p>
    </form>
  );
}

function RegisterForm() {
  const complete = useAfterSignIn();
  const search = useSearch({ from: '/account' });
  const form = useZodForm(
    RegisterFormSchema,
    { name: '', email: '', phone: '', password: '', confirmPassword: '' },
    'register',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      aria-busy={pending}
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const element = event.currentTarget;
        const values = form.validate(element);
        if (!values) return;
        setPending(true);
        setError(null);
        try {
          complete(
            await api.auth.register(values.name, values.email, values.password, values.phone),
          );
        } catch (cause) {
          if (cause instanceof ApiError)
            form.setServerErrors(
              cause.status === 409
                ? { email: 'An account already uses this email. Sign in or reset your password.' }
                : cause.fieldErrors,
              element,
            );
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to create your account. Please try again.',
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <Feedback error={error} />
      <AccountField
        label="Full name"
        autoComplete="name"
        disabled={pending}
        field={form.field('name')}
        error={form.errors.name}
      />
      <AccountField
        label="Email address"
        type="email"
        autoComplete="email"
        spellCheck={false}
        disabled={pending}
        field={form.field('email')}
        error={form.errors.email}
      />
      <AccountField
        label="Phone number"
        type="tel"
        autoComplete="tel"
        disabled={pending}
        field={form.field('phone')}
        error={form.errors.phone}
      />
      <AccountField
        label="Password"
        type="password"
        autoComplete="new-password"
        disabled={pending}
        field={form.field('password')}
        error={form.errors.password}
      />
      <AccountField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        disabled={pending}
        field={form.field('confirmPassword')}
        error={form.errors.confirmPassword}
      />
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Use at least 8 characters. A longer, unique password is best.
      </p>
      <button disabled={pending} className={buttonClass}>
        {pending ? <Spinner /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
        {pending ? 'Creating Account…' : 'Create Account'}
      </button>
      <p className="text-center text-sm">
        <Link
          to="/account"
          search={search}
          className="font-semibold text-teal-800 underline dark:text-teal-200"
        >
          Already Have an Account? Sign In
        </Link>
      </p>
    </form>
  );
}

function ForgotForm() {
  const form = useZodForm(ForgotPasswordSchema, { email: '' }, 'forgot');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  return (
    <form
      noValidate
      aria-busy={pending}
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const values = form.validate(event.currentTarget);
        if (!values) return;
        setPending(true);
        setError(null);
        try {
          await api.auth.forgotPassword(values.email);
          setSuccess(true);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to request a reset. Please contact the kitchen.',
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Enter your account email. If it matches an account, you’ll receive a link to choose a new
        password.
      </p>
      <Feedback
        error={error}
        success={
          success
            ? 'Check your inbox and spam folder. If no email arrives, contact the kitchen for help.'
            : null
        }
      />
      <AccountField
        label="Email address"
        type="email"
        autoComplete="email"
        spellCheck={false}
        disabled={pending}
        field={form.field('email')}
        error={form.errors.email}
      />
      <button disabled={pending} className={buttonClass}>
        {pending ? <Spinner /> : <Mail aria-hidden="true" className="h-4 w-4" />}
        {pending ? 'Requesting Link…' : 'Send Reset Link'}
      </button>
      <Link
        to="/account"
        className="inline-block text-sm font-bold text-teal-800 underline dark:text-teal-200"
      >
        Back to Sign In
      </Link>
    </form>
  );
}

function ResetForm() {
  const hash = useLocation({ select: (location) => location.hash });
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token') || '';
  const form = useZodForm(
    ResetPasswordSchema,
    { token, password: '', confirmPassword: '' },
    'reset',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  return (
    <form
      noValidate
      aria-busy={pending}
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || success) return;
        const values = form.validate(event.currentTarget);
        if (!values) return;
        setPending(true);
        setError(null);
        try {
          await api.auth.resetPassword(values.token, values.password, values.confirmPassword);
          setSuccess(true);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to reset your password. Request a new link.',
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <Feedback
        error={error || form.errors.token}
        success={
          success ? 'Your password has been changed. Sign in again with your new password.' : null
        }
      />
      {!success && (
        <>
          <AccountField
            label="New password"
            type="password"
            autoComplete="new-password"
            disabled={pending}
            field={form.field('password')}
            error={form.errors.password}
          />
          <AccountField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            disabled={pending}
            field={form.field('confirmPassword')}
            error={form.errors.confirmPassword}
          />
          <button disabled={pending || !token} className={buttonClass}>
            {pending ? <Spinner /> : <KeyRound aria-hidden="true" className="h-4 w-4" />}
            {pending ? 'Saving Password…' : 'Save New Password'}
          </button>
        </>
      )}
      <div className="flex flex-wrap justify-between gap-3 text-sm font-bold text-teal-800 underline dark:text-teal-200">
        <Link to="/account">Sign In</Link>
        <Link to="/account/forgot">Request a New Link</Link>
      </div>
    </form>
  );
}

export function AccountPage() {
  const path = useLocation({ select: (location) => location.pathname });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const reset = path.endsWith('/reset');
  const forgot = path.endsWith('/forgot');
  const register = path.endsWith('/register');
  const title = reset
    ? 'Choose a New Password'
    : forgot
      ? 'Reset Your Password'
      : user
        ? `Welcome, ${user.name}`
        : register
          ? 'Create Your Account'
          : 'Welcome Back';
  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <UserRound
          aria-hidden="true"
          className="mx-auto mb-4 h-10 w-10 text-teal-700 dark:text-teal-300"
        />
        <h1 className="font-display text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Your favorites, orders, and delivery updates in one place.
        </p>
      </div>
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        {reset ? (
          <ResetForm />
        ) : forgot ? (
          <ForgotForm />
        ) : user ? (
          <div className="space-y-5">
            <p className="break-words text-sm text-slate-600 dark:text-slate-300">
              Signed in as {user.email}
            </p>
            {user.role !== UserRole.ADMIN && (
              <Link to="/orders" className={buttonClass}>
                {user.role === UserRole.COURIER ? 'My Deliveries' : 'View Your Orders'}
              </Link>
            )}
            {user.role === UserRole.ADMIN && (
              <>
                <Link to="/dispatch" className={buttonClass}>
                  Open Dispatch
                </Link>
                <Link to="/users" className={buttonClass}>
                  Manage Users
                </Link>
              </>
            )}
            {user.role === UserRole.COURIER && (
              <Link to="/courier" className={buttonClass}>
                Available Deliveries
              </Link>
            )}
            <button
              onClick={() => {
                void logout();
                void navigate({ to: '/account' });
              }}
              className="w-full rounded-xl border border-rose-300 p-3 text-sm font-bold text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950"
            >
              <LogOut aria-hidden="true" className="inline h-4 w-4 mr-2" /> Sign Out Everywhere
            </button>
          </div>
        ) : register ? (
          <RegisterForm />
        ) : (
          <SignInForm />
        )}
      </div>
    </section>
  );
}
