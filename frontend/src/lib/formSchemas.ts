import { z } from 'zod';
import { CustomerInfoSchema } from '@kitchentodoor/shared';

export const CheckoutFormSchema = CustomerInfoSchema.extend({ note: z.string().trim() });
