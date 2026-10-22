import { z } from '../zod.js';

export const PricingSettingsSchema = z.object({
  deliveryFee: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1),
});

export type PricingSettings = z.infer<typeof PricingSettingsSchema>;
export const PublicConfigSchema = z.object({
  pricing: PricingSettingsSchema,
  profilePhotoMaxBytes: z.number().int().positive().max(3_000_000).default(2_000_000),
});
export type PublicConfig = z.infer<typeof PublicConfigSchema>;
