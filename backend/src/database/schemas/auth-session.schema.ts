import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'auth_sessions' })
export class AuthSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  refreshHash: string;

  @Prop({ type: [String], default: [] })
  usedHashes: string[];

  @Prop({ type: Number, required: true })
  tokenVersion: number;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;
}

export type AuthSessionDocument = HydratedDocument<AuthSession>;
export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
