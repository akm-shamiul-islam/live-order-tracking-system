import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema.js';
import { UserRole } from '@kitchentodoor/shared';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { getStaffSeedEmail, getStaffSeedPassword } from '../config/staff-seed-settings.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

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
    admin.passwordHash = await bcrypt.hash(password, getRuntimeSettings().PASSWORD_HASH_ROUNDS);
    await admin.save();
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
        phone: '+1-555-0101',
      });
      this.logger.log(`🌱 Default courier created: ${courierEmail}`);
    }
  }
}
