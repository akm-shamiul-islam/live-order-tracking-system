import { useState } from 'react';
import { Plus, Flame, Star } from 'lucide-react';

import { MENU_ITEMS, type MenuItem } from '@kitchentodoor/shared';
export type { MenuItem } from '@kitchentodoor/shared';

interface MenuCatalogProps {
  onAddToCart: (item: MenuItem) => void;
}

export function MenuCatalog({ onAddToCart }: MenuCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Dishes' },
    { id: 'burgers', label: 'Burgers' },
    { id: 'pizzas', label: 'Pizzas' },
    { id: 'sides', label: 'Sides' },
    { id: 'drinks', label: 'Drinks' },
  ];

  const filtered =
    selectedCategory === 'all'
      ? MENU_ITEMS
      : MENU_ITEMS.filter((item) => item.category === selectedCategory);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-br from-teal-700 via-emerald-700 to-slate-900 text-white shadow-xl shadow-teal-900/10 border border-emerald-500/20">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-white/15 backdrop-blur-md mb-4 text-emerald-100 border border-white/20 shadow-xs">
            <Flame className="w-4 h-4 text-teal-300 animate-pulse" />
            Kitchen-Fresh & Delivered Hot
          </span>
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl tracking-tight leading-tight mb-4 drop-shadow-xs">
            Real Food. Real Speed. <br />
            Tracked in Real Time.
          </h1>
          <p className="text-emerald-50/90 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
            Order your favorite craft meals directly from the kitchen line and watch your delivery
            courier travel in real time across the live telemetry radar.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-white/95 flex items-center gap-1.5">
              <span>⚡</span> 25-35 Min Average
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-white/95 flex items-center gap-1.5">
              <span>📍</span> Live Telemetry Radar
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-white/95 flex items-center gap-1.5">
              <span>🌱</span> Artisan Ingredients
            </span>
          </div>
        </div>

        {/* Ambient background emojis */}
        <div className="absolute right-4 bottom-2 text-8xl sm:text-9xl opacity-15 select-none pointer-events-none rotate-12">
          🍕
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 scale-105 border border-emerald-500/30'
                : 'bg-white text-slate-700 hover:text-slate-950 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800 shadow-xs'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Food Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="glass-panel rounded-2xl p-6 flex flex-col justify-between hover:border-emerald-500/50 transition-all hover:shadow-xl hover:-translate-y-1 group"
          >
            <div>
              {/* Card Header & Badge */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-xs">
                  {item.emoji}
                </div>
                {item.badge && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs">
                    <Star className="w-3 h-3 fill-current text-emerald-600 dark:text-emerald-400" />
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Title & Desc */}
              <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                {item.name}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Price & Add Button */}
            <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-100 tracking-tight">
                  ${item.price.toFixed(2)}
                </span>
                {item.calories && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-semibold">
                    {item.calories} kcal
                  </span>
                )}
              </div>

              <button
                onClick={() => onAddToCart(item)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-95 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
