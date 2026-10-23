import { z } from './zod.js';
import { OrderDetailsSchema } from './schemas/order.schema.js';

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const MENU_PAGE_SIZES = [8, 16, 32, 60] as const;
export const MenuPageSizeSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(60)]));
export const PageNumberSchema = z.coerce.number().int().min(1).max(1_000_000);
export const PageSizeSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]));

export const PaginationInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});
export type PaginationInfo = z.infer<typeof PaginationInfoSchema>;

export const OrderPageSchema = z.object({
  orders: z.array(OrderDetailsSchema),
  pagination: PaginationInfoSchema,
});
export type OrderPage = z.infer<typeof OrderPageSchema>;

export function paginate(total: number, requestedPage: number, pageSize: number): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { page: Math.min(Math.max(1, requestedPage), totalPages), pageSize, total, totalPages };
}
