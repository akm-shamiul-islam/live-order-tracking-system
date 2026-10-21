import { z } from '../zod.js';
import { OrderStatus } from '../enums.js';
import { PhoneSchema, OrderIdentifierSchema } from './lookup.schema.js';

export const OrderItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  name: z.string().min(1, 'Item name is required'),
  price: z.number().positive('Price must be greater than zero'),
  quantity: z
    .number()
    .int()
    .positive('Quantity must be at least 1')
    .max(99, 'Choose at most 99 of each item'),
  imageUrl: z.string().optional(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const CustomerInfoSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name (at least 2 characters)'),
  phone: PhoneSchema,
  address: z.string().trim().min(5, 'Enter a delivery address (at least 5 characters)'),
});

export type CustomerInfo = z.infer<typeof CustomerInfoSchema>;

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const CreateOrderSchema = z.object({
  customer: CustomerInfoSchema,
  items: z
    .array(OrderItemSchema)
    .min(1, 'Order must contain at least one item')
    .max(50, 'Choose at most 50 items'),
  deliveryAddress: z.string().trim().min(5, 'Delivery address is required'),
  deliveryCoordinates: CoordinatesSchema.optional(),
  note: z.string().optional(),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

export const OrderStatusLogSchema = z.object({
  id: z.string().optional(),
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.enum([
    OrderStatus.PLACED,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ]),
  note: z.string().default(''),
  changedBy: z.object({
    userId: z.string().nullable().optional(),
    role: z.string(),
    name: z.string(),
  }),
  timestamp: z.string(),
});

export type OrderStatusLog = z.infer<typeof OrderStatusLogSchema>;

export const DeliveryRequestSchema = z.object({
  courierId: z.string(),
  courierName: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  requestedAt: z.string(),
});
export type DeliveryRequest = z.infer<typeof DeliveryRequestSchema>;
export interface AvailableDelivery {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  createdAt: string;
  request?: DeliveryRequest;
}
export const CancellationReasonSchema = z
  .string()
  .trim()
  .min(5, 'Explain the cancellation in at least 5 characters')
  .max(500, 'Use at most 500 characters');

export const OrderDetailsSchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative().optional(),
  trackingId: z.string().optional(),
  orderNumber: z.string(),
  customer: CustomerInfoSchema,
  courierId: z.string().nullable().optional(),
  deliveryRequests: z.array(DeliveryRequestSchema).default([]),
  items: z.array(OrderItemSchema),
  pricing: z.object({
    subtotal: z.number(),
    deliveryFee: z.number(),
    tax: z.number(),
    total: z.number(),
  }),
  status: z.enum([
    OrderStatus.PLACED,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ]),
  deliveryCoordinates: CoordinatesSchema,
  deliveryLocationProvided: z.boolean().default(false),
  courierCoordinates: z
    .object({
      lat: z.number().nullable(),
      lng: z.number().nullable(),
      lastUpdated: z.string().nullable().optional(),
    })
    .optional(),
  statusHistory: z.array(OrderStatusLogSchema).default([]),
  estimatedDeliveryAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type OrderDetails = z.infer<typeof OrderDetailsSchema>;

export const OrderStatusChangeSchema = z
  .object({
    status: z.enum([
      OrderStatus.PLACED,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ]),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.status !== OrderStatus.CANCELLED) return;
    const result = CancellationReasonSchema.safeParse(value.note);
    if (!result.success)
      context.addIssue({
        code: 'custom',
        path: ['note'],
        message: result.error.issues[0]!.message,
      });
  });

export const UpdateOrderStatusSchema = OrderStatusChangeSchema.safeExtend({
  orderId: OrderIdentifierSchema,
});

export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
