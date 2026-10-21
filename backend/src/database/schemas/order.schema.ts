import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { OrderStatus } from '@kitchentodoor/shared';
import { OrderStatusLogSchema, type OrderStatusLogRecord } from './order-status-log.schema.js';

export type OrderDocument = Order & Document;

@Schema({ _id: false })
export class OrderItemSubdocument {
  @Prop({ type: String, required: true })
  itemId: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: String, required: false })
  imageUrl?: string;
}

@Schema({ _id: false })
export class CustomerSubdocument {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  userId?: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, index: true })
  phone: string;

  @Prop({ type: String, required: true })
  address: string;
}

@Schema({ _id: false })
export class CoordinatesSubdocument {
  @Prop({ type: Number, required: true })
  lat: number;

  @Prop({ type: Number, required: true })
  lng: number;
}

@Schema({ _id: false })
export class CourierCoordinatesSubdocument {
  @Prop({ type: Number, default: null })
  lat: number | null;

  @Prop({ type: Number, default: null })
  lng: number | null;

  @Prop({ type: Date, default: null })
  lastUpdated?: Date | null;
}

@Schema({ _id: false })
export class PricingSubdocument {
  @Prop({ type: Number, required: true })
  subtotal: number;

  @Prop({ type: Number, default: 5.0 })
  deliveryFee: number;

  @Prop({ type: Number, default: 0 })
  tax: number;

  @Prop({ type: Number, required: true })
  total: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItemSubdocument);
export const CustomerSchema = SchemaFactory.createForClass(CustomerSubdocument);
export const CoordinatesSchema = SchemaFactory.createForClass(CoordinatesSubdocument);
export const CourierCoordinatesSchema = SchemaFactory.createForClass(CourierCoordinatesSubdocument);
export const PricingSchema = SchemaFactory.createForClass(PricingSubdocument);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: String, select: false })
  checkoutKey?: string;

  @Prop({ type: String, select: false })
  checkoutRequestHash?: string;

  // Monotonic state revision for status, assignment and request changes; GPS has its own timestamp.
  @Prop({ type: Number, default: 0 })
  deliveryRevision: number;
  @Prop({
    type: [
      {
        _id: false,
        courierId: { type: MongooseSchema.Types.ObjectId, ref: 'User', required: true },
        courierName: String,
        status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] },
        requestedAt: Date,
      },
    ],
    default: [],
  })
  deliveryRequests: {
    courierId: string;
    courierName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requestedAt: Date;
  }[];
  @Prop({ type: String, unique: true, sparse: true, select: false })
  trackingTokenHash?: string;

  @Prop({ type: [OrderStatusLogSchema], default: undefined })
  auditTrail?: OrderStatusLogRecord[];

  @Prop({ type: Boolean, default: false })
  auditTrailComplete: boolean;

  @Prop({ type: String, required: true, unique: true, index: true })
  orderNumber: string;

  @Prop({ type: CustomerSchema, required: true })
  customer: CustomerSubdocument;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  courierId?: string | null;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItemSubdocument[];

  @Prop({ type: PricingSchema, required: true })
  pricing: PricingSubdocument;

  @Prop({
    type: String,
    required: true,
    enum: [
      OrderStatus.PLACED,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ],
    default: OrderStatus.PLACED,
    index: true,
  })
  status: OrderStatus;

  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Boolean, default: false })
  deliveryLocationProvided: boolean;

  @Prop({ type: CoordinatesSchema, required: true })
  deliveryCoordinates: CoordinatesSubdocument;

  @Prop({
    type: CourierCoordinatesSchema,
    default: { lat: null, lng: null, lastUpdated: null },
  })
  courierCoordinates?: CourierCoordinatesSubdocument;

  @Prop({ type: Date, default: null })
  estimatedDeliveryAt?: Date | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index(
  { 'customer.userId': 1, checkoutKey: 1 },
  { unique: true, partialFilterExpression: { checkoutKey: { $type: 'string' } } },
);
OrderSchema.index({ createdAt: -1, _id: -1 });
OrderSchema.index({ status: 1, createdAt: -1, _id: -1 });
OrderSchema.index({ courierId: 1, status: 1, createdAt: -1, _id: -1 });
OrderSchema.index({ 'customer.userId': 1, 'customer.phone': 1, createdAt: -1, _id: -1 });
