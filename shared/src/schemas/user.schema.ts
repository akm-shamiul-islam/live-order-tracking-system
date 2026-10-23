import { z } from '../zod.js';
import { EmailSchema, UserSummarySchema } from './auth.schema.js';
import { PhoneSchema, OptionalDeliveryAddressSchema } from './lookup.schema.js';
import { UserRole } from '../enums.js';
import { PaginationInfoSchema } from '../pagination.js';

export const UserIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Choose a valid user');
export const UserRoleSchema = z.enum(UserRole);
export const ManagedUserSchema = UserSummarySchema.extend({
  disabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ManagedUser = z.infer<typeof ManagedUserSchema>;
export const UserManagementHistorySchema = z.object({
  actorName: z.string(),
  fields: z.array(z.string()),
  timestamp: z.iso.datetime(),
});
export type UserManagementHistory = z.infer<typeof UserManagementHistorySchema>;

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(100),
  email: EmailSchema,
  phone: z.union([PhoneSchema, z.literal('')]).optional(),
  address: OptionalDeliveryAddressSchema,
  role: UserRoleSchema,
  disabled: z.boolean(),
  expectedUpdatedAt: z.iso.datetime(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export const UserPageSchema = z.object({
  users: z.array(ManagedUserSchema),
  pagination: PaginationInfoSchema,
});
export type UserPage = z.infer<typeof UserPageSchema>;

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.CUSTOMER]: 'User (customer)',
  [UserRole.COURIER]: 'Courier',
  [UserRole.ADMIN]: 'Admin',
};
