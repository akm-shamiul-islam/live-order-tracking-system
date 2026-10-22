import { type ReactNode, useId } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import { useCopy } from '../../lib/i18n';

export function Modal({
  title,
  icon: Icon,
  onClose,
  busy = false,
  maxWidth = 'max-w-3xl',
  children,
  footer,
}: {
  title: string;
  icon?: LucideIcon;
  onClose: () => void;
  busy?: boolean;
  maxWidth?: 'max-w-3xl' | 'max-w-4xl' | 'max-w-5xl';
  children: ReactNode;
  footer?: ReactNode;
}) {
  const c = useCopy();
  const id = useId();
  const dialog = useDialog(true);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={id}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${maxWidth} overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/65 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`}
    >
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-teal-50/70 px-5 py-4 dark:border-slate-700 dark:bg-teal-950/40 sm:px-7">
        <h2 id={id} className="font-display flex items-center gap-3 text-lg font-bold">
          {Icon && <Icon aria-hidden="true" className="h-5 w-5 text-teal-700 dark:text-teal-300" />}
          {c(title)}
        </h2>
        <button
          type="button"
          aria-label={c('Close')}
          disabled={busy}
          onClick={onClose}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-teal-100 hover:text-teal-900 dark:text-slate-300 dark:hover:bg-teal-500/20 dark:hover:text-white"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>
      <div className="space-y-5 p-5 sm:p-7">{children}</div>
      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-7">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
