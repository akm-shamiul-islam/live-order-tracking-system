import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { ProfileSnapshot, UserRole } from '@kitchentodoor/shared';

const snapshot = {
  _id: false,
  name: String,
  phone: String,
  address: String,
  photoId: { type: String, default: null },
};
export type ProfileChangeDocument = ProfileChangeRecord & Document;
@Schema({ timestamps: true, collection: 'profile_changes' })
export class ProfileChangeRecord {
  createdAt: Date;
  updatedAt: Date;
  @Prop({ type: String, required: true }) userId: string;
  @Prop({ type: String, required: true }) email: string;
  @Prop({ type: snapshot, required: true }) before: ProfileSnapshot;
  @Prop({ type: snapshot, required: true }) proposed: ProfileSnapshot;
  @Prop({
    type: String,
    enum: ['PENDING', 'APPLYING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
    index: true,
  })
  status: 'PENDING' | 'APPLYING' | 'APPROVED' | 'REJECTED';
  @Prop({ type: Number, required: true, select: false }) baseVersion: number;
  @Prop({ type: Number, required: true, select: false }) baseTokenVersion: number;
  @Prop({ type: String, required: true, select: false }) baseRole: UserRole;
  @Prop({ type: String, select: false }) passwordHash?: string;
  @Prop({ type: Boolean, default: false }) passwordChanged: boolean;
  @Prop({ type: [String], default: [], select: false }) readBy: string[];
  @Prop({ type: [String], default: [], select: false }) dismissedBy: string[];
  @Prop({ type: Date }) reviewedAt?: Date;
  @Prop({ type: String }) reviewedBy?: string;
  @Prop({ type: String, select: false }) reviewedById?: string;
  @Prop({ type: String }) reviewedByEmail?: string;
  @Prop({ type: String }) feedback?: string;
}
export const ProfileChangeRecordSchema = SchemaFactory.createForClass(ProfileChangeRecord);
ProfileChangeRecordSchema.index(
  { userId: 1 },
  {
    name: 'one_pending_profile_per_user',
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'APPLYING'] } },
  },
);
ProfileChangeRecordSchema.index({ userId: 1, updatedAt: -1, _id: -1 });
ProfileChangeRecordSchema.index({ updatedAt: -1, _id: -1 });
