import { useState } from 'react';
import { RotateCcw, Save, Settings2, X } from 'lucide-react';
import { useCopy } from '../../lib/i18n';
import { Modal } from '../ui/Modal';
import { primaryButton, secondaryButton } from '../ui/formStyles';

export const USER_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Delivery Address' },
  { key: 'role', label: 'Role' },
  { key: 'account', label: 'Account' },
] as const;
export type UserColumn = (typeof USER_COLUMNS)[number]['key'];
const storageKey = (id: string) => `ktd_users_columns_v1:${id}`;
export function readUserColumns(id: string): UserColumn[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey(id)) || 'null');
    if (Array.isArray(raw))
      return USER_COLUMNS.filter(({ key }) => raw.includes(key)).map(({ key }) => key);
  } catch {
    /* Browser storage can be unavailable. */
  }
  return USER_COLUMNS.map(({ key }) => key);
}
export function UserColumnSettings({
  userId,
  columns,
  onSave,
  onClose,
}: {
  userId: string;
  columns: UserColumn[];
  onSave: (columns: UserColumn[]) => void;
  onClose: () => void;
}) {
  const c = useCopy();
  const [draft, setDraft] = useState(columns);
  return (
    <Modal
      title={c('Table Settings')}
      icon={Settings2}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={() => setDraft(USER_COLUMNS.map(({ key }) => key))}
            className={`${secondaryButton} sm:mr-auto`}
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {c('Restore Defaults')}
          </button>
          <button type="button" onClick={onClose} className={secondaryButton}>
            <X aria-hidden="true" className="h-4 w-4" />
            {c('Cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(storageKey(userId), JSON.stringify(draft));
              } catch {
                /* Keep the selected view for this visit. */
              }
              onSave(draft);
              onClose();
            }}
            className={primaryButton}
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {c('Save Settings')}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {c(
          'Choose which columns to show in this table. Your selection is saved for your account on this page.',
        )}
      </p>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">{c('Columns to show')}</legend>
        {USER_COLUMNS.map(({ key, label }) => (
          <label
            key={key}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold transition-colors hover:border-teal-400 hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10"
          >
            <input
              type="checkbox"
              checked={draft.includes(key)}
              onChange={(event) =>
                setDraft((previous) =>
                  event.target.checked
                    ? USER_COLUMNS.filter(
                        (column) => column.key === key || previous.includes(column.key),
                      ).map((column) => column.key)
                    : previous.filter((column) => column !== key),
                )
              }
              className="h-5 w-5 accent-teal-700 dark:accent-teal-400"
            />
            {c(label)}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {c('Actions stay visible so profiles and history remain accessible.')}
      </p>
    </Modal>
  );
}
