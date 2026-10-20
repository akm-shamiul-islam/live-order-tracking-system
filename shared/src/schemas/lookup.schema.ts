import { z } from 'zod';

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
    /^(?:KTD-\d{4,}|[a-f\d]{24})$/i,
    'Enter an order number such as KTD-1234 or a valid tracking ID',
  )
  .transform((value) =>
    value.toUpperCase().startsWith('KTD-') ? value.toUpperCase() : value.toLowerCase(),
  );

export const OrderLookupSchema = z.object({ orderId: OrderIdentifierSchema });
export const OrderHistorySearchSchema = z.object({ phone: PhoneSchema });
