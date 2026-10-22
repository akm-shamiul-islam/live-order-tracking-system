import { useState } from 'react';
import { Info, RotateCcw, Save, Settings2, X } from 'lucide-react';
import { useCopy } from '../../lib/i18n';
import { useDialog } from '../../hooks/useDialog';

export const DISPATCH_COLUMNS = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'customerName', label: 'Customer Name' },
  { key: 'customerPhone', label: 'Contact Number' },
  { key: 'items', label: 'Order items' },
  { key: 'total', label: 'Total' },
  { key: 'status', label: 'Current Status' },
  { key: 'assignment', label: 'Delivery Assignment' },
  { key: 'created', label: 'Created' },
] as const;

export type DispatchColumn = (typeof DISPATCH_COLUMNS)[number]['key'];
export const DEFAULT_DISPATCH_COLUMNS: DispatchColumn[] = DISPATCH_COLUMNS.map(({ key }) => key);

const SETTINGS_VERSION = 1;
const settingsKey = (userId?: string) =>
  `ktd_dispatch_columns_v${SETTINGS_VERSION}:${userId && /^[a-f\d]{24}$/i.test(userId) ? userId.toLowerCase() : 'staff'}`;

export function readDispatchColumns(userId?: string): DispatchColumn[] {
  try {
    const source = localStorage.getItem(settingsKey(userId));
    if (!source) return [...DEFAULT_DISPATCH_COLUMNS];
    const value: unknown = JSON.parse(source);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('version' in value) ||
      value.version !== SETTINGS_VERSION ||
      !('columns' in value) ||
      !Array.isArray(value.columns)
    )
      return [...DEFAULT_DISPATCH_COLUMNS];
    const selected = new Set(
      value.columns.filter((column): column is string => typeof column === 'string'),
    );
    return DISPATCH_COLUMNS.flatMap(({ key }) => (selected.has(key) ? [key] : []));
  } catch {
    return [...DEFAULT_DISPATCH_COLUMNS];
  }
}

export function writeDispatchColumns(userId: string | undefined, columns: DispatchColumn[]) {
  try {
    const allowed = new Set<DispatchColumn>(DISPATCH_COLUMNS.map(({ key }) => key));
    const selected = DISPATCH_COLUMNS.flatMap(({ key }) =>
      allowed.has(key) && columns.includes(key) ? [key] : [],
    );
    localStorage.setItem(
      settingsKey(userId),
      JSON.stringify({ version: SETTINGS_VERSION, columns: selected }),
    );
  } catch {
    // The selected columns remain active until this page is closed if storage is unavailable.
  }
}

export function DispatchColumnSettings({
  userId,
  visibleColumns,
  onClose,
  onSave,
}: {
  userId?: string;
  visibleColumns: DispatchColumn[];
  onClose: () => void;
  onSave: (columns: DispatchColumn[]) => void;
}) {
  const c = useCopy();
  const dialogRef = useDialog(true);
  const [draft, setDraft] = useState<DispatchColumn[]>(visibleColumns);

  function toggle(column: DispatchColumn, checked: boolean) {
    setDraft((current) =>
      checked
        ? DISPATCH_COLUMNS.flatMap(({ key }) =>
            key === column || current.includes(key) ? [key] : [],
          )
        : current.filter((key) => key !== column),
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dispatch-column-settings-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/65 backdrop:backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/70 sm:px-7">
        <div className="flex items-center gap-3">
          <Settings2 aria-hidden="true" className="h-5 w-5 text-teal-700 dark:text-teal-300" />
          <h2 id="dispatch-column-settings-title" className="font-display text-lg font-bold">
            {c('Table Settings')}{' '}
          </h2>
        </div>
        <button
          type="button"
          aria-label={c('Close table settings')}
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-6 p-5 sm:p-7">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {c(
            'Choose which columns to show in this table. Your selection is saved for your account on this page.',
          )}{' '}
        </p>
        <fieldset>
          <legend className="sr-only">{c('Columns to show')}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DISPATCH_COLUMNS.map(({ key, label }) => {
              const inputId = `dispatch-column-${key}`;
              return (
                <label
                  key={key}
                  htmlFor={inputId}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold transition-colors hover:border-teal-400 hover:bg-teal-50/70 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-teal-500/60 dark:hover:bg-teal-500/10"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={draft.includes(key)}
                    onChange={(event) => toggle(key, event.target.checked)}
                    className="h-5 w-5 shrink-0 rounded border-slate-300 accent-teal-700 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:accent-teal-400"
                  />
                  <span>{c(label)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <Info
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300"
          />
          {c('Actions are always shown so each order remains accessible.')}{' '}
        </p>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setDraft([...DEFAULT_DISPATCH_COLUMNS])}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {c('Restore Defaults')}{' '}
          </button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              {c('Cancel')}{' '}
            </button>
            <button
              type="button"
              onClick={() => {
                writeDispatchColumns(userId, draft);
                onSave(draft);
                onClose();
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 text-sm font-bold text-white shadow-md shadow-teal-900/15 transition-colors hover:from-emerald-800 hover:to-teal-800"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              {c('Save Settings')}{' '}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
