import { z } from '../zod.js';

export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]+$/, 'Use a phone number with digits and an optional country code')
  .refine((value) => {
    const digits = value.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
  }, 'Phone number must contain 7 to 15 digits');

export const OrderIdentifierSchema = z
  .string()
  .trim()
  .regex(
    /^(?:KTD-(?:\d{4,}|[a-f\d]{12})|[a-f\d]{24}|trk_[a-z\d_-]{43})$/i,
    'Enter a valid order number or the private tracking ID from your confirmation',
  )
  .transform((value) =>
    /^trk_/i.test(value)
      ? `trk_${value.slice(4)}`
      : value.toUpperCase().startsWith('KTD-')
        ? value.toUpperCase()
        : value.toLowerCase(),
  );

export const OrderLookupSchema = z.object({ orderId: OrderIdentifierSchema });
export const OrderHistorySearchSchema = z.object({ phone: PhoneSchema });
