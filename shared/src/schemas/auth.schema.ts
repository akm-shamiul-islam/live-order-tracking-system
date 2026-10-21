import { z } from '../zod.js';
import { UserRole } from '../enums.js';
import { OptionalDeliveryAddressSchema, PhoneSchema } from './lookup.schema.js';

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Use at most 254 characters')
  .pipe(z.email({ error: 'Please provide a valid email address' }));

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
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
  role: z.literal(UserRole.CUSTOMER).default(UserRole.CUSTOMER),
  language: LanguageSchema.optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

export const ForgotPasswordSchema = z.object({ email: EmailSchema });
export const ResetPasswordSchema = z
  .object({
    token: z
      .string()
      .regex(/^reset_[A-Za-z0-9_-]{43}$/, 'Open the password reset link from your email'),
    password: RegisterSchema.shape.password,
    confirmPassword: z.string(),
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
  language: LanguageSchema.optional(),
  languageVersion: z.number().int().nonnegative().optional(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: UserSummarySchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
