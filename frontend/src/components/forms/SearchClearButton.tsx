import { X } from 'lucide-react';
import { useCopy } from '../../lib/i18n';

export function SearchClearButton({ visible, onClear }: { visible: boolean; onClear: () => void }) {
  const c = useCopy();
  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={c('Clear Search')}
      title={c('Clear Search')}
      onClick={onClear}
      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 dark:focus-visible:outline-teal-300"
    >
      <X aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
