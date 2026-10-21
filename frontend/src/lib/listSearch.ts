import { z } from '@kitchentodoor/shared/zod';
import {
  OrderStatus,
  PageNumberSchema,
  PageSizeSchema,
  MenuPageSizeSchema,
  MENU_CATEGORY_IDS,
} from '@kitchentodoor/shared';

const paging = {
  page: PageNumberSchema.catch(1).default(1),
  size: PageSizeSchema.catch(10).default(10),
};
export const MenuSearchSchema = z.object({
  page: paging.page,
  size: MenuPageSizeSchema.catch(8).default(8),
  category: z
    .enum(['all', ...MENU_CATEGORY_IDS])
    .catch('all')
    .default('all'),
});
export const DispatchSearchSchema = z.object({
  ...paging,
  status: z
    .union([z.literal('ALL'), z.enum(OrderStatus)])
    .catch('ALL')
    .default('ALL'),
  q: z.string().trim().max(100).catch('').default(''),
});
export const HistorySearchSchema = z.object({
  ...paging,
  q: z.string().trim().max(100).catch('').default(''),
});
export const UsersSearchSchema = z.object({
  ...paging,
  q: z.string().trim().max(100).catch('').default(''),
  role: z.enum(['ALL', 'CUSTOMER', 'COURIER', 'ADMIN']).catch('ALL').default('ALL'),
});
