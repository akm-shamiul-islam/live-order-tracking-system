import { z } from './zod.js';
import type { OrderDetails } from './schemas/order.schema.js';

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const MENU_PAGE_SIZES = [8, 16, 32, 60] as const;
export const MenuPageSizeSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(60)]));
export const PageNumberSchema = z.coerce.number().int().min(1).max(1_000_000);
export const PageSizeSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]));

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface OrderPage {
  orders: OrderDetails[];
  pagination: PaginationInfo;
}

export function paginate(total: number, requestedPage: number, pageSize: number): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { page: Math.min(Math.max(1, requestedPage), totalPages), pageSize, total, totalPages };
}
