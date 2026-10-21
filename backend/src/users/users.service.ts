import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  OrderStatus,
  UserRole,
  paginate,
  type ManagedUser,
  type UpdateUserDto,
  type UserPage,
  type UserSummary,
} from '@kitchentodoor/shared';
import { User, type UserDocument } from '../database/schemas/user.schema.js';
import { Order, type OrderDocument } from '../database/schemas/order.schema.js';
import { getRuntimeSettings } from '../config/runtime-settings.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
  ) {}

  private summary(user: UserDocument): ManagedUser {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      disabled: user.disabled ?? false,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async list(page: number, limit: number, search: string, role?: UserRole): Promise<UserPage> {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      ...(role ? { role } : {}),
      ...(search
        ? {
            $or: ['name', 'email', 'phone'].map((field) => ({
              [field]: { $regex: literal, $options: 'i' },
            })),
          }
        : {}),
    };
    const pagination = paginate(await this.users.countDocuments(filter), page, limit);
    const users = await this.users
      .find(filter)
      .select('name email phone role disabled createdAt updatedAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * limit)
      .limit(limit);
    return { users: users.map((user) => this.summary(user)), pagination };
  }

  async update(id: string, body: UpdateUserDto, actor: UserSummary): Promise<ManagedUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found.');
    if (actor.id === id && (body.role !== UserRole.ADMIN || body.disabled)) {
      throw new BadRequestException(
        'Keep your own administrator account active. Ask another administrator to change your access.',
      );
    }
    if (user.role === UserRole.COURIER && (body.role !== UserRole.COURIER || body.disabled)) {
      if (
        await this.orders.exists({
          courierId: id,
          status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        })
      ) {
        throw new ConflictException(
          'Reassign or finish this courier’s active deliveries before changing their access.',
        );
      }
    }
    const changes = {
      name: body.name,
      email: body.email,
      phone: body.phone || '',
      role: body.role,
      disabled: body.disabled,
    };
    const fields = (Object.keys(changes) as (keyof typeof changes)[]).filter(
      (field) => (user[field] ?? '') !== changes[field],
    );
    const revoke = fields.some((field) => ['email', 'role', 'disabled'].includes(field));
    try {
      const updated = await this.users.findOneAndUpdate(
        { _id: id, updatedAt: new Date(body.expectedUpdatedAt) },
        {
          $set: changes,
          ...(revoke ? { $inc: { tokenVersion: 1 } } : {}),
          $push: {
            managementHistory: {
              $each: [{ actorId: actor.id, fields, timestamp: new Date() }],
              $slice: -getRuntimeSettings().USER_MANAGEMENT_AUDIT_MAX,
            },
          },
        },
        { returnDocument: 'after', runValidators: true },
      );
      if (!updated)
        throw new ConflictException(
          'This user was changed in another session. Refresh the list and edit again.',
        );
      return this.summary(updated);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        throw new ConflictException({
          message: 'An account already uses this email address.',
          errors: [{ field: 'email', message: 'Choose a different email address.' }],
        });
      }
      throw error;
    }
  }
}
