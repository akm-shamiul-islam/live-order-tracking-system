import { z } from 'zod';

export const CourierLocationUpdateSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  timestamp: z.string().optional(),
});

export type CourierLocationUpdateDto = z.infer<typeof CourierLocationUpdateSchema>;
