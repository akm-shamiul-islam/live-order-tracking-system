import { z } from 'zod';
import type { SearchSchemaInput } from '@tanstack/react-router';
import { OrderStatus, PageNumberSchema, PageSizeSchema } from '@kitchentodoor/shared';

const paging = { page: PageNumberSchema.catch(1), size: PageSizeSchema.catch(10) };
export const MenuSearchSchema = z.object({
  ...paging,
  category: z.enum(['all', 'burgers', 'pizzas', 'sides', 'drinks']).catch('all'),
});
export const DispatchSearchSchema = z.object({
  ...paging,
  status: z.union([z.literal('ALL'), z.nativeEnum(OrderStatus)]).catch('ALL'),
  q: z.string().trim().max(100).catch(''),
});
export const HistorySearchSchema = z.object(paging);

export const validateMenuSearch = (
  search: Partial<z.infer<typeof MenuSearchSchema>> & SearchSchemaInput,
) => MenuSearchSchema.parse(search);
export const validateDispatchSearch = (
  search: Partial<z.infer<typeof DispatchSearchSchema>> & SearchSchemaInput,
) => DispatchSearchSchema.parse(search);
export const validateHistorySearch = (
  search: Partial<z.infer<typeof HistorySearchSchema>> & SearchSchemaInput,
) => HistorySearchSchema.parse(search);
