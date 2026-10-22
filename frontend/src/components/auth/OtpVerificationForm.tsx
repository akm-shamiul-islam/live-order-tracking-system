import { useEffect, useState } from 'react';
import { KeyRound, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import type { AuthChallengeResponse, AuthResponse } from '@kitchentodoor/shared';
import { OtpCodeSchema } from '@kitchentodoor/shared';
import { useCopy } from '../../lib/i18n';
import { ApiError, api } from '../../lib/api';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { Spinner } from '../layout/Loading';

interface OtpVerificationFormProps {
  challenge: AuthChallengeResponse;
  onComplete: (result: AuthResponse | string) => void;
}

const inputClass =
  'h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-center font-mono text-2xl font-bold tracking-[0.45em] text-slate-900 shadow-inner transition focus:border-teal-600 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 aria-[invalid=true]:border-rose-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:aria-[invalid=true]:border-rose-400';

export function OtpVerificationForm({ challenge: initial, onComplete }: OtpVerificationFormProps) {
  const c = useCopy();
  const [challenge, setChallenge] = useState(initial);
  const [now, setNow] = useState<number>();
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(OtpCodeSchema, { code: '' }, 'email-otp');

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const timer = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresIn =
    now === undefined
      ? undefined
      : Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - now) / 1000));
  const resendIn =
    now === undefined
      ? undefined
      : Math.max(0, Math.ceil((Date.parse(challenge.resendAvailableAt) - now) / 1000));
  const resetFlow = challenge.purpose === 'password_reset';
  const emailFlow = challenge.purpose === 'email_verification';
  const icon = resetFlow ? KeyRound : emailFlow ? MailCheck : ShieldCheck;
  const Icon = icon;

  return (
    <form
      noValidate
      aria-busy={pending || resending}
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || resending || expiresIn === undefined || expiresIn === 0) return;
        const element = event.currentTarget;
        const values = form.validate(element);
        if (!values) return;
        setPending(true);
        setError(null);
        try {
          if (resetFlow)
            onComplete(await api.auth.verifyPasswordReset(challenge.challengeId, values.code));
          else if (emailFlow)
            onComplete(await api.auth.verifyEmail(challenge.challengeId, values.code));
          else onComplete(await api.auth.verifyLogin(challenge.challengeId, values.code));
        } catch (cause) {
          if (cause instanceof ApiError)
            form.setServerErrors(
              cause.status === 400 ? { code: cause.message } : cause.fieldErrors,
              element,
            );
          setError(cause instanceof Error ? cause.message : 'The code could not be verified.');
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-3 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300">
          <Icon aria-hidden="true" className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-display text-xl font-extrabold">
            {c(
              emailFlow
                ? 'Verify Your Email Address'
                : resetFlow
                  ? 'Enter the Reset Code'
                  : 'Verify This Device',
            )}
          </h2>
          <p className="mt-2 break-all text-sm text-slate-600 dark:text-slate-300">
            {c('Enter the 6-digit code sent to')}{' '}
            <span className="font-semibold">{challenge.email}</span>
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {c(error)}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="email-otp-code" className="block text-sm font-semibold">
          {c('Verification Code')}
        </label>
        <input
          {...form.field('code')}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          disabled={pending || resending || expiresIn === undefined || expiresIn === 0}
          onChange={(event) =>
            form.setValue('code', event.target.value.replace(/\D/g, '').slice(0, 6))
          }
          className={inputClass}
        />
        <FieldError id="email-otp-code-error" message={form.errors.code} />
      </div>

      <div
        className="space-y-1 text-center text-xs text-slate-600 dark:text-slate-300"
        aria-live="polite"
      >
        <p>{c('Code expires in {{seconds}} seconds.', { seconds: expiresIn ?? '…' })}</p>
        {resendIn === undefined ? null : resendIn > 0 ? (
          <p>{c('Request another code in {{seconds}} seconds.', { seconds: resendIn })}</p>
        ) : expiresIn !== undefined && expiresIn > 0 ? (
          <p>{c('You can request another code now.')}</p>
        ) : (
          <p className="font-semibold text-rose-700 dark:text-rose-300">
            {c('This code has expired. Request another code.')}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || resending || expiresIn === undefined || expiresIn === 0}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white transition duration-200 hover:bg-teal-800 hover:shadow-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Spinner /> : <ShieldCheck aria-hidden="true" className="h-4 w-4" />}
        {pending
          ? c('Checking Code…')
          : c(resetFlow ? 'Verify Code' : emailFlow ? 'Verify Email' : 'Verify and Sign In')}
      </button>

      <button
        type="button"
        disabled={pending || resending || resendIn === undefined || resendIn > 0}
        onClick={async () => {
          setResending(true);
          setError(null);
          try {
            let next: AuthChallengeResponse;
            try {
              next = await api.auth.resendOtp(challenge.challengeId);
            } catch (cause) {
              // The database TTL monitor may already have removed an expired or locked challenge.
              // Restart these flows using the email already shown to the user; new-device sign-in
              // must instead repeat password verification before it can issue another code.
              if (!(cause instanceof ApiError && cause.status === 400)) throw cause;
              if (resetFlow) next = await api.auth.forgotPassword(challenge.email);
              else if (emailFlow) next = await api.auth.requestEmailVerification(challenge.email);
              else throw cause;
            }
            setChallenge(next);
            form.setValue('code', '');
            setNow(Date.now());
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'The code could not be resent.');
          } finally {
            setResending(false);
          }
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 transition duration-200 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {resending ? <Spinner /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
        {resending ? c('Sending Code…') : c('Resend Verification Code')}
      </button>
    </form>
  );
}
