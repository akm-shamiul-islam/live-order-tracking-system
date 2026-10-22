import { z } from '../zod.js';
import { RegisterSchema, UserSummarySchema } from './auth.schema.js';
import { UserIdSchema } from './user.schema.js';
import { ProfilePhotoUploadSchema } from './profile-photo.schema.js';
import { PageNumberSchema, PageSizeSchema, type PaginationInfo } from '../pagination.js';

export const ProfileSnapshotSchema = z.object({
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  photoId: z.string().nullable(),
});
export type ProfileSnapshot = z.infer<typeof ProfileSnapshotSchema>;
export const ProfileStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export const ProfileChangeSchema = z.object({
  id: UserIdSchema,
  userId: UserIdSchema,
  email: z.string(),
  before: ProfileSnapshotSchema,
  proposed: ProfileSnapshotSchema,
  passwordChanged: z.boolean(),
  status: ProfileStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().optional(),
  reviewedBy: z.string().optional(),
  reviewedByEmail: z.string().optional(),
  feedback: z.string().optional(),
  unread: z.boolean(),
});
export type ProfileChange = z.infer<typeof ProfileChangeSchema>;
export const ProfileUserSchema = UserSummarySchema.extend({ updatedAt: z.iso.datetime() });
export type ProfileUser = z.infer<typeof ProfileUserSchema>;
export const ProfileResponseSchema = z.object({
  user: ProfileUserSchema,
  pending: ProfileChangeSchema.nullable(),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
export const UpdateProfileSchema = z
  .strictObject({
    name: RegisterSchema.shape.name,
    phone: z.union([RegisterSchema.shape.phone, z.literal('')]),
    address: RegisterSchema.shape.address.default(''),
    photo: ProfilePhotoUploadSchema.nullable().optional(),
    currentPassword: z.string().max(200).optional(),
    password: RegisterSchema.shape.password.optional(),
    expectedProfileVersion: z.number().int().nonnegative(),
  })
  .superRefine((value, context) => {
    if (value.password && !value.currentPassword)
      context.addIssue({
        code: 'custom',
        path: ['currentPassword'],
        message: 'Enter your current password to change it',
      });
  });
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export const ProfileDecisionSchema = z.discriminatedUnion('decision', [
  z.strictObject({ decision: z.literal('APPROVE') }),
  z.strictObject({
    decision: z.literal('REJECT'),
    feedback: z
      .string()
      .trim()
      .min(3, 'Explain why this request is rejected')
      .max(1000, 'Use at most 1000 characters'),
  }),
]);
export type ProfileDecisionDto = z.infer<typeof ProfileDecisionSchema>;
export const NotificationQuerySchema = z.object({
  page: PageNumberSchema.default(1),
  limit: PageSizeSchema.default(10),
  status: ProfileStatusSchema.optional(),
  userId: UserIdSchema.optional(),
  q: z.string().trim().max(100, 'Use at most 100 characters').default(''),
  view: z.enum(['history', 'dropdown']).default('history'),
});
export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;
export const NotificationReadSchema = z.strictObject({
  unread: z.boolean(),
  expectedUpdatedAt: z.iso.datetime().optional(),
});
export type NotificationReadDto = z.infer<typeof NotificationReadSchema>;
export const NotificationDismissSchema = NotificationReadSchema.pick({ expectedUpdatedAt: true });
export type NotificationDismissDto = z.infer<typeof NotificationDismissSchema>;
export interface NotificationPage {
  notifications: ProfileChange[];
  pagination: PaginationInfo;
  unreadCount: number;
}
