import { z } from '@kitchentodoor/shared/zod';
import { CustomerInfoSchema } from '@kitchentodoor/shared';

export const CheckoutFormSchema = CustomerInfoSchema.extend({ note: z.string().trim() });
