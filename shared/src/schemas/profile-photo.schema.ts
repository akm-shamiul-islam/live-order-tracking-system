import { z } from '../zod.js';

// Protocol ceiling; the configured upload limit can be lower.
export const PROFILE_PHOTO_PROTOCOL_MAX_BYTES = 3_000_000;
export const ProfilePhotoUploadSchema = z
  .string()
  .max(Math.ceil(PROFILE_PHOTO_PROTOCOL_MAX_BYTES / 3) * 4 + 64, 'The photo is too large')
  .regex(
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    'Choose a JPEG, PNG, or WebP photo',
  );
