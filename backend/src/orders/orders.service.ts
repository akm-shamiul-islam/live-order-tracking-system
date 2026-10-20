import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { getRuntimeSettings, getPricingSettings } from '../config/runtime-settings.js';
import { Order, OrderDocument } from '../database/schemas/order.schema.js';
import {
  OrderStatusLog,
  OrderStatusLogDocument,
} from '../database/schemas/order-status-log.schema.js';
import {
  CreateOrderDto,
  OrderDetails,
  OrderStatus,
  OrderStatusLog as IOrderStatusLog,
  isValidStatusTransition,
  UserRole,
  MENU_ITEMS,
  calculatePricing,
} from '@kitchentodoor/shared';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(OrderStatusLog.name)
    private readonly statusLogModel: Model<OrderStatusLogDocument>,
  ) {}

  generateOrderNumber(): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `KTD-${randomDigits}`;
  }

  async createOrder(createOrderDto: CreateOrderDto, userId?: string): Promise<OrderDetails> {
    const items = createOrderDto.items.map((item) => {
      const menuItem = MENU_ITEMS.find((entry) => entry.id === item.itemId);
      if (!menuItem)
        throw new BadRequestException(
          `Item "${item.itemId}" is no longer on the menu. Please update your cart.`,
        );
      return {
        itemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        imageUrl: menuItem.emoji,
      };
    });
    const pricing = calculatePricing(items, getPricingSettings());

    let orderNumber = this.generateOrderNumber();
    while (await this.orderModel.findOne({ orderNumber })) {
      orderNumber = this.generateOrderNumber();
    }

    const newOrder = await this.orderModel.create({
      orderNumber,
      customer: {
        userId: userId || undefined,
        name: createOrderDto.customer.name,
        phone: createOrderDto.customer.phone,
        address: createOrderDto.deliveryAddress,
      },
      items,
      pricing,
      status: OrderStatus.PLACED,
      deliveryCoordinates: createOrderDto.deliveryCoordinates || {
        lat: 40.7128,
        lng: -74.006,
      },
      courierCoordinates: {
        lat: 40.7128 - 0.02,
        lng: -74.006 - 0.02,
        lastUpdated: new Date(),
      },
      estimatedDeliveryAt: new Date(
        Date.now() + getRuntimeSettings().ORDER_ESTIMATE_MINUTES * 60 * 1000,
      ),
    });

    const initialLog = await this.statusLogModel.create({
      orderId: newOrder._id.toString(),
      orderNumber: newOrder.orderNumber,
      status: OrderStatus.PLACED,
      note: createOrderDto.note || 'Order received and logged in kitchen system',
      changedBy: {
        userId: userId || null,
        role: UserRole.CUSTOMER,
        name: createOrderDto.customer.name,
      },
    });

    return this.mapToDetails(newOrder, [initialLog]);
  }

  private buildOrderLookupFilter(identifier: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    return isObjectId
      ? { $or: [{ _id: identifier }, { orderNumber: identifier }] }
      : { orderNumber: identifier };
  }

  async getOrderById(identifier: string): Promise<OrderDetails> {
    const order = await this.orderModel.findOne(this.buildOrderLookupFilter(identifier));

    if (!order) {
      throw new NotFoundException(`Order with identifier "${identifier}" was not found`);
    }

    const logs = await this.statusLogModel
      .find({ orderId: order._id.toString() })
      .sort({ timestamp: -1 });

    return this.mapToDetails(order, logs);
  }

  private listFilter(status?: string, search = '') {
    const filter: Record<string, unknown> = status ? { status } : {};
    if (search) {
      const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = ['orderNumber', 'customer.name', 'customer.phone'].map((field) => ({
        [field]: { $regex: literal, $options: 'i' },
      }));
    }
    return filter;
  }

  countOrders(status?: string, search = '') {
    return this.orderModel.countDocuments(this.listFilter(status, search));
  }

  countMyOrders(phone: string) {
    return this.orderModel.countDocuments({ 'customer.phone': phone });
  }

  async getAllOrders(
    status?: string,
    limit = getRuntimeSettings().ORDER_LIST_DEFAULT_LIMIT,
    page = 1,
    search = '',
  ): Promise<OrderDetails[]> {
    const query = this.orderModel
      .find(this.listFilter(status, search))
      .sort({ createdAt: -1, _id: -1 });
    if (page > 1) query.skip((page - 1) * limit);
    const orders = await query.limit(limit);

    const orderIds = orders.map((o) => o._id.toString());
    const allLogs = await this.statusLogModel
      .find({ orderId: { $in: orderIds } })
      .sort({ timestamp: -1 });

    return orders.map((order) => {
      const logs = allLogs.filter((l) => l.orderId.toString() === order._id.toString());
      return this.mapToDetails(order, logs);
    });
  }

  async getMyOrders(
    phone: string,
    limit = getRuntimeSettings().ORDER_HISTORY_LIMIT,
    page = 1,
  ): Promise<OrderDetails[]> {
    const query = this.orderModel
      .find({ 'customer.phone': phone })
      .sort({ createdAt: -1, _id: -1 });
    if (page > 1) query.skip((page - 1) * limit);
    const orders = await query.limit(limit);

    const orderIds = orders.map((o) => o._id.toString());
    const allLogs = await this.statusLogModel
      .find({ orderId: { $in: orderIds } })
      .sort({ timestamp: -1 });

    return orders.map((order) => {
      const logs = allLogs.filter((l) => l.orderId.toString() === order._id.toString());
      return this.mapToDetails(order, logs);
    });
  }

  async updateOrderStatus(
    identifier: string,
    newStatus: OrderStatus,
    note?: string,
    changedBy?: { userId?: string; role: string; name: string },
  ): Promise<{ order: OrderDetails; logEntry: IOrderStatusLog }> {
    const order = await this.orderModel.findOne(this.buildOrderLookupFilter(identifier));

    if (!order) {
      throw new NotFoundException(`Order "${identifier}" not found`);
    }

    if (!isValidStatusTransition(order.status as OrderStatus, newStatus)) {
      throw new BadRequestException(
        `Invalid status progression from "${order.status}" to "${newStatus}"`,
      );
    }

    const updatedOrder = await this.orderModel.findOneAndUpdate(
      { _id: order._id, status: order.status },
      { $set: { status: newStatus } },
      { returnDocument: 'after' },
    );
    if (!updatedOrder) {
      throw new ConflictException(
        'This order changed in another session. Refresh the order and try again.',
      );
    }

    const logEntry = await this.statusLogModel.create({
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: newStatus,
      note: note || `Status advanced to ${newStatus}`,
      changedBy: changedBy || {
        userId: null,
        role: UserRole.ADMIN,
        name: 'System Dispatcher',
      },
    });

    const logs = await this.statusLogModel
      .find({ orderId: order._id.toString() })
      .sort({ timestamp: -1 });

    return {
      order: this.mapToDetails(updatedOrder, logs),
      logEntry: this.mapLog(logEntry),
    };
  }

  async updateCourierCoordinates(identifier: string, lat: number, lng: number): Promise<void> {
    const lookup = this.buildOrderLookupFilter(identifier);
    const result = await this.orderModel.updateOne(
      {
        ...lookup,
        status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
      },
      {
        $set: {
          'courierCoordinates.lat': lat,
          'courierCoordinates.lng': lng,
          'courierCoordinates.lastUpdated': new Date(),
        },
      },
    );
    if (result.matchedCount === 0) {
      if (await this.orderModel.exists(lookup)) {
        throw new ConflictException(
          'Courier location cannot be updated after an order is delivered or cancelled.',
        );
      }
      throw new NotFoundException(`Order "${identifier}" not found`);
    }
  }

  async cancelOrder(
    identifier: string,
    reason?: string,
    changedBy?: { userId?: string; role: string; name: string },
  ): Promise<{ order: OrderDetails; logEntry: IOrderStatusLog }> {
    const order = await this.orderModel.findOne(this.buildOrderLookupFilter(identifier));

    if (!order) {
      throw new NotFoundException(`Order "${identifier}" not found`);
    }

    if (!isValidStatusTransition(order.status as OrderStatus, OrderStatus.CANCELLED)) {
      throw new BadRequestException(
        `Order cannot be cancelled in its current state "${order.status}"`,
      );
    }

    const updatedOrder = await this.orderModel.findOneAndUpdate(
      { _id: order._id, status: order.status },
      { $set: { status: OrderStatus.CANCELLED } },
      { returnDocument: 'after' },
    );
    if (!updatedOrder) {
      throw new ConflictException(
        'This order changed in another session. Refresh the order and try again.',
      );
    }

    const logEntry = await this.statusLogModel.create({
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: OrderStatus.CANCELLED,
      note: reason || 'Order cancelled by customer or kitchen admin',
      changedBy: changedBy || {
        userId: null,
        role: UserRole.CUSTOMER,
        name: 'Customer',
      },
    });

    const logs = await this.statusLogModel
      .find({ orderId: order._id.toString() })
      .sort({ timestamp: -1 });

    return {
      order: this.mapToDetails(updatedOrder, logs),
      logEntry: this.mapLog(logEntry),
    };
  }

  private mapLog(log: OrderStatusLogDocument): IOrderStatusLog {
    return {
      id: log._id.toString(),
      orderId: log.orderId.toString(),
      orderNumber: log.orderNumber,
      status: log.status as any,
      note: log.note,
      changedBy: {
        userId: log.changedBy.userId?.toString() || null,
        role: log.changedBy.role,
        name: log.changedBy.name,
      },
      timestamp: log.timestamp.toISOString(),
    };
  }

  private mapToDetails(order: OrderDocument, logs: OrderStatusLogDocument[]): OrderDetails {
    return {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address,
      },
      courierId: order.courierId?.toString() || null,
      items: order.items.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
      })),
      pricing: {
        subtotal: order.pricing.subtotal,
        deliveryFee: order.pricing.deliveryFee,
        tax: order.pricing.tax,
        total: order.pricing.total,
      },
      status: order.status as any,
      deliveryCoordinates: {
        lat: order.deliveryCoordinates?.lat ?? 40.7128,
        lng: order.deliveryCoordinates?.lng ?? -74.006,
      },
      courierCoordinates: order.courierCoordinates
        ? {
            lat: order.courierCoordinates.lat,
            lng: order.courierCoordinates.lng,
            lastUpdated: order.courierCoordinates.lastUpdated
              ? order.courierCoordinates.lastUpdated.toISOString()
              : null,
          }
        : undefined,
      statusHistory: logs.map((l) => this.mapLog(l)),
      estimatedDeliveryAt: order.estimatedDeliveryAt
        ? order.estimatedDeliveryAt.toISOString()
        : null,
      createdAt: (order as any).createdAt
        ? (order as any).createdAt.toISOString()
        : new Date().toISOString(),
      updatedAt: (order as any).updatedAt
        ? (order as any).updatedAt.toISOString()
        : new Date().toISOString(),
    };
  }
}
