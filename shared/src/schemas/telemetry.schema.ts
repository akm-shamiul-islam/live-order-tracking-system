import { z } from '../zod.js';
import { OrderIdentifierSchema } from './lookup.schema.js';

export const CourierLocationUpdateSchema = z.object({
  orderId: OrderIdentifierSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  timestamp: z.iso.datetime({ offset: true }),
});

export type CourierLocationUpdateDto = z.infer<typeof CourierLocationUpdateSchema>;
