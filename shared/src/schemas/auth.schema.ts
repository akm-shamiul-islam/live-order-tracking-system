import { z } from 'zod';
import { UserRole } from '../enums.js';
import { PhoneSchema } from './lookup.schema.js';

const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Please provide a valid email address' }));

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: EmailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      'Password must be at most 72 bytes',
    ),
  phone: PhoneSchema,
  role: z.literal(UserRole.CUSTOMER).default(UserRole.CUSTOMER),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

export const UserSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum([UserRole.CUSTOMER, UserRole.COURIER, UserRole.ADMIN]),
  phone: z.string().optional(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: UserSummarySchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
