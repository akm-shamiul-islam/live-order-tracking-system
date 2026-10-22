import { useStore } from 'zustand';
import { RefreshCw } from 'lucide-react';
import { ThemedSelect } from '../forms/ThemedSelect';
import { useCopy, getLanguage } from '../../lib/i18n';
import { chooseLanguage, languagePreferenceStore } from '../../lib/languagePreferences';
import { IconAction } from '../ui/IconAction';

export function LanguageSwitcher() {
  const c = useCopy();
  const { loading, saving, error, retryLanguage } = useStore(languagePreferenceStore);
  return (
    <div className="relative shrink-0">
      <ThemedSelect
        compact
        label={c('Language')}
        tooltip={c('Choose Language / 言語を選択')}
        value={getLanguage()}
        options={[
          { value: 'en', label: 'EN' },
          { value: 'ja', label: 'JA' },
        ]}
        disabled={loading}
        busy={loading || saving}
        onChange={(value) => {
          if (value === 'en' || value === 'ja') void chooseLanguage(value);
        }}
      />
      <span className="sr-only" role="status">
        {loading ? c('Loading language…') : saving ? c('Saving language…') : ''}
      </span>
      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-3 flex w-72 max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 shadow-xl dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200"
        >
          <p>{c('Your language could not be saved. Check your connection and retry.')}</p>
          <IconAction
            icon={RefreshCw}
            label={c('Retry language save')}
            onClick={() => void chooseLanguage(retryLanguage ?? getLanguage())}
          />
        </div>
      )}
    </div>
  );
}
