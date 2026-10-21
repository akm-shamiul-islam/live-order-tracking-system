import { useCopy } from '../../lib/i18n';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import {
  PAGE_SIZES,
  MENU_PAGE_SIZES,
  MenuPageSizeSchema,
  PageSizeSchema,
  type PaginationInfo,
} from '@kitchentodoor/shared';
import { ThemedSelect } from '../forms/ThemedSelect';

type PaginationProps = {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  disabled?: boolean;
} & (
  | { pageSizes?: undefined; onPageSizeChange: (size: (typeof PAGE_SIZES)[number]) => void }
  | {
      pageSizes: typeof MENU_PAGE_SIZES;
      onPageSizeChange: (size: (typeof MENU_PAGE_SIZES)[number]) => void;
    }
);

export function Pagination(props: PaginationProps) {
  const c = useCopy();

  const { pagination, onPageChange, disabled = false } = props;
  const sizes = (props.pageSizes ?? PAGE_SIZES).map((size) => ({
    value: String(size),
    label: String(size),
  }));
  const changeSize = (value: string) => {
    if (props.pageSizes) props.onPageSizeChange(MenuPageSizeSchema.parse(value));
    else props.onPageSizeChange(PageSizeSchema.parse(value));
  };
  const { page, pageSize, total, totalPages } = pagination;
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((number) => number >= 1 && number <= totalPages)
    .sort((a, b) => a - b);
  const controlClass =
    'inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-35 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10 dark:hover:text-teal-200 dark:disabled:hover:border-slate-700 dark:disabled:hover:bg-slate-900';
  return (
    <nav
      aria-label={c('Pagination')}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex items-center justify-between gap-4 sm:justify-start">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {c('Items')}
          </span>
          <div className="w-20">
            <ThemedSelect
              label={c('Items per page')}
              value={String(pageSize)}
              options={sizes}
              onChange={changeSize}
              placement="above"
              disabled={disabled}
            />
          </div>
        </div>
        <p role="status" className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {c('{{from}}–{{to}} of {{total}} items', {
            from: total ? (page - 1) * pageSize + 1 : 0,
            to: Math.min(page * pageSize, total),
            total,
          })}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 sm:hidden">
          {c('Page {{page}} of {{total}}', { page, total: totalPages })}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={c('First page')}
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(1)}
            className={`${controlClass} hidden sm:inline-flex`}
          >
            <ChevronsLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={c('Previous page')}
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            className={controlClass}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          {pages.map((number, index) => (
            <span key={number} className="hidden items-center gap-1.5 sm:inline-flex">
              {index > 0 && number - (pages[index - 1] ?? 0) > 1 && (
                <span className="px-1 text-slate-400">…</span>
              )}
              <button
                type="button"
                aria-label={c('Page {{number}}', { number })}
                aria-current={page === number ? 'page' : undefined}
                disabled={disabled}
                onClick={() => onPageChange(number)}
                className={
                  page === number
                    ? 'inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 text-xs font-bold text-white shadow-sm shadow-teal-500/20 hover:from-emerald-800 hover:to-teal-800'
                    : `${controlClass} text-xs font-semibold`
                }
              >
                {number}
              </button>
            </span>
          ))}
          <button
            type="button"
            aria-label={c('Next page')}
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className={controlClass}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={c('Last page')}
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className={`${controlClass} hidden sm:inline-flex`}
          >
            <ChevronsRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
