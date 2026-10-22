# KitchenToDoor: New Page & Modal Reference Templates

This document provides complete, copy-pasteable boilerplates for creating new views in KitchenToDoor.

---

## 1. Paginated Table Page Template

Use this template for admin/courier dashboards or data lists requiring sorting, search, and pagination.

```tsx
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { api } from '../../lib/api';
import { Pagination } from '../layout/Pagination';
import { paginate } from '@kitchentodoor/shared';
import { Search, RefreshCw } from 'lucide-react';

export function ExampleListPage() {
  const { page, size, q } = useSearch({ from: '/example-path' });
  const navigate = useNavigate({ from: '/example-path' });
  const [searchInput, setSearchInput] = useState(q);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['example-items', q, page, size],
    queryFn: () => api.example.getPage({ search: q, page, size }),
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? paginate(0, page, size);

  // Auto-correct out-of-bounds page
  const resolvedPage = data?.pagination.page;
  useEffect(() => {
    if (resolvedPage !== undefined && resolvedPage !== page) {
      void navigate({ search: (prev) => ({ ...prev, page: resolvedPage }), replace: true });
    }
  }, [resolvedPage, page, navigate]);

  const handleSearchSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    void navigate({ search: (prev) => ({ ...prev, q: searchInput.trim(), page: 1 }) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-100">
            Example List
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage and view paginated records in real-time.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="glass-panel p-4 rounded-2xl flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search records…"
            className="h-10 w-full pl-10 pr-4 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <button
          type="submit"
          className="h-10 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition active:scale-95"
        >
          Search
        </button>
      </form>

      {/* Data Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="py-3.5 px-4 text-center">
                  ID
                </th>
                <th scope="col" className="py-3.5 px-4">
                  Title
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Status
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400">
                    Loading records…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400">
                    No records found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-teal-50/40 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-4 px-4 font-mono font-bold text-teal-600 dark:text-teal-400 text-center">
                      {item.id}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {item.title}
                    </td>
                    <td className="py-4 px-4 text-center">{item.status}</td>
                    <td className="py-4 px-4 text-center">
                      <button className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <Pagination
        pagination={pagination}
        disabled={isFetching}
        onPageChange={(next) => void navigate({ search: (prev) => ({ ...prev, page: next }) })}
        onPageSizeChange={(next) =>
          void navigate({ search: (prev) => ({ ...prev, size: next, page: 1 }) })
        }
      />
    </div>
  );
}
```
