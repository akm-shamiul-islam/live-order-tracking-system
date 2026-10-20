import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type OrderStatusLogDocument = OrderStatusLog & Document;

@Schema({ _id: false })
export class ChangedBySubdocument {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId?: string | null;

  @Prop({ type: String, required: true })
  role: string;

  @Prop({ type: String, required: true })
  name: string;
}

export const ChangedBySchema = SchemaFactory.createForClass(ChangedBySubdocument);

@Schema({
  timestamps: { createdAt: 'timestamp', updatedAt: false },
  collection: 'order_status_logs',
})
export class OrderStatusLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: string;

  @Prop({ type: String, required: true, index: true })
  orderNumber: string;

  @Prop({ type: String, required: true })
  status: string;

  @Prop({ type: String, default: '' })
  note: string;

  @Prop({ type: ChangedBySchema, required: true })
  changedBy: ChangedBySubdocument;

  @Prop({ type: Date, default: Date.now, index: 1 })
  timestamp: Date;
}

export const OrderStatusLogSchema = SchemaFactory.createForClass(OrderStatusLog);
