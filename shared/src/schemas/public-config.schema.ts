import { z } from 'zod';

export const PricingSettingsSchema = z.object({
  deliveryFee: z.number().finite().nonnegative(),
  taxRate: z.number().finite().min(0).max(1),
});

export type PricingSettings = z.infer<typeof PricingSettingsSchema>;
export const PublicConfigSchema = z.object({ pricing: PricingSettingsSchema });
export type PublicConfig = z.infer<typeof PublicConfigSchema>;
