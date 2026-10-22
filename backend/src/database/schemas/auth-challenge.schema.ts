import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import type { AuthOtpPurpose } from '@kitchentodoor/shared';

@Schema({ timestamps: true, collection: 'auth_challenges' })
export class AuthChallenge {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: String, required: true, unique: true, select: false })
  challengeKey: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ type: Number, default: null })
  userTokenVersion: number | null;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  email: string;

  @Prop({
    type: String,
    required: true,
    enum: ['email_verification', 'new_device_login', 'password_reset'],
  })
  purpose: AuthOtpPurpose;

  @Prop({ type: String, enum: ['en', 'ja'], default: 'en' })
  language: 'en' | 'ja';

  @Prop({ type: String, required: true, select: false })
  codeHash: string;

  @Prop({ type: String, select: false })
  deviceHash?: string;

  @Prop({ type: Number, required: true, default: 0 })
  attempts: number;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, required: true })
  lastSentAt: Date;

  @Prop({ type: Date, required: true })
  resendAvailableAt: Date;

  @Prop({ type: Date, default: null })
  verifiedAt: Date | null;

  @Prop({ type: String, select: false })
  resetGrantHash?: string;

  @Prop({ type: Date, select: false })
  resetGrantExpiresAt?: Date;

  @Prop({ type: Date, default: null })
  consumedAt: Date | null;
}

export type AuthChallengeDocument = HydratedDocument<AuthChallenge>;
export const AuthChallengeSchema = SchemaFactory.createForClass(AuthChallenge);
AuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
