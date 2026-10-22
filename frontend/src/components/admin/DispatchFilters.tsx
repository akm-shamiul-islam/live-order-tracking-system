import { useCopy } from '../../lib/i18n';
import { useState } from 'react';
import { ORDER_STATUS_SEQUENCE, OrderStatus } from '@kitchentodoor/shared';
import { ListFilter, Search, Settings2 } from 'lucide-react';
import { SearchClearButton } from '../forms/SearchClearButton';
import { ThemedSelect } from '../forms/ThemedSelect';

type DispatchStatus = 'ALL' | OrderStatus;

const statuses = ['ALL', ...ORDER_STATUS_SEQUENCE, OrderStatus.CANCELLED].map((value) => ({
  value,
  label: value.replace(/_/g, ' '),
}));
function isDispatchStatus(value: string): value is DispatchStatus {
  return value === 'ALL' || Object.values(OrderStatus).some((status) => status === value);
}
const assignments = [
  { value: 'ALL', label: 'All' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
] as const;
const actionClass =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 text-xs font-bold text-white shadow-sm shadow-teal-500/15 transition-[background-color,transform] hover:from-emerald-800 hover:to-teal-800 active:scale-[0.98]';

export function DispatchFilters({
  status,
  assignment,
  search,
  onFilter,
  onSearch,
  onOpenSettings,
}: {
  status: DispatchStatus;
  assignment: 'ALL' | 'ASSIGNED' | 'UNASSIGNED';
  search: string;
  onFilter: (status: DispatchStatus, assignment: 'ALL' | 'ASSIGNED' | 'UNASSIGNED') => void;
  onSearch: (search: string) => void;
  onOpenSettings: () => void;
}) {
  const c = useCopy();
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftAssignment, setDraftAssignment] = useState(assignment);
  const [draftSearch, setDraftSearch] = useState(search);

  return (
    <div className="glass-panel @container relative z-20 flex flex-col gap-5 rounded-2xl p-4 sm:p-5 2xl:flex-row 2xl:flex-wrap 2xl:items-end 2xl:justify-between">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onFilter(draftStatus, draftAssignment);
        }}
        className="w-full 2xl:w-auto"
      >
        <div className="grid grid-cols-2 items-end gap-2.5 @3xl:grid-cols-[14rem_14rem_max-content_max-content]">
          <div className="min-w-0">
            <span
              id="dispatch-status-label"
              className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400"
            >
              {c('Order Status')}
            </span>
            <ThemedSelect
              label={c('Order Status')}
              labelId="dispatch-status-label"
              value={draftStatus}
              options={statuses}
              onChange={(value) => {
                if (isDispatchStatus(value)) setDraftStatus(value);
              }}
              size="small"
            />
          </div>
          <div className="min-w-0">
            <span
              id="dispatch-assignment-label"
              className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400"
            >
              {c('Delivery Assignment')}
            </span>
            <ThemedSelect
              label={c('Delivery Assignment')}
              labelId="dispatch-assignment-label"
              value={draftAssignment}
              options={assignments}
              onChange={(value) => {
                if (value === 'ALL' || value === 'ASSIGNED' || value === 'UNASSIGNED')
                  setDraftAssignment(value);
              }}
              size="small"
            />
          </div>
          <button type="submit" className={`${actionClass} w-fit`}>
            <ListFilter aria-hidden="true" className="h-4 w-4" />
            <span>{c('Filter')}</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-500/60 dark:hover:bg-teal-500/10 dark:hover:text-teal-200"
          >
            <Settings2 aria-hidden="true" className="h-4 w-4" />
            <span>{c('Settings')}</span>
          </button>
        </div>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(draftSearch.trim());
        }}
        className="w-full sm:ml-auto sm:w-auto 2xl:shrink-0"
      >
        <label
          htmlFor="dispatch-search"
          className="mb-2 block text-[11px] font-bold text-slate-500 dark:text-slate-400"
        >
          {c('Search Orders')}{' '}
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
              id="dispatch-search"
              name="search"
              type="text"
              role="searchbox"
              enterKeyHint="search"
              value={draftSearch}
              maxLength={100}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder={c('Order #, name or phone…')}
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-xs text-slate-800 shadow-xs placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <SearchClearButton
              visible={draftSearch.length > 0}
              onClear={() => setDraftSearch('')}
            />
          </div>
          <button type="submit" className={actionClass}>
            <Search aria-hidden="true" className="h-4 w-4" />
            <span>{c('Search')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
