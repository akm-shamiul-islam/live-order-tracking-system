import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type QueryFilter } from 'mongoose';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {
  UserRole,
  paginate,
  type ProfileChange,
  type ProfileDecisionDto,
  type ProfileResponse,
  type ProfileSnapshot,
  type ProfileUser,
  type NotificationPage,
  type NotificationQuery,
  type UpdateProfileDto,
  type UserSummary,
} from '@kitchentodoor/shared';
import { User, type UserDocument } from '../database/schemas/user.schema.js';
import {
  ProfileChangeRecord,
  type ProfileChangeDocument,
} from '../database/schemas/profile-change.schema.js';
import {
  ProfilePhoto,
  type ProfilePhotoDocument,
} from '../database/schemas/profile-photo.schema.js';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { AccountAccessCoordinator } from '../common/account-access-coordinator.js';

const snapshot = (user: UserDocument): ProfileSnapshot => ({
  name: user.name,
  phone: user.phone || '',
  address: user.address || '',
  photoId: user.photoId || null,
});
const cleanSnapshot = (value: ProfileSnapshot): ProfileSnapshot => ({
  name: value.name,
  phone: value.phone,
  address: value.address,
  photoId: value.photoId,
});

@Injectable()
export class ProfilesService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private recovering = false;
  private readonly logger = new Logger(ProfilesService.name);
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(ProfileChangeRecord.name) private readonly changes: Model<ProfileChangeDocument>,
    @InjectModel(ProfilePhoto.name) private readonly photos: Model<ProfilePhotoDocument>,
    @Inject(AccountAccessCoordinator) private readonly access: AccountAccessCoordinator,
  ) {}

  async onModuleInit() {
    await this.changes.init();
    this.timer = setInterval(() => {
      void this.recover();
    }, getRuntimeSettings().PROFILE_RECOVERY_INTERVAL_MS);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private summary(user: UserDocument): ProfileUser {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      photoId: user.photoId || null,
      role: user.role,
      language: user.language,
      languageVersion: user.languageVersion ?? 0,
      profileVersion: user.profileVersion ?? 0,
      updatedAt: user.updatedAt.toISOString(),
    };
  }
  private present(change: ProfileChangeDocument, actor: UserSummary): ProfileChange {
    // Explicit allowlist: password hashes, base access versions and other recipients' read state never leave the service.
    return {
      id: change._id.toString(),
      userId: change.userId,
      email: change.email,
      before: cleanSnapshot(change.before),
      proposed: cleanSnapshot(change.proposed),
      passwordChanged: change.passwordChanged,
      status: change.status === 'APPLYING' ? 'PENDING' : change.status,
      createdAt: change.createdAt.toISOString(),
      updatedAt: change.updatedAt.toISOString(),
      reviewedAt: change.reviewedAt?.toISOString(),
      reviewedBy: change.reviewedBy,
      reviewedByEmail: change.reviewedByEmail,
      feedback: change.feedback,
      unread: !(change.readBy ?? []).includes(actor.id),
    };
  }

  async preparePhoto(ownerId: string, source: string): Promise<string> {
    const settings = getRuntimeSettings();
    const encoded = source.split(',')[1] || '';
    const input = Buffer.from(encoded, 'base64');
    if (!input.length || input.length > settings.PROFILE_PHOTO_MAX_BYTES)
      throw new BadRequestException('The photo is too large');
    let data: Buffer;
    try {
      const image = sharp(input, {
        limitInputPixels: settings.PROFILE_PHOTO_MAX_PIXELS,
        animated: false,
        failOn: 'warning',
      });
      const meta = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format || '') || (meta.pages ?? 1) > 1)
        throw new Error('Unsupported photo');
      // Decode, strip metadata, correct orientation and re-encode. Never serve user-uploaded SVG/HTML or original bytes.
      data = await image
        .rotate()
        .resize(settings.PROFILE_PHOTO_SIZE, settings.PROFILE_PHOTO_SIZE, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Choose a valid JPEG, PNG, or WebP photo');
    }
    const photo = await this.photos.create({ ownerId, data });
    return photo._id.toString();
  }

  async registrationPhoto(user: UserDocument): Promise<void> {
    if (!user.registrationPhotoId || user.emailVerified === false || user.disabled) return;
    const proposed = { ...snapshot(user), photoId: user.registrationPhotoId };
    await this.changes.updateOne(
      { _id: user.registrationPhotoId },
      {
        $setOnInsert: {
          userId: user._id.toString(),
          email: user.email,
          before: snapshot(user),
          proposed,
          status: 'PENDING',
          baseVersion: user.profileVersion ?? 0,
          baseTokenVersion: user.tokenVersion ?? 0,
          baseRole: user.role,
          passwordChanged: false,
          readBy: [user._id.toString()],
        },
      },
      { upsert: true, runValidators: true },
    );
    await this.users.updateOne(
      { _id: user._id, registrationPhotoId: user.registrationPhotoId },
      { $unset: { registrationPhotoId: 1 } },
      { timestamps: false },
    );
  }

  async get(actor: UserSummary): Promise<ProfileResponse> {
    const user = await this.users.findById(actor.id).select('+registrationPhotoId');
    if (!user || user.disabled) throw new NotFoundException('Profile not found.');
    await this.registrationPhoto(user);
    const pending = await this.changes
      .findOne({ userId: actor.id, status: { $in: ['PENDING', 'APPLYING'] } })
      .select('+readBy');
    return { user: this.summary(user), pending: pending ? this.present(pending, actor) : null };
  }

  async request(
    actor: UserSummary,
    body: UpdateProfileDto,
  ): Promise<{ change: ProfileChange; profile: ProfileResponse }> {
    return this.access.run(async () => {
      const user = await this.users.findById(actor.id).select('+registrationPhotoId');
      if (!user || user.disabled) throw new NotFoundException('Profile not found.');
      await this.registrationPhoto(user);
      if ((user.profileVersion ?? 0) !== body.expectedProfileVersion)
        throw new ConflictException('Your profile changed. Refresh it before submitting again.');
      if (await this.changes.exists({ userId: actor.id, status: { $in: ['PENDING', 'APPLYING'] } }))
        throw new ConflictException('You already have a profile change awaiting review.');
      if (body.password && !(await bcrypt.compare(body.currentPassword || '', user.passwordHash)))
        throw new BadRequestException({
          message: 'Check your current password.',
          errors: [{ field: 'currentPassword', message: 'Check your current password.' }],
        });
      const before = snapshot(user);
      const proposed: ProfileSnapshot = {
        name: body.name,
        phone: body.phone,
        address: body.address || '',
        photoId: body.photo === null ? null : before.photoId,
      };
      if (body.photo) proposed.photoId = await this.preparePhoto(actor.id, body.photo);
      if (!body.password && JSON.stringify(before) === JSON.stringify(proposed))
        throw new BadRequestException('Change at least one profile field before submitting.');
      let change: ProfileChangeDocument;
      try {
        change = await this.changes.create({
          userId: actor.id,
          email: user.email,
          before,
          proposed,
          baseVersion: user.profileVersion ?? 0,
          baseTokenVersion: user.tokenVersion ?? 0,
          baseRole: user.role,
          passwordChanged: !!body.password,
          passwordHash: body.password
            ? await bcrypt.hash(body.password, getRuntimeSettings().PASSWORD_HASH_ROUNDS)
            : undefined,
          readBy: [actor.id],
        });
      } catch (error) {
        if (body.photo && proposed.photoId)
          await this.photos.deleteOne({ _id: proposed.photoId }).catch(() => undefined);
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
          throw new ConflictException('You already have a profile change awaiting review.');
        throw error;
      }
      // Administrators can maintain their own profile immediately, with the same permanent audit record.
      if (user.role === UserRole.ADMIN) change = await this.approve(change._id.toString(), actor);
      return { change: this.present(change, actor), profile: await this.get(actor) };
    });
  }

  private scope(actor: UserSummary): QueryFilter<ProfileChangeDocument> {
    return actor.role === UserRole.ADMIN ? {} : { userId: actor.id };
  }
  async notifications(
    actor: UserSummary,
    { page, limit: size, status, userId, q, view }: NotificationQuery,
  ): Promise<NotificationPage> {
    const scope = this.scope(actor);
    if (userId && actor.role !== UserRole.ADMIN && userId !== actor.id)
      throw new ForbiddenException();
    const filter: QueryFilter<ProfileChangeDocument> = {
      ...scope,
      ...(userId ? { userId } : {}),
      ...(view === 'dropdown' ? { dismissedBy: { $ne: actor.id } } : {}),
      ...(status === 'PENDING'
        ? { status: { $in: ['PENDING', 'APPLYING'] } }
        : status
          ? { status }
          : {}),
    };
    if (q) {
      // Search literal text, never execute a user-supplied regular expression.
      const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        'before.name',
        'proposed.name',
        'email',
        'feedback',
        'reviewedBy',
        'reviewedByEmail',
      ].map((field) => ({ [field]: pattern }));
    }
    const pagination = paginate(await this.changes.countDocuments(filter), page, size);
    const [rows, unreadCount] = await Promise.all([
      this.changes
        .find(filter)
        .select('+readBy')
        .sort({ updatedAt: -1, _id: -1 })
        .skip((pagination.page - 1) * size)
        .limit(size),
      this.changes.countDocuments({
        ...scope,
        readBy: { $ne: actor.id },
        dismissedBy: { $ne: actor.id },
      }),
    ]);
    return { notifications: rows.map((row) => this.present(row, actor)), pagination, unreadCount };
  }
  async notification(id: string, actor: UserSummary): Promise<ProfileChange> {
    const change = await this.changes.findOne({ _id: id, ...this.scope(actor) }).select('+readBy');
    if (!change) throw new NotFoundException('Notification not found.');
    return this.present(change, actor);
  }
  private async assertNotificationUpdated(id: string, actor: UserSummary, matched: boolean) {
    if (matched) return;
    if (!(await this.changes.exists({ _id: id, ...this.scope(actor) })))
      throw new NotFoundException('Notification not found.');
    throw new ConflictException('This notification changed. Refresh to see its latest status.');
  }
  async read(
    id: string,
    actor: UserSummary,
    unread: boolean,
    expectedUpdatedAt?: string,
  ): Promise<void> {
    const result = await this.changes.updateOne(
      {
        _id: id,
        ...this.scope(actor),
        ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}),
      },
      unread
        ? { $pull: { readBy: actor.id, dismissedBy: actor.id } }
        : { $addToSet: { readBy: actor.id } },
      { timestamps: false },
    );
    await this.assertNotificationUpdated(id, actor, result.matchedCount > 0);
  }
  async dismiss(id: string, actor: UserSummary, expectedUpdatedAt?: string): Promise<void> {
    const result = await this.changes.updateOne(
      {
        _id: id,
        ...this.scope(actor),
        ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}),
      },
      { $addToSet: { readBy: actor.id, dismissedBy: actor.id } },
      { timestamps: false },
    );
    await this.assertNotificationUpdated(id, actor, result.matchedCount > 0);
  }
  async review(id: string, body: ProfileDecisionDto, actor: UserSummary): Promise<ProfileChange> {
    return this.access.run(async () => {
      const administrator = await this.users.findById(actor.id);
      if (administrator?.role !== UserRole.ADMIN || administrator.disabled)
        throw new ForbiddenException();
      const reviewer = { ...actor, name: administrator.name, email: administrator.email };
      if (body.decision === 'APPROVE') return this.present(await this.approve(id, reviewer), actor);
      const change = await this.changes
        .findOneAndUpdate(
          { _id: id, status: 'PENDING' },
          {
            $set: {
              status: 'REJECTED',
              feedback: body.feedback,
              reviewedAt: new Date(),
              reviewedBy: reviewer.name,
              reviewedById: actor.id,
              reviewedByEmail: reviewer.email,
              readBy: [actor.id],
              dismissedBy: [],
            },
            $unset: { passwordHash: 1 },
          },
          { returnDocument: 'after', runValidators: true },
        )
        .select('+readBy');
      if (!change)
        throw new ConflictException(
          'This request has already been reviewed. Refresh to see its status.',
        );
      return this.present(change, actor);
    });
  }

  private async approve(id: string, actor: UserSummary): Promise<ProfileChangeDocument> {
    const locked = await this.changes.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      {
        $set: {
          status: 'APPLYING',
          reviewedAt: new Date(),
          reviewedBy: actor.name,
          reviewedById: actor.id,
          reviewedByEmail: actor.email,
        },
      },
      { returnDocument: 'after' },
    );
    const change = locked ?? (await this.changes.findOne({ _id: id, status: 'APPLYING' }));
    if (!change)
      throw new ConflictException(
        'This request has already been reviewed. Refresh to see its status.',
      );
    return this.applyApproved(id, actor.id);
  }

  private async applyApproved(id: string, reviewerId?: string): Promise<ProfileChangeDocument> {
    const change = await this.changes
      .findById(id)
      .select('+passwordHash +baseVersion +baseTokenVersion +baseRole +readBy');
    if (!change || change.status !== 'APPLYING')
      throw new ConflictException('This request has already been reviewed.');
    const password = change.passwordHash;
    const updated = await this.users.findOneAndUpdate(
      {
        _id: change.userId,
        disabled: { $ne: true },
        role: change.baseRole,
        $expr: { $eq: [{ $ifNull: ['$profileVersion', 0] }, change.baseVersion] },
      },
      {
        $set: {
          name: change.proposed.name,
          phone: change.proposed.phone,
          address: change.proposed.address,
          photoId: change.proposed.photoId,
          lastProfileChangeId: id,
          ...(password ? { passwordHash: password } : {}),
          ...(password ? { trustedDeviceHashes: [] } : {}),
        },
        $inc: { profileVersion: 1, ...(password ? { tokenVersion: 1 } : {}) },
        ...(password
          ? { $unset: { resetTokenHash: 1, resetExpiresAt: 1, resetRequestedAt: 1 } }
          : {}),
      },
      { returnDocument: 'after', runValidators: true },
    );
    // A durable APPLYING decision can resume after a crash between these writes. It never applies twice.
    const applied =
      updated || (await this.users.findOne({ _id: change.userId, lastProfileChangeId: id }));
    const result = await this.changes
      .findOneAndUpdate(
        { _id: id, status: 'APPLYING' },
        {
          $set: {
            status: applied ? 'APPROVED' : 'REJECTED',
            readBy: reviewerId ? [reviewerId] : [],
            dismissedBy: [],
            ...(applied
              ? {}
              : {
                  feedback:
                    'The account changed while this request was pending. Please submit a new request.',
                }),
          },
          $unset: { passwordHash: 1 },
        },
        { returnDocument: 'after' },
      )
      .select('+readBy');
    if (!result) throw new ConflictException('This request has already been reviewed.');
    return result;
  }

  private async recover() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      const limit = getRuntimeSettings().PROFILE_RECOVERY_BATCH_SIZE;
      const registrations = await this.users
        .find({
          registrationPhotoId: { $exists: true },
          emailVerified: { $ne: false },
          disabled: { $ne: true },
        })
        .select('+registrationPhotoId')
        .limit(limit);
      await Promise.all(registrations.map((user) => this.registrationPhoto(user)));
      for (const change of await this.changes.find({ status: 'APPLYING' }).limit(limit)) {
        // oxlint-disable-next-line no-await-in-loop -- Each cross-account update must acquire the shared coordinator sequentially.
        await this.access.run(() => this.applyApproved(change._id.toString()));
      }
    } catch {
      this.logger.warn(
        'A pending profile decision will be retried when account storage is available.',
      );
    } finally {
      this.recovering = false;
    }
  }
  async photo(id: string, actor: UserSummary): Promise<Buffer> {
    const photo = await this.photos
      .findOne({ _id: id, ...(actor.role === UserRole.ADMIN ? {} : { ownerId: actor.id }) })
      .select('+data');
    if (!photo) throw new NotFoundException('Photo not found.');
    return Buffer.from(photo.data);
  }
  async discardPhoto(id: string) {
    await this.photos.deleteOne({ _id: id });
  }
}
