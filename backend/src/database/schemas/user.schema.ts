import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '@kitchentodoor/shared';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({
    type: String,
    required: true,
    enum: [UserRole.CUSTOMER, UserRole.COURIER, UserRole.ADMIN],
    default: UserRole.CUSTOMER,
    index: true,
  })
  role: string;

  @Prop({ type: String, required: false, trim: true })
  phone?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
