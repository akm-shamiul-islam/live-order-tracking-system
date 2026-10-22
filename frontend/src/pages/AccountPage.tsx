import { useCopy } from '../lib/i18n';
import { useState, type InputHTMLAttributes } from 'react';
import { Link, useLocation, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import {
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordFieldsSchema,
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
  PackageSearch,
  Truck,
  ClipboardList,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useZodForm } from '../hooks/useZodForm';
import { api, ApiError } from '../lib/api';
import { FieldError } from '../components/forms/FieldError';
import { Spinner } from '../components/layout/Loading';
import { ProfilePhotoUploader } from '../components/profile/ProfilePhotoUploader';
import { OtpVerificationForm } from '../components/auth/OtpVerificationForm';
import { safeReturnTo, roleHome, canOpenPage } from '../lib/access';
import type { AuthChallengeResponse, AuthResponse } from '@kitchentodoor/shared';
import { useAppActions } from '../components/layout/AppActionsContext';

const LoginFormSchema = LoginSchema.omit({ deviceId: true });
const RegisterFormSchema = RegisterSchema.omit({ role: true, photo: true })
  .extend({ address: RegisterSchema.shape.address.default(''), confirmPassword: z.string() })
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
  const c = useCopy();

  return (
    <div className="space-y-2">
      <label htmlFor={field.id} className="block text-sm font-semibold">
        {c(label)}
      </label>
      <input {...field} {...props} className={inputClass} />
      <FieldError id={`${field.id}-error`} message={c(error)} />
    </div>
  );
}

function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  const c = useCopy();

  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {c(error)}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          {c(success)}
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
  const c = useCopy();

  const complete = useAfterSignIn();
  const search = useSearch({ from: '/account' });
  const form = useZodForm(LoginFormSchema, { email: '', password: '' }, 'customer-login');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<AuthChallengeResponse | null>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  if (challenge)
    return (
      <div className="space-y-4">
        <OtpVerificationForm
          challenge={challenge}
          onComplete={(result) => {
            if (typeof result !== 'string') complete(result);
          }}
        />
        <button
          type="button"
          onClick={() => setChallenge(null)}
          className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 underline dark:text-slate-300"
        >
          {c('Back to Sign In')}
        </button>
      </div>
    );
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
          const result = await api.auth.login(values.email, values.password);
          if ('accessToken' in result) complete(result);
          else setChallenge(result);
        } catch (cause) {
          if (cause instanceof ApiError && cause.message.includes('Verify your email')) {
            setNeedsEmailVerification(true);
            setError(cause.message);
          } else if (cause instanceof ApiError)
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
      <Feedback error={c(error)} />
      {needsEmailVerification && (
        <button
          type="button"
          disabled={pending || !form.values.email}
          onClick={async () => {
            setPending(true);
            setError(null);
            try {
              setChallenge(await api.auth.requestEmailVerification(form.values.email));
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : 'The verification code could not be sent.',
              );
            } finally {
              setPending(false);
            }
          }}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-700 px-4 text-sm font-bold text-teal-800 transition hover:bg-teal-50 disabled:opacity-50 dark:border-teal-500 dark:text-teal-200 dark:hover:bg-teal-500/10"
        >
          <Mail aria-hidden="true" className="h-4 w-4" />
          {c('Resend Verification Code')}
        </button>
      )}
      <AccountField
        label={c('Email Address')}
        type="email"
        autoComplete="username"
        spellCheck={false}
        disabled={pending}
        field={form.field('email')}
        error={form.errors.email}
      />
      <AccountField
        label={c('Password')}
        type="password"
        autoComplete="current-password"
        disabled={pending}
        field={form.field('password')}
        error={form.errors.password}
      />
      <Link
        to="/account/forgot"
        search={search}
        className="inline-block text-sm font-semibold text-teal-800 underline dark:text-teal-200"
      >
        {c('Forgot Password?')}{' '}
      </Link>
      <button disabled={pending} className={buttonClass}>
        {pending ? <Spinner /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
        {pending ? c('Signing In…') : c('Sign In')}
      </button>
      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        {c('New to KitchenToDoor?')}{' '}
        <Link
          to="/account/register"
          search={search}
          className="font-bold text-teal-800 underline dark:text-teal-200"
        >
          {c('Create an Account')}{' '}
        </Link>
      </p>
    </form>
  );
}

function RegisterForm() {
  const c = useCopy();

  const complete = useAfterSignIn();
  const search = useSearch({ from: '/account' });
  const form = useZodForm(
    RegisterFormSchema,
    { name: '', email: '', phone: '', address: '', password: '', confirmPassword: '' },
    'register',
  );
  const [pending, setPending] = useState(false);
  const [photo, setPhoto] = useState<string | null>();
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<AuthChallengeResponse | null>(null);
  if (challenge)
    return (
      <div className="space-y-4">
        <OtpVerificationForm
          challenge={challenge}
          onComplete={(result) => {
            if (typeof result !== 'string') complete(result);
          }}
        />
        <button
          type="button"
          onClick={() => setChallenge(null)}
          className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 underline dark:text-slate-300"
        >
          {c('Back to Registration')}
        </button>
      </div>
    );
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
          const result = await api.auth.register(
            values.name,
            values.email,
            values.password,
            values.phone,
            values.address,
            photo || undefined,
          );
          if ('accessToken' in result) complete(result);
          else setChallenge(result);
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
      <Feedback error={c(error)} />
      <ProfilePhotoUploader
        name={form.values.name}
        value={photo}
        onChange={setPhoto}
        disabled={pending}
      />
      <AccountField
        label={c('Full Name')}
        autoComplete="name"
        disabled={pending}
        field={form.field('name')}
        error={form.errors.name}
      />
      <AccountField
        label={c('Email Address')}
        type="email"
        autoComplete="email"
        spellCheck={false}
        disabled={pending}
        field={form.field('email')}
        error={form.errors.email}
      />
      <AccountField
        label={c('Phone number')}
        type="tel"
        autoComplete="tel"
        disabled={pending}
        field={form.field('phone')}
        error={form.errors.phone}
      />
      <div className="space-y-2">
        <label htmlFor="register-address" className="block text-sm font-semibold">
          {c('Delivery address (optional)')}{' '}
        </label>
        <textarea
          {...form.field('address')}
          rows={3}
          autoComplete="street-address"
          maxLength={500}
          disabled={pending}
          aria-describedby={`register-address-help${form.errors.address ? ' register-address-error' : ''}`}
          placeholder={c('Street, apartment, city and postal code')}
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <p id="register-address-help" className="text-xs text-slate-600 dark:text-slate-300">
          {c('Saved for checkout. You can change it for any delivery.')}{' '}
        </p>
        <FieldError id="register-address-error" message={form.errors.address} />
      </div>
      <AccountField
        label={c('Password')}
        type="password"
        autoComplete="new-password"
        disabled={pending}
        field={form.field('password')}
        error={form.errors.password}
      />
      <AccountField
        label={c('Confirm password')}
        type="password"
        autoComplete="new-password"
        disabled={pending}
        field={form.field('confirmPassword')}
        error={form.errors.confirmPassword}
      />
      <p className="text-xs text-slate-600 dark:text-slate-300">
        {c('Use at least 8 characters. A longer, unique password is best.')}{' '}
      </p>
      <button disabled={pending} className={buttonClass}>
        {pending ? <Spinner /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
        {pending ? c('Creating Account…') : c('Create Account')}
      </button>
      <p className="text-center text-sm">
        <Link
          to="/account"
          search={search}
          className="font-semibold text-teal-800 underline dark:text-teal-200"
        >
          {c('Already Have an Account? Sign In')}{' '}
        </Link>
      </p>
    </form>
  );
}

function PasswordRecoveryFlow() {
  const c = useCopy();
  const navigate = useNavigate();
  const search = useSearch({ from: '/account' });
  const hash = useLocation({ select: (location) => location.hash });
  const tokenFromUrl = new URLSearchParams(hash.replace(/^#/, '')).get('token') || '';
  const emailForm = useZodForm(ForgotPasswordSchema, { email: '' }, 'forgot');
  const passwordForm = useZodForm(
    ResetPasswordFieldsSchema,
    { password: '', confirmPassword: '' },
    'reset',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<AuthChallengeResponse | null>(null);
  const [resetToken, setResetToken] = useState(tokenFromUrl);
  const [success, setSuccess] = useState(false);

  if (challenge && !resetToken)
    return (
      <div className="space-y-4">
        <OtpVerificationForm
          challenge={challenge}
          onComplete={(result) => {
            if (typeof result !== 'string') return;
            setResetToken(result);
            void navigate({
              to: '/account/reset',
              search,
              hash: `token=${encodeURIComponent(result)}`,
              replace: true,
            });
          }}
        />
        <button
          type="button"
          onClick={() => setChallenge(null)}
          className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 underline dark:text-slate-300"
        >
          {c('Use a Different Email Address')}
        </button>
      </div>
    );

  if (resetToken)
    return (
      <form
        noValidate
        aria-busy={pending}
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending || success) return;
          const values = passwordForm.validate(event.currentTarget);
          if (!values) return;
          setPending(true);
          setError(null);
          try {
            await api.auth.resetPassword(resetToken, values.password, values.confirmPassword);
            setSuccess(true);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to reset your password.');
          } finally {
            setPending(false);
          }
        }}
      >
        <Feedback
          error={error}
          success={
            success ? 'Your password has been changed. Sign in again with your new password.' : null
          }
        />
        {!success && (
          <>
            <AccountField
              label={c('New password')}
              type="password"
              autoComplete="new-password"
              disabled={pending}
              field={passwordForm.field('password')}
              error={passwordForm.errors.password}
            />
            <AccountField
              label={c('Confirm New Password')}
              type="password"
              autoComplete="new-password"
              disabled={pending}
              field={passwordForm.field('confirmPassword')}
              error={passwordForm.errors.confirmPassword}
            />
            <button disabled={pending} className={buttonClass}>
              {pending ? <Spinner /> : <KeyRound aria-hidden="true" className="h-4 w-4" />}
              {pending ? c('Saving Password…') : c('Save New Password')}
            </button>
          </>
        )}
        <div className="flex flex-wrap justify-between gap-3 text-sm font-bold text-teal-800 underline dark:text-teal-200">
          <Link to="/account" search={search}>
            {c('Sign In')}
          </Link>
          <Link to="/account/forgot" search={search}>
            {c('Request a New Code')}
          </Link>
        </div>
      </form>
    );

  return (
    <form
      noValidate
      aria-busy={pending}
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const values = emailForm.validate(event.currentTarget);
        if (!values) return;
        setPending(true);
        setError(null);
        try {
          const next = await api.auth.forgotPassword(values.email);
          setChallenge(next);
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
        {c(
          'Enter your account email. If it matches an account, a 6-digit code will be sent to your inbox.',
        )}{' '}
      </p>
      <Feedback
        error={error}
        success={
          challenge
            ? 'If an account matches that email, a verification code has been sent. Check your inbox and spam folder.'
            : null
        }
      />
      <AccountField
        label={c('Email Address')}
        type="email"
        autoComplete="email"
        spellCheck={false}
        disabled={pending || !!challenge}
        field={emailForm.field('email')}
        error={emailForm.errors.email}
      />
      <button disabled={pending || !!challenge} className={buttonClass}>
        {pending ? <Spinner /> : <Mail aria-hidden="true" className="h-4 w-4" />}
        {pending ? c('Requesting Code…') : c('Send Verification Code')}
      </button>
      <Link
        to="/account"
        className="inline-block text-sm font-bold text-teal-800 underline dark:text-teal-200"
      >
        {c('Back to Sign In')}{' '}
      </Link>
    </form>
  );
}

export function AccountPage() {
  const c = useCopy();

  const path = useLocation({ select: (location) => location.pathname });
  const hash = useLocation({ select: (location) => location.hash });
  const { user, logout } = useAuth();
  const { openProfile } = useAppActions();
  const navigate = useNavigate();
  const hasResetToken = Boolean(new URLSearchParams(hash.replace(/^#/, '')).get('token'));
  const reset = path.endsWith('/reset') && hasResetToken;
  const forgot = path.endsWith('/forgot') || (path.endsWith('/reset') && !hasResetToken);
  const register = path.endsWith('/register');
  const title = reset
    ? 'Choose a New Password'
    : forgot
      ? 'Reset Your Password'
      : user
        ? c('Welcome, {{name}}', { name: user.name })
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
        <h1 className="font-display text-3xl font-extrabold">{c(title)}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {c('Your favorites, orders, and delivery updates in one place.')}{' '}
        </p>
      </div>
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        {reset || forgot ? (
          <PasswordRecoveryFlow key={reset ? `reset:${hash}` : 'forgot'} />
        ) : user ? (
          <div className="space-y-5">
            <p className="break-words text-sm text-slate-600 dark:text-slate-300">
              {c('Signed in as')} {user.email}
            </p>
            <button type="button" onClick={openProfile} className={buttonClass}>
              <UserRound aria-hidden="true" className="h-4 w-4" />
              {c('Profile')}
            </button>
            {user.role !== UserRole.ADMIN && (
              <Link to="/orders" className={buttonClass}>
                <PackageSearch aria-hidden="true" className="inline h-4 w-4 mr-2" />
                {user.role === UserRole.COURIER ? c('My Deliveries') : c('View Your Orders')}
              </Link>
            )}
            {user.role === UserRole.ADMIN && (
              <>
                <Link to="/dispatch" className={buttonClass}>
                  <ClipboardList aria-hidden="true" className="inline h-4 w-4 mr-2" />
                  {c('Open Dispatch')}{' '}
                </Link>
                <Link to="/users" className={buttonClass}>
                  <Users aria-hidden="true" className="inline h-4 w-4 mr-2" />
                  {c('Manage Users')}{' '}
                </Link>
              </>
            )}
            {user.role === UserRole.COURIER && (
              <Link to="/courier" className={buttonClass}>
                <Truck aria-hidden="true" className="inline h-4 w-4 mr-2" />
                {c('Available Deliveries')}{' '}
              </Link>
            )}
            <button
              onClick={() => {
                void logout();
                void navigate({ to: '/account' });
              }}
              className="w-full rounded-xl border border-rose-300 p-3 text-sm font-bold text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950"
            >
              <LogOut aria-hidden="true" className="inline h-4 w-4 mr-2" />{' '}
              {c('Sign Out Everywhere')}{' '}
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
