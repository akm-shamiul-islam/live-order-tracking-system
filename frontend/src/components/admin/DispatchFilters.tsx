import { useState } from 'react';
import { ORDER_STATUS_SEQUENCE } from '@kitchentodoor/shared';
import { ListFilter, Search } from 'lucide-react';
import { ThemedSelect } from '../forms/ThemedSelect';

const statuses = ['ALL', ...ORDER_STATUS_SEQUENCE, 'CANCELLED'].map((value) => ({
  value,
  label: value.replace(/_/g, ' '),
}));
const actionClass =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 text-xs font-bold text-white shadow-sm shadow-teal-500/15 transition-colors hover:from-emerald-800 hover:to-teal-800';

export function DispatchFilters({
  status,
  search,
  onFilter,
  onSearch,
}: {
  status: string;
  search: string;
  onFilter: (status: string) => void;
  onSearch: (search: string) => void;
}) {
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftSearch, setDraftSearch] = useState(search);
  return (
    <div className="glass-panel relative z-20 flex flex-col gap-5 rounded-2xl p-4 sm:p-5 xl:flex-row xl:items-end xl:justify-between">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onFilter(draftStatus);
        }}
        className="w-full xl:max-w-sm"
      >
        <p className="mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          Order status
        </p>
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <ThemedSelect
              label="Order status"
              value={draftStatus}
              options={statuses}
              onChange={setDraftStatus}
            />
          </div>
          <button type="submit" className={actionClass}>
            <ListFilter aria-hidden="true" className="h-4 w-4" />
            <span>Filter</span>
          </button>
        </div>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(draftSearch.trim());
        }}
        className="w-full xl:max-w-md"
      >
        <label
          htmlFor="dispatch-search"
          className="mb-2 block text-[11px] font-bold text-slate-500 dark:text-slate-400"
        >
          Search orders
        </label>
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400"
            >
              <Search className="h-4 w-4" />
            </span>
            <input
              id="dispatch-search"
              name="search"
              type="search"
              value={draftSearch}
              maxLength={100}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Order #, name or phone…"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-xs text-slate-800 shadow-xs placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <button type="submit" className={actionClass}>
            <Search aria-hidden="true" className="h-4 w-4" />
            <span>Search</span>
          </button>
        </div>
      </form>
    </div>
  );
}
