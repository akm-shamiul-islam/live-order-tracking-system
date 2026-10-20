import { useState } from 'react';
import { CartItem } from './CartDrawer';
import { CreateOrderSchema, calculatePricing } from '@kitchentodoor/shared';
import { api, ApiError } from '../../lib/api';
import { CheckoutFormSchema } from '../../lib/formSchemas';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { usePublicSettings } from '../../hooks/usePublicSettings';
import { useDialog } from '../../hooks/useDialog';
import { queryClient } from '../../lib/queryClient';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onOrderSuccess: (orderId: string) => void;
}

export function CheckoutModal({ isOpen, onClose, cartItems, onOrderSuccess }: CheckoutModalProps) {
  const form = useZodForm(
    CheckoutFormSchema,
    { name: '', phone: '', address: '', note: '' },
    'checkout',
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dialogRef = useDialog(isOpen);
  const settings = usePublicSettings();

  if (!isOpen) return null;

  const total = settings.data
    ? calculatePricing(cartItems, settings.data.pricing).total
    : undefined;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const formElement = e.currentTarget;
    const values = form.validate(formElement);
    if (!values) return;
    if (!settings.data) {
      setError('Delivery pricing is unavailable. Please try loading it again.');
      return;
    }

    const payload = {
      customer: {
        name: values.name,
        phone: values.phone,
        address: values.address,
      },
      items: cartItems.map((item) => ({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.emoji,
      })),
      deliveryAddress: values.address,
      deliveryCoordinates: {
        lat: 40.7128 + (Math.random() - 0.5) * 0.01,
        lng: -74.006 + (Math.random() - 0.5) * 0.01,
      },
      note: values.note || undefined,
    };

    // Client-side Zod Validation
    const validation = CreateOrderSchema.safeParse(payload);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Please check your input fields');
      return;
    }

    try {
      setLoading(true);
      const res = await api.orders.create(validation.data);
      try {
        localStorage.setItem('ktd_last_phone', values.phone);
      } catch {
        /* Storage may be blocked. */
      }
      void queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      onOrderSuccess(res.order.id);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const fields = Object.fromEntries(
          Object.entries(err.fieldErrors).map(([name, message]) => [
            name === 'deliveryAddress' ? 'address' : name.replace(/^customer\./, ''),
            message,
          ]),
        );
        form.setServerErrors(fields, formElement);
      }
      setError(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="checkout-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-0 bg-transparent backdrop:bg-slate-950/70 backdrop:backdrop-blur-xs"
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
          <div>
            <h2
              id="checkout-title"
              className="font-display font-extrabold text-xl text-slate-900 dark:text-slate-100"
            >
              Kitchen Delivery Details
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter your details to place your order and start tracking
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Close checkout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!settings.data && settings.error && (
          <p role="alert" className="mb-4 text-sm text-rose-600 dark:text-rose-400">
            {settings.error.message}
            <button onClick={() => void settings.refetch()} className="ml-2 font-bold underline">
              Try Loading Pricing Again
            </button>
          </p>
        )}

        <form noValidate onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
          <div>
            <label
              htmlFor="checkout-name"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Full Name
            </label>
            <input
              type="text"
              {...form.field('name')}
              autoComplete="name"
              disabled={loading}
              required
              placeholder="e.g. Alex Mercer"
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
            <FieldError id="checkout-name-error" message={form.errors.name} />
          </div>

          <div>
            <label
              htmlFor="checkout-phone"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Mobile Phone
            </label>
            <input
              type="tel"
              {...form.field('phone')}
              inputMode="tel"
              autoComplete="tel"
              disabled={loading}
              required
              placeholder="e.g. +1 (555) 019-2834"
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
            <FieldError id="checkout-phone-error" message={form.errors.phone} />
          </div>

          <div>
            <label
              htmlFor="checkout-address"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Delivery Address (Doorstep)
            </label>
            <input
              type="text"
              {...form.field('address')}
              autoComplete="street-address"
              disabled={loading}
              required
              placeholder="e.g. 742 Evergreen Terrace, Apt 4B"
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
            <FieldError id="checkout-address-error" message={form.errors.address} />
          </div>

          <div>
            <label
              htmlFor="checkout-note"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Kitchen or Delivery Note (Optional)
            </label>
            <input
              type="text"
              {...form.field('note')}
              disabled={loading}
              placeholder="e.g. Extra napkins, leave by door buzzer 402"
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                Total Due
              </span>
              <span className="font-display font-extrabold text-2xl text-emerald-600 dark:text-emerald-400">
                {total === undefined ? 'Loading…' : `$${total.toFixed(2)}`}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !settings.data}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Placing Order…' : 'Place Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
