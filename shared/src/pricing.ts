import type { PricingSettings } from './schemas/public-config.schema.js';

export function calculatePricing(
  items: ReadonlyArray<{ price: number; quantity: number }>,
  settings: PricingSettings,
) {
  const subtotalCents = items.reduce(
    (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
    0,
  );
  const deliveryFeeCents = items.length > 0 ? Math.round(settings.deliveryFee * 100) : 0;
  const taxCents = Math.round(subtotalCents * settings.taxRate);
  return {
    subtotal: subtotalCents / 100,
    deliveryFee: deliveryFeeCents / 100,
    tax: taxCents / 100,
    total: (subtotalCents + deliveryFeeCents + taxCents) / 100,
  };
}
