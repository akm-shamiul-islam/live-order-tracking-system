import { z } from '../zod.js';

// Match HTML maxlength and Mongoose's string limit, including UTF-16 surrogate pairs.
const addressText = z
  .string()
  .trim()
  .refine((value) => value.length <= 500, 'Use at most 500 characters');
const addressMessage = 'Enter a delivery address (at least 5 characters)';

export const DeliveryAddressSchema = addressText.min(5, addressMessage);
export const OptionalDeliveryAddressSchema = addressText
  .refine((value) => value.length === 0 || Array.from(value).length >= 5, addressMessage)
  .optional();

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
