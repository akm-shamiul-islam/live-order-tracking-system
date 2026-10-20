import { z } from 'zod';
import { OrderStatus, PageNumberSchema, PageSizeSchema } from '@kitchentodoor/shared';

const paging = {
  page: PageNumberSchema.catch(1).default(1),
  size: PageSizeSchema.catch(10).default(10),
};
export const MenuSearchSchema = z.object({
  ...paging,
  category: z.enum(['all', 'burgers', 'pizzas', 'sides', 'drinks']).catch('all').default('all'),
});
export const DispatchSearchSchema = z.object({
  ...paging,
  status: z
    .union([z.literal('ALL'), z.enum(OrderStatus)])
    .catch('ALL')
    .default('ALL'),
  q: z.string().trim().max(100).catch('').default(''),
});
export const HistorySearchSchema = z.object(paging);
