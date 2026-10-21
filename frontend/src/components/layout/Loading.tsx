import { useCopy } from '../../lib/i18n';
import { LoaderCircle } from 'lucide-react';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={`motion-safe:animate-spin ${className}`} />;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const c = useCopy();

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 p-6 text-sm font-medium text-slate-600 dark:text-slate-300"
    >
      <Spinner className="h-5 w-5 text-teal-700 dark:text-teal-400" />
      <span>{c(label)}</span>
    </div>
  );
}

export function PageSkeleton({ label = 'Loading page…' }: { label?: string }) {
  const c = useCopy();

  return (
    <section aria-busy="true" aria-label={c(label)} className="space-y-5">
      <LoadingState label={c(label)} />
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
        <div className="h-24 rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="glass-panel space-y-5 rounded-2xl p-5">
              <div className="h-36 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TableSkeleton({
  columns = 7,
  label = 'Loading orders…',
}: {
  columns?: number;
  label?: string;
}) {
  const c = useCopy();

  return (
    <>
      <tr>
        <td colSpan={columns}>
          <LoadingState label={c(label)} />
        </td>
      </tr>
      {Array.from({ length: 4 }, (_, row) => (
        <tr key={row} aria-hidden="true" className="motion-safe:animate-pulse">
          {Array.from({ length: columns }, (_, col) => (
            <td key={col} className="px-4 py-5">
              <div className="h-4 rounded bg-slate-200 dark:bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
