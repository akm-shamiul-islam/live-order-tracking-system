import { CreateOrderSchema, CustomerInfoSchema } from '@kitchentodoor/shared';

export const CheckoutFormSchema = CustomerInfoSchema.extend({
  note: CreateOrderSchema.shape.note.unwrap().default(''),
});
