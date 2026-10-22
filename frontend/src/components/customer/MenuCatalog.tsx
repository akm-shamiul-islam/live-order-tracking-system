import { useCopy } from '../../lib/i18n';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  Plus,
  Minus,
  Flame,
  Star,
  Leaf,
  UtensilsCrossed,
  Beef,
  Pizza,
  CookingPot,
  Salad,
  Sandwich,
  CakeSlice,
  CupSoda,
} from 'lucide-react';

import { MENU_ITEMS, MENU_PAGE_SIZES, paginate, type MenuItem } from '@kitchentodoor/shared';
import { Pagination } from '../layout/Pagination';
import { FoodImage } from './FoodImage';
export type { MenuItem } from '@kitchentodoor/shared';

interface MenuCatalogProps {
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  getQuantity: (id: string) => number;
  isAuthenticated: boolean;
}

export function MenuCatalog({
  onAddToCart,
  onUpdateQuantity,
  getQuantity,
  isAuthenticated,
}: MenuCatalogProps) {
  const c = useCopy();

  const { category: selectedCategory, page, size } = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const featured = MENU_ITEMS[0];

  const categories = [
    { id: 'all', label: 'All Dishes', icon: UtensilsCrossed },
    { id: 'burgers', label: 'Burgers', icon: Beef },
    { id: 'pizzas', label: 'Pizzas', icon: Pizza },
    { id: 'pasta', label: 'Pasta', icon: CookingPot },
    { id: 'salads', label: 'Salads & Bowls', icon: Salad },
    { id: 'sides', label: 'Sides', icon: Sandwich },
    { id: 'desserts', label: 'Desserts', icon: CakeSlice },
    { id: 'drinks', label: 'Drinks', icon: CupSoda },
  ] as const;

  const filtered =
    selectedCategory === 'all'
      ? MENU_ITEMS
      : MENU_ITEMS.filter((item) => item.category === selectedCategory);
  const pagination = paginate(filtered.length, page, size);
  const visibleItems = filtered.slice((pagination.page - 1) * size, pagination.page * size);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative grid overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-teal-800 via-emerald-900 to-slate-950 text-white shadow-xl shadow-teal-900/10 md:grid-cols-5">
        <div className="relative z-10 p-7 sm:p-10 md:col-span-3">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-white/15 backdrop-blur-md mb-4 text-emerald-100 border border-white/20 shadow-xs">
            <Flame aria-hidden="true" className="w-4 h-4 text-teal-200" />
            {c('Fresh From Our Kitchen')}{' '}
          </span>
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl tracking-tight leading-tight mb-4 drop-shadow-xs">
            {c('Made fresh.')} <br />
            {c('Delivered to your door.')}{' '}
          </h1>
          <p className="text-emerald-50/90 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
            {c(
              'A proper burger, a slice of sourdough pizza, a fresh bowl, or something sweet. Find your next favorite and follow every kitchen update.',
            )}{' '}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-white/95 flex items-center gap-1.5">
              <UtensilsCrossed aria-hidden="true" className="h-3.5 w-3.5" />{' '}
              {c('Made to Order')}{' '}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-white/95 flex items-center gap-1.5">
              <span aria-hidden="true">📍</span> {c('Live Order Updates')}{' '}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-white/95 flex items-center gap-1.5">
              <Leaf aria-hidden="true" className="h-3.5 w-3.5" /> {c('Vegetarian Options')}{' '}
            </span>
          </div>
        </div>

        <div className="relative min-h-52 md:col-span-2">
          {featured && (
            <FoodImage
              photo={featured.photo}
              name="Our house burger with melted cheese and fresh vegetables"
              priority
              className="absolute inset-0 h-full w-full"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent"
          />
          <p className="absolute bottom-5 left-5 rounded-full border border-white/30 bg-slate-950/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xs">
            {c('Your next favorite starts here')}{' '}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-teal-700 dark:text-teal-300">
            {c('Something for every craving')}{' '}
          </p>
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
            {c('Explore Our Menu')}
          </h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {c('Prices in USD · Ask the kitchen about allergens')}{' '}
        </p>
      </div>

      {/* Category Filter Pills */}
      <div
        aria-label={c('Food categories')}
        className="flex items-center gap-2 overflow-x-auto px-1 pb-3 pt-1 scrollbar-none"
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() =>
              void navigate({ search: (previous) => ({ ...previous, category: cat.id, page: 1 }) })
            }
            aria-pressed={selectedCategory === cat.id}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-md shadow-emerald-600/20 border border-emerald-500/30 hover:from-emerald-800 hover:to-teal-800 dark:from-emerald-500/20 dark:to-teal-500/15 dark:text-teal-200 dark:border-teal-400/40 dark:hover:from-emerald-500/30 dark:hover:to-teal-500/25'
                : 'bg-white text-slate-700 hover:text-teal-800 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-teal-500/10 dark:hover:text-teal-200 dark:hover:border-teal-400/40 shadow-xs'
            }`}
          >
            <cat.icon aria-hidden="true" className="h-4 w-4" />
            {c(cat.label)}
          </button>
        ))}
      </div>

      {/* Food Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className="menu-card glass-panel overflow-hidden rounded-2xl flex flex-col hover:border-emerald-500/50 transition-[border-color,box-shadow] hover:shadow-lg group"
          >
            <div className="relative">
              <FoodImage photo={item.photo} name={c(item.name)} className="aspect-[3/2] w-full" />
              {item.badge && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/95 px-3 py-1.5 text-[11px] font-extrabold text-emerald-900 shadow-sm">
                  <Star aria-hidden="true" className="w-3 h-3 fill-current text-emerald-700" />
                  {c(item.badge)}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                {c(item.name)}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                {c(item.description)}
              </p>
              {item.dietary && (
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <Leaf aria-hidden="true" className="h-3.5 w-3.5" />
                  {c(item.dietary)}
                </span>
              )}

              {/* Price & Add Button */}
              <div className="mt-auto pt-5 flex items-end justify-between gap-2">
                <div>
                  <span className="font-display font-extrabold text-xl text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                    ${item.price.toFixed(2)}
                  </span>
                  {item.calories && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-semibold">
                      ~{item.calories} {c('kcal')}{' '}
                    </span>
                  )}
                </div>

                {isAuthenticated && getQuantity(item.id) > 0 ? (
                  <div className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      aria-label={c('Decrease quantity of {{name}}', { name: c(item.name) })}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-teal-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-teal-200"
                    >
                      <Minus aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <span
                      aria-live="polite"
                      aria-label={c('{{count}} in bag', { count: getQuantity(item.id) })}
                      className="min-w-7 text-center text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100"
                    >
                      {getQuantity(item.id)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      disabled={getQuantity(item.id) >= 99}
                      aria-label={c('Increase quantity of {{name}}', { name: c(item.name) })}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-teal-200"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onAddToCart(item)}
                    aria-label={c('Add {{name}} to your bag', { name: c(item.name) })}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-[background-color,transform] hover:bg-teal-800 active:scale-95"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4 stroke-[3]" />
                    <span>{c('Add')}</span>
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      <Pagination
        pageSizes={MENU_PAGE_SIZES}
        pagination={pagination}
        onPageChange={(next) =>
          void navigate({ search: (previous) => ({ ...previous, page: next }) })
        }
        onPageSizeChange={(next) =>
          void navigate({
            search: (previous) => ({ ...previous, size: next, page: 1 }),
          })
        }
      />
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        {c('Food photos are serving suggestions. Your order is prepared fresh.')}{' '}
      </p>
    </div>
  );
}
