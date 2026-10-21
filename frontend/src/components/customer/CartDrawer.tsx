import { useCopy } from '../../lib/i18n';
import { MenuItem } from './MenuCatalog';
import { X, Plus, Minus, Trash2, ArrowRight, ShoppingBag, RefreshCw } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import { calculatePricing } from '@kitchentodoor/shared';
import { usePublicSettings } from '../../hooks/usePublicSettings';
import { FoodImage } from './FoodImage';
import { LoadingState } from '../layout/Loading';

export interface CartItem extends MenuItem {
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onProceedToCheckout: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
}: CartDrawerProps) {
  const c = useCopy();

  const dialogRef = useDialog(isOpen);
  const settings = usePublicSettings();
  if (!isOpen) return null;

  const { subtotal, deliveryFee, tax, total } = settings.data
    ? calculatePricing(items, settings.data.pricing)
    : { subtotal: 0, deliveryFee: 0, tax: 0, total: 0 };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cart-title"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md p-0 bg-transparent backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <h2
              id="cart-title"
              className="font-display font-bold text-lg text-slate-900 dark:text-slate-100"
            >
              {c('Your Order Bag ({{count}})', {
                count: items.reduce((s, i) => s + i.quantity, 0),
              })}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={c('Close cart')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">🛒</div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
                {c('Your bag is empty')}{' '}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {c('Explore our kitchen menu and add dishes to start live order tracking.')}{' '}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/60 shadow-xs"
              >
                <FoodImage
                  photo={item.photo}
                  name={c(item.name)}
                  sizes="56px"
                  className="h-14 w-14 shrink-0 rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {c(item.name)}
                  </h4>
                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 font-mono">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    aria-label={c('Decrease quantity of {{name}}', { name: c(item.name) })}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    aria-label={c('Increase quantity of {{name}}', { name: c(item.name) })}
                    disabled={item.quantity >= 99}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => onRemoveItem(item.id)}
                  aria-label={c('Remove {{name}} from cart', { name: c(item.name) })}
                  className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Checkout Footer Breakdown */}
        {items.length > 0 && !settings.data && (
          <div
            className="border-t border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800"
            role={settings.error ? 'alert' : 'status'}
          >
            {settings.error ? (
              settings.error.message
            ) : (
              <LoadingState label={c('Loading delivery pricing…')} />
            )}
            {settings.error && (
              <button
                onClick={() => void settings.refetch()}
                className="ml-2 inline-flex items-center gap-2 font-bold text-teal-700 underline"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" /> {c('Try Again')}{' '}
              </button>
            )}
          </div>
        )}
        {items.length > 0 && settings.data && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>{c('Subtotal')}</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{c('Delivery Fee')}</span>
                <span className="font-mono">${deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  {c('Estimated Tax (')}
                  {Number((settings.data.pricing.taxRate * 100).toFixed(2))}%)
                </span>
                <span className="font-mono">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>{c('Total Amount')}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-lg">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={onProceedToCheckout}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white transition shadow-lg shadow-emerald-500/25 active:scale-[0.99] cursor-pointer"
            >
              <span>{c('Proceed to Checkout')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
