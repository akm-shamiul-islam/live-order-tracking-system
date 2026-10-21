import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole, type Language } from '@kitchentodoor/shared';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  createdAt: Date;
  updatedAt: Date;

  @Prop({
    type: [{ _id: false, actorId: String, fields: [String], timestamp: Date }],
    default: [],
    select: false,
  })
  managementHistory: { actorId: string; fields: string[]; timestamp: Date }[];

  @Prop({ type: String, select: false })
  resetTokenHash?: string;

  @Prop({ type: Date, select: false })
  resetExpiresAt?: Date;

  @Prop({ type: Date, select: false })
  resetRequestedAt?: Date;

  @Prop({ type: Number, default: 0 })
  tokenVersion: number;

  @Prop({ type: Boolean, default: false })
  disabled: boolean;

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
  role: UserRole;

  @Prop({ type: String, required: false, trim: true })
  phone?: string;

  @Prop({ type: String, required: false, trim: true, maxLength: 500 })
  address?: string;

  @Prop({ type: String, enum: ['en', 'ja'], default: 'en' })
  language: Language;

  @Prop({ type: Number, default: 0 })
  languageVersion: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ resetTokenHash: 1 }, { unique: true, sparse: true });
