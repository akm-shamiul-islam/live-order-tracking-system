import { useCopy } from '../../lib/i18n';
import { useRef, useState } from 'react';
import type { CartItem } from '../../lib/cart';
import { CreateOrderSchema, calculatePricing, type Coordinates } from '@kitchentodoor/shared';
import { api, ApiError } from '../../lib/api';
import { CheckoutFormSchema } from '../../lib/formSchemas';
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { usePublicSettings } from '../../hooks/usePublicSettings';
import { useDialog } from '../../hooks/useDialog';
import { queryClient } from '../../lib/queryClient';
import { Spinner } from '../layout/Loading';
import { useAuth } from '../../hooks/useAuth';
import { X, CheckCircle2, AlertCircle, LocateFixed, RefreshCw, MapPinX } from 'lucide-react';
import { clientSettings } from '../../lib/clientSettings';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onOrderSuccess: (orderId: string) => void;
}

export function CheckoutModal({ isOpen, onClose, cartItems, onOrderSuccess }: CheckoutModalProps) {
  const c = useCopy();

  const { user } = useAuth();
  const form = useZodForm(
    CheckoutFormSchema,
    {
      name: user?.name || '',
      phone: user?.phone || '',
      address: user?.address || '',
      note: '',
    },
    'checkout',
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [coordinates, setCoordinates] = useState<Coordinates>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>();
  const locationRequest = useRef(0);
  const dialogRef = useDialog(isOpen);
  const settings = usePublicSettings();

  if (!isOpen) return null;

  const total = settings.data
    ? calculatePricing(cartItems, settings.data.pricing).total
    : undefined;

  const clearLocation = () => {
    ++locationRequest.current;
    setCoordinates(undefined);
    setLocating(false);
    setLocationError(undefined);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current) return;
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
      deliveryCoordinates: coordinates,
      note: values.note || undefined,
    };

    // Client-side Zod Validation
    const validation = CreateOrderSchema.safeParse(payload);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Please check your input fields');
      return;
    }

    try {
      submitting.current = true;
      setLoading(true);
      const res = await api.orders.create(validation.data);
      void queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      onOrderSuccess(res.order.trackingId || res.order.id);
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
      submitting.current = false;
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
              {c('Kitchen Delivery Details')}{' '}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {c('Your saved details are filled in. Edit them for this delivery.')}{' '}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label={c('Close checkout')}
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
            <span>{c(error)}</span>
          </div>
        )}

        {!settings.data && settings.error && (
          <p role="alert" className="mb-4 text-sm text-rose-600 dark:text-rose-400">
            {settings.error.message}
            <button
              onClick={() => void settings.refetch()}
              className="ml-2 inline-flex items-center gap-2 font-bold underline"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />{' '}
              {c('Try Loading Pricing Again')}{' '}
            </button>
          </p>
        )}

        <form noValidate onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
          <div>
            <label
              htmlFor="checkout-name"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              {c('Full Name')}{' '}
            </label>
            <input
              type="text"
              {...form.field('name')}
              autoComplete="name"
              disabled={loading}
              required
              placeholder={c('e.g. Alex Mercer')}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
            <FieldError id="checkout-name-error" message={form.errors.name} />
          </div>

          <div>
            <label
              htmlFor="checkout-phone"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              {c('Mobile Phone')}{' '}
            </label>
            <input
              type="tel"
              {...form.field('phone')}
              inputMode="tel"
              autoComplete="tel"
              disabled={loading}
              required
              placeholder={c('e.g. +1 (555) 019-2834')}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
            <FieldError id="checkout-phone-error" message={form.errors.phone} />
          </div>

          <div>
            <label
              htmlFor="checkout-address"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              {c('Delivery Address (Doorstep)')}{' '}
            </label>
            <textarea
              {...form.field('address')}
              onChange={(event) => {
                form.field('address').onChange(event);
                clearLocation();
              }}
              rows={3}
              autoComplete="street-address"
              maxLength={500}
              disabled={loading}
              required
              placeholder={c('e.g. 742 Evergreen Terrace, Apt 4B')}
              className="w-full resize-y px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
            <FieldError id="checkout-address-error" message={form.errors.address} />
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
              {c(
                'If you are at the delivery address, you can attach this device’s current location as an optional map pin. Your written address is still required.',
              )}{' '}
            </p>
            <button
              type="button"
              disabled={loading || locating}
              onClick={() => {
                const requestId = ++locationRequest.current;
                setLocationError(undefined);
                if (!navigator.geolocation || !window.isSecureContext) {
                  setLocationError(
                    'Current location needs HTTPS (or localhost) and a supported browser.',
                  );
                  return;
                }
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    if (requestId !== locationRequest.current) return;
                    setCoordinates({
                      lat: position.coords.latitude,
                      lng: position.coords.longitude,
                    });
                    setLocating(false);
                  },
                  (cause) => {
                    if (requestId !== locationRequest.current) return;
                    setLocationError(
                      cause.code === 1
                        ? 'Location permission was denied. You can continue using your written address.'
                        : 'Your location could not be found. You can continue using your written address.',
                    );
                    setLocating(false);
                  },
                  {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: clientSettings.VITE_GPS_TIMEOUT_MS,
                  },
                );
              }}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-600 px-3 text-xs font-bold text-teal-800 dark:text-teal-200"
            >
              {locating ? <Spinner /> : <LocateFixed aria-hidden="true" className="h-4 w-4" />}
              {locating
                ? c('Getting Location…')
                : coordinates
                  ? c('Update Current Location')
                  : c('Use My Current Location')}
            </button>
            {coordinates && (
              <p role="status" className="mt-2 text-xs text-teal-800 dark:text-teal-200">
                {c('Map pin attached.')}{' '}
                <button
                  type="button"
                  disabled={loading}
                  onClick={clearLocation}
                  className="inline-flex items-center gap-1 font-bold underline"
                >
                  <MapPinX aria-hidden="true" className="h-3.5 w-3.5" /> {c('Remove Pin')}{' '}
                </button>
              </p>
            )}
            {locationError && (
              <p role="alert" className="mt-2 text-xs text-rose-800 dark:text-rose-200">
                {locationError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="checkout-note"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              {c('Kitchen or Delivery Note (Optional)')}{' '}
            </label>
            <input
              type="text"
              {...form.field('note')}
              maxLength={500}
              disabled={loading}
              placeholder={c('e.g. Extra napkins, leave by door buzzer 402')}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
            />
            <FieldError id="checkout-note-error" message={form.errors.note} />
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                {c('Total Due')}{' '}
              </span>
              <span className="font-display font-extrabold text-2xl text-emerald-600 dark:text-emerald-400">
                {total === undefined ? c('Loading…') : `$${total.toFixed(2)}`}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !settings.data}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-bold text-sm bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white transition shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading && <Spinner />}
              <span>{loading ? c('Placing Order…') : c('Confirm Order')}</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
