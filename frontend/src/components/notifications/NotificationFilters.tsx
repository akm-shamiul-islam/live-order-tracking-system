import { useState } from 'react';
import { ListFilter, Search } from 'lucide-react';
import { NotificationQuerySchema, type ProfileChange } from '@kitchentodoor/shared';
import { useCopy } from '../../lib/i18n';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { SearchClearButton } from '../forms/SearchClearButton';
import { ThemedSelect } from '../forms/ThemedSelect';

type ReviewStatus = 'ALL' | ProfileChange['status'];
const searchSchema = NotificationQuerySchema.pick({ q: true });
const actionClass =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:from-emerald-800 hover:to-teal-800';

export function NotificationFilters({
  status,
  search,
  onFilter,
  onSearch,
}: {
  status: ReviewStatus;
  search: string;
  onFilter: (status: ReviewStatus) => void;
  onSearch: (search: string) => void;
}) {
  const c = useCopy();
  const [draftStatus, setDraftStatus] = useState(status);
  const form = useZodForm(searchSchema, { q: search }, 'notifications');
  return (
    <div className="glass-panel relative z-20 flex flex-col gap-5 rounded-2xl p-4 sm:p-5 xl:flex-row xl:flex-wrap xl:items-start xl:justify-between">
      <form
        className="flex items-end gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          onFilter(draftStatus);
        }}
      >
        <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
          <span
            id="notification-status-label"
            className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400"
          >
            {c('Review Status')}
          </span>
          <ThemedSelect
            label={c('Review Status')}
            labelId="notification-status-label"
            size="small"
            value={draftStatus}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'PENDING', label: 'Awaiting Review' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
            onChange={(value) => {
              if (
                value === 'ALL' ||
                value === 'PENDING' ||
                value === 'APPROVED' ||
                value === 'REJECTED'
              )
                setDraftStatus(value);
            }}
          />
        </div>
        <button type="submit" className={actionClass}>
          <ListFilter aria-hidden="true" className="h-4 w-4" />
          {c('Filter')}
        </button>
      </form>
      <form
        className="w-full sm:ml-auto sm:w-auto"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const values = form.validate(event.currentTarget);
          if (values) onSearch(values.q);
        }}
      >
        <label
          htmlFor="notifications-q"
          className="mb-2 block text-[11px] font-bold text-slate-500 dark:text-slate-400"
        >
          {c('Search Notifications')}
        </label>
        <div className="flex items-center justify-end gap-2.5">
          <div className="relative min-w-0 flex-1 sm:w-[360px] sm:flex-none">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400"
            >
              <Search className="h-4 w-4" />
            </span>
            <input
              {...form.field('q')}
              type="text"
              role="searchbox"
              enterKeyHint="search"
              maxLength={100}
              placeholder={c('Name, email or feedback…')}
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-xs text-slate-800 shadow-xs placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <SearchClearButton visible={!!form.values.q} onClear={() => form.setValue('q', '')} />
          </div>
          <button type="submit" className={actionClass}>
            <Search aria-hidden="true" className="h-4 w-4" />
            {c('Search')}
          </button>
        </div>
        <FieldError id="notifications-q-error" message={form.errors.q} />
      </form>
    </div>
  );
}
