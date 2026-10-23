import { z } from '../zod.js';
import { OrderPageSchema, PaginationInfoSchema } from '../pagination.js';
import { UserSummarySchema } from './auth.schema.js';
import { AvailableDeliverySchema, OrderDetailsSchema } from './order.schema.js';
import { ProfileChangeSchema, ProfileResponseSchema } from './profile.schema.js';
import { ManagedUserSchema, UserManagementHistorySchema } from './user.schema.js';

export const SuccessResponseSchema = z.object({ success: z.literal(true) });
export const OrderResponseSchema = SuccessResponseSchema.extend({ order: OrderDetailsSchema });
export const OrderListResponseSchema = OrderPageSchema.partial({ pagination: true }).extend({
  success: z.literal(true),
  count: z.number().int().nonnegative(),
});
export const OrderPageResponseSchema = OrderListResponseSchema.required({ pagination: true });
export const AvailableDeliveryPageSchema = z.object({
  orders: z.array(AvailableDeliverySchema),
  pagination: PaginationInfoSchema,
});
export const CouriersResponseSchema = z.object({ couriers: z.array(UserSummarySchema) });
export const ManagedUserResponseSchema = z.object({ user: ManagedUserSchema });
export const UserManagementHistoryResponseSchema = z.object({
  history: z.array(UserManagementHistorySchema),
});
export const ProfileUpdateResponseSchema = z.object({
  change: ProfileChangeSchema,
  profile: ProfileResponseSchema,
});
export const ProfileNotificationResponseSchema = z.object({ notification: ProfileChangeSchema });
