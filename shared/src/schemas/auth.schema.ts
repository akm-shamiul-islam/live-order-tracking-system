import { z } from '../zod.js';
import { UserRole } from '../enums.js';
import { OptionalDeliveryAddressSchema, PhoneSchema } from './lookup.schema.js';
import { ProfilePhotoUploadSchema } from './profile-photo.schema.js';

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Use at most 254 characters')
  .pipe(z.email({ error: 'Please provide a valid email address' }));

export const DeviceIdSchema = z.uuid();

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  deviceId: DeviceIdSchema,
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const LanguageSchema = z.enum(['en', 'ja']);
export type Language = z.infer<typeof LanguageSchema>;
export const LanguagePreferenceSchema = z.strictObject({ language: LanguageSchema });
export const LanguagePreferenceResponseSchema = LanguagePreferenceSchema.extend({
  languageVersion: z.number().int().nonnegative(),
});
export type LanguagePreference = z.infer<typeof LanguagePreferenceResponseSchema>;

export const RegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Use at most 100 characters'),
  email: EmailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      'Password must be at most 72 bytes',
    ),
  phone: PhoneSchema,
  address: OptionalDeliveryAddressSchema,
  photo: ProfilePhotoUploadSchema.optional(),
  role: z.literal(UserRole.CUSTOMER).default(UserRole.CUSTOMER),
  language: LanguageSchema.optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

export const ForgotPasswordSchema = z.object({ email: EmailSchema });
export const AuthOtpPurposeSchema = z.enum([
  'email_verification',
  'new_device_login',
  'password_reset',
]);
export type AuthOtpPurpose = z.infer<typeof AuthOtpPurposeSchema>;

export const AuthChallengeResponseSchema = z.strictObject({
  status: z.literal('verification_required'),
  purpose: AuthOtpPurposeSchema,
  challengeId: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  email: EmailSchema,
  expiresAt: z.iso.datetime(),
  resendAvailableAt: z.iso.datetime(),
});
export type AuthChallengeResponse = z.infer<typeof AuthChallengeResponseSchema>;

export const OtpVerificationSchema = z.strictObject({
  challengeId: AuthChallengeResponseSchema.shape.challengeId,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
  deviceId: DeviceIdSchema,
});
export type OtpVerificationDto = z.infer<typeof OtpVerificationSchema>;
export const OtpCodeSchema = z.strictObject({
  code: OtpVerificationSchema.shape.code,
});

export const PasswordResetOtpVerificationSchema = z.strictObject({
  challengeId: AuthChallengeResponseSchema.shape.challengeId,
  code: OtpVerificationSchema.shape.code,
});

export const OtpResendSchema = z.strictObject({
  challengeId: AuthChallengeResponseSchema.shape.challengeId,
});

export const PasswordResetGrantSchema = z.strictObject({
  resetToken: z.string().regex(/^reset_[A-Za-z0-9_-]{43}$/),
});

const resetPasswordFields = {
  password: RegisterSchema.shape.password,
  confirmPassword: z.string(),
};
const passwordsMatch = (value: { password: string; confirmPassword: string }) =>
  value.password === value.confirmPassword;

export const ResetPasswordFieldsSchema = z.object(resetPasswordFields).refine(passwordsMatch, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
});

export const ResetPasswordSchema = z
  .object({
    token: z
      .string()
      .regex(/^reset_[A-Za-z0-9_-]{43}$/, 'Open the password reset link from your email'),
    ...resetPasswordFields,
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const UserSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum([UserRole.CUSTOMER, UserRole.COURIER, UserRole.ADMIN]),
  phone: z.string().optional(),
  address: z.string().optional(),
  photoId: z.string().nullable().optional(),
  profileVersion: z.number().int().nonnegative().optional(),
  language: LanguageSchema.optional(),
  languageVersion: z.number().int().nonnegative().optional(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: UserSummarySchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export const AuthFlowResponseSchema = z.union([AuthResponseSchema, AuthChallengeResponseSchema]);
export type AuthFlowResponse = z.infer<typeof AuthFlowResponseSchema>;
