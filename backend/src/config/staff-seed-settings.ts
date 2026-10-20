import { LoginSchema } from '@kitchentodoor/shared';

export function getStaffSeedEmail(kind: 'ADMIN' | 'COURIER'): string {
  const key = `${kind}_DEFAULT_EMAIL`;
  const parsed = LoginSchema.shape.email.safeParse(process.env[key]);
  if (!parsed.success)
    throw new Error(`Set a valid ${key} in .env before seeding development staff.`);
  return parsed.data;
}

export function getStaffSeedPassword(kind: 'ADMIN' | 'COURIER'): string {
  const key = `${kind}_DEFAULT_PASSWORD`;
  const parsed = LoginSchema.shape.password.safeParse(process.env[key]);
  if (!parsed.success || new TextEncoder().encode(parsed.data).length > 72) {
    throw new Error(
      `Set ${key} in .env to a password containing 6 characters or more and no more than 72 bytes.`,
    );
  }
  return parsed.data;
}
