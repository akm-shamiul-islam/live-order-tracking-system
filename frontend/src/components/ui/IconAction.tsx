import { useCopy } from '../../lib/i18n';
import type { ComponentPropsWithoutRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Tooltip } from './Tooltip';
import { Spinner } from '../layout/Loading';

const tones = {
  neutral:
    'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/15 dark:hover:text-teal-100',
  primary:
    'border-transparent bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500',
  danger:
    'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-900/50',
};
interface ActionProps {
  label: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
  pending?: boolean;
}
export function IconAction({
  label,
  icon: Icon,
  tone = 'neutral',
  pending = false,
  className = '',
  ...props
}: ActionProps & Omit<ComponentPropsWithoutRef<'button'>, 'children'>) {
  const c = useCopy();

  return (
    <Tooltip label={props['aria-label'] ?? c(label)}>
      <button
        type="button"
        {...props}
        aria-label={props['aria-label'] ?? c(label)}
        aria-busy={pending || undefined}
        className={`icon-action inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs disabled:opacity-50 ${tones[tone]} ${className}`}
      >
        {pending ? <Spinner /> : <Icon aria-hidden="true" className="h-4 w-4" />}
      </button>
    </Tooltip>
  );
}
export function IconActionLink({
  label,
  icon: Icon,
  to,
  orderId,
  context,
  badge = 0,
}: ActionProps & {
  to: '/tracking/$orderId' | '/courier/$orderId';
  orderId: string;
  context?: string;
  badge?: number;
}) {
  const c = useCopy();

  return (
    <Tooltip label={c(label)}>
      <Link
        to={to}
        params={{ orderId }}
        aria-label={context ? `${c(label)} · ${context}` : c(label)}
        data-button
        className={`icon-action relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs ${tones.neutral}`}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
        {badge > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900"
          >
            {badge}
          </span>
        )}
      </Link>
    </Tooltip>
  );
}
