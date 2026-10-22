import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
export type ProfilePhotoDocument = ProfilePhoto & Document;
@Schema({ timestamps: true, collection: 'profile_photos' })
export class ProfilePhoto {
  @Prop({ type: String, required: true, index: true }) ownerId: string;
  @Prop({ type: Buffer, required: true, select: false }) data: Buffer;
}
export const ProfilePhotoSchema = SchemaFactory.createForClass(ProfilePhoto);
