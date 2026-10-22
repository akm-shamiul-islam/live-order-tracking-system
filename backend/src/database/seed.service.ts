import { Injectable, type OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, type UserDocument } from './schemas/user.schema.js';
import { RegisterSchema, UserRole } from '@kitchentodoor/shared';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { getStaffSeedEmail, getStaffSeedPassword } from '../config/staff-seed-settings.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async bootstrapAdministrator() {
    if (process.env.NODE_ENV !== 'production')
      throw new Error('Initial administrator creation requires NODE_ENV=production.');
    const email = RegisterSchema.shape.email.safeParse(process.env.BOOTSTRAP_ADMIN_EMAIL);
    const password = RegisterSchema.shape.password
      .min(12, 'Use at least 12 characters')
      .safeParse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
    if (!email.success || !password.success)
      throw new Error(
        'Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of 12 characters or more (at most 72 bytes).',
      );
    if (await this.userModel.findOne({ role: UserRole.ADMIN, disabled: { $ne: true } }))
      throw new Error('An active administrator already exists. Use the admin-only Users page.');
    if (await this.userModel.findOne({ email: email.data }))
      throw new Error('This email already belongs to an account. No role or password was changed.');
    await this.userModel.create({
      name: 'Kitchen Administrator',
      email: email.data,
      role: UserRole.ADMIN,
      emailVerified: true,
      passwordHash: await bcrypt.hash(password.data, getRuntimeSettings().PASSWORD_HASH_ROUNDS),
    });
  }

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'production') {
      this.logger.log('Default staff account seeding is disabled in production.');
      return;
    }
    await this.seedUsers();
  }

  async resetDevelopmentAdmin() {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error(
        'Development admin password reset is only allowed with NODE_ENV=development.',
      );
    }
    const email = getStaffSeedEmail('ADMIN');
    const admin = await this.userModel.findOne({ email });
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new Error(
        'The configured development administrator was not found. No account was changed.',
      );
    }
    const password = getStaffSeedPassword('ADMIN');
    const passwordHash = await bcrypt.hash(password, getRuntimeSettings().PASSWORD_HASH_ROUNDS);
    const updated = await this.userModel.findOneAndUpdate(
      {
        _id: admin._id,
        role: UserRole.ADMIN,
        $expr: {
          $and: [
            { $eq: [{ $ifNull: ['$tokenVersion', 0] }, admin.tokenVersion ?? 0] },
            { $eq: [{ $ifNull: ['$profileVersion', 0] }, admin.profileVersion ?? 0] },
          ],
        },
      },
      {
        $set: { passwordHash, trustedDeviceHashes: [] },
        $inc: { tokenVersion: 1, profileVersion: 1 },
        $unset: { resetTokenHash: 1, resetExpiresAt: 1, resetRequestedAt: 1 },
      },
      { returnDocument: 'after', runValidators: true },
    );
    if (!updated)
      throw new Error('The administrator account changed during recovery. Please retry.');
    this.logger.log(
      'Development administrator password reset to the configured ADMIN_DEFAULT_PASSWORD.',
    );
  }

  private async seedUsers() {
    const adminEmail = getStaffSeedEmail('ADMIN');
    const existingAdmin = await this.userModel.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const adminPassword = getStaffSeedPassword('ADMIN');
      const salt = await bcrypt.genSalt(getRuntimeSettings().PASSWORD_HASH_ROUNDS);
      const passwordHash = await bcrypt.hash(adminPassword, salt);

      await this.userModel.create({
        name: 'Head Dispatcher Admin',
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        emailVerified: true,
        phone: '+1-555-0100',
      });
      this.logger.log(`🌱 Default admin created: ${adminEmail}`);
    }

    const courierEmail = getStaffSeedEmail('COURIER');
    const existingCourier = await this.userModel.findOne({ email: courierEmail });

    if (!existingCourier) {
      const courierPassword = getStaffSeedPassword('COURIER');
      const salt = await bcrypt.genSalt(getRuntimeSettings().PASSWORD_HASH_ROUNDS);
      const passwordHash = await bcrypt.hash(courierPassword, salt);

      await this.userModel.create({
        name: 'Alex FastCourier',
        email: courierEmail,
        passwordHash,
        role: UserRole.COURIER,
        emailVerified: true,
        phone: '+1-555-0101',
      });
      this.logger.log(`🌱 Default courier created: ${courierEmail}`);
    }
  }
}
