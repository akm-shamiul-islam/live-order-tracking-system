import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  ForbiddenException,
  type OnModuleInit,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { getRuntimeSettings, getPricingSettings } from '../config/runtime-settings.js';
import { Order, type OrderDocument } from '../database/schemas/order.schema.js';
import { User, type UserDocument } from '../database/schemas/user.schema.js';
import { AccountAccessCoordinator } from '../common/account-access-coordinator.js';
import {
  OrderStatusLog,
  type OrderStatusLogDocument,
  type OrderStatusLogRecord,
} from '../database/schemas/order-status-log.schema.js';
import {
  type CreateOrderDto,
  type OrderDetails,
  OrderStatus,
  type OrderStatusLog as IOrderStatusLog,
  isValidStatusTransition,
  UserRole,
  MENU_ITEMS,
  calculatePricing,
  type UserSummary,
  CancellationReasonSchema,
  paginate,
  type AvailableDelivery,
  type PaginationInfo,
} from '@kitchentodoor/shared';

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(OrderStatusLog.name)
    private readonly statusLogModel: Model<OrderStatusLogDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(AccountAccessCoordinator) private readonly access: AccountAccessCoordinator,
  ) {}

  async onModuleInit() {
    // Checkout retry safety depends on the unique index being ready before accepting requests.
    await this.orderModel.init();
  }

  generateOrderNumber(): string {
    return `KTD-${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  private checkoutHash(dto: CreateOrderDto): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          customer: { name: dto.customer.name, phone: dto.customer.phone },
          deliveryAddress: dto.deliveryAddress,
          deliveryCoordinates: dto.deliveryCoordinates ?? null,
          note: dto.note ?? '',
          items: dto.items
            .map(({ itemId, quantity }) => ({ itemId, quantity }))
            .sort((a, b) => a.itemId.localeCompare(b.itemId) || a.quantity - b.quantity),
        }),
      )
      .digest('hex');
  }

  private async replayCheckout(userId: string, checkoutKey: string, requestHash: string) {
    const existing = await this.orderModel
      .findOne({ 'customer.userId': userId, checkoutKey })
      .select('+checkoutRequestHash');
    if (!existing) return undefined;
    if (existing.checkoutRequestHash !== requestHash) {
      throw new ConflictException(
        'This checkout was already submitted with different details. Check your orders before placing another order.',
      );
    }
    return this.mapToDetails(existing, await this.legacyLogs(existing), {
      id: userId,
      role: UserRole.CUSTOMER,
    });
  }

  async createOrder(
    createOrderDto: CreateOrderDto,
    userId?: string,
    checkoutKey?: string,
  ): Promise<OrderDetails> {
    const requestHash = checkoutKey ? this.checkoutHash(createOrderDto) : undefined;
    if (checkoutKey) {
      if (!userId) throw new BadRequestException('Sign in before submitting a checkout.');
      const replay = await this.replayCheckout(userId, checkoutKey, requestHash!);
      if (replay) return replay;
    }
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
        imageUrl: `/menu/${menuItem.photo}-480.webp`,
      };
    });
    const pricing = calculatePricing(items, getPricingSettings());

    for (let attempt = 0; attempt < getRuntimeSettings().ORDER_NUMBER_RETRY_ATTEMPTS; attempt++) {
      const orderNumber = this.generateOrderNumber();
      const orderId = new Types.ObjectId();
      const trackingId = `trk_${randomBytes(32).toString('base64url')}`;
      const initialLog = this.newLog(
        orderId.toString(),
        orderNumber,
        OrderStatus.PLACED,
        createOrderDto.note || 'Order received and logged in kitchen system',
        { userId, role: UserRole.CUSTOMER, name: createOrderDto.customer.name },
      );
      try {
        const newOrder = await this.orderModel.create({
          _id: orderId,
          ...(checkoutKey ? { checkoutKey, checkoutRequestHash: requestHash } : {}),
          trackingTokenHash: this.trackingHash(trackingId),
          orderNumber,
          auditTrail: [initialLog],
          auditTrailComplete: true,
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
            lat: getRuntimeSettings().KITCHEN_LATITUDE,
            lng: getRuntimeSettings().KITCHEN_LONGITUDE,
          },
          deliveryLocationProvided: !!createOrderDto.deliveryCoordinates,
          courierCoordinates: {
            lat: null,
            lng: null,
            lastUpdated: null,
          },
          estimatedDeliveryAt: new Date(
            Date.now() + getRuntimeSettings().ORDER_ESTIMATE_MINUTES * 60 * 1000,
          ),
        });
        return { ...this.mapToDetails(newOrder, [initialLog]), trackingId };
      } catch (error) {
        // The unique customer/key index resolves races across concurrent requests and API processes.
        if (
          checkoutKey &&
          userId &&
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 11000
        ) {
          const replay = await this.replayCheckout(userId, checkoutKey, requestHash!);
          if (replay) return replay;
        }
        if (!this.isOrderNumberCollision(error)) throw error;
      }
    }
    throw new ServiceUnavailableException('Unable to allocate an order number. Please try again.');
  }

  private isOrderNumberCollision(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000 &&
      'keyPattern' in error &&
      typeof error.keyPattern === 'object' &&
      error.keyPattern !== null &&
      'orderNumber' in error.keyPattern
    );
  }

  private newLog(
    orderId: string,
    orderNumber: string,
    status: OrderStatus,
    note: string,
    changedBy: { userId?: string | null; role: string; name: string },
  ): OrderStatusLogRecord {
    return {
      _id: new Types.ObjectId(),
      orderId,
      orderNumber,
      status,
      note,
      changedBy: { ...changedBy, userId: changedBy.userId || null },
      timestamp: new Date(),
    };
  }

  private async legacyLogs(order: OrderDocument): Promise<OrderStatusLogRecord[]> {
    if (order.auditTrailComplete) return [];
    return this.statusLogModel.find({ orderId: order._id.toString() }).sort({ timestamp: -1 });
  }

  private buildOrderLookupFilter(identifier: string) {
    if (identifier.startsWith('trk_')) return { trackingTokenHash: this.trackingHash(identifier) };
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    return isObjectId
      ? { $or: [{ _id: identifier }, { orderNumber: identifier }] }
      : { orderNumber: identifier };
  }

  private trackingHash(identifier: string): string {
    return createHash('sha256').update(identifier).digest('hex');
  }

  async getOrderById(identifier: string, actor?: UserSummary): Promise<OrderDetails> {
    const order = await this.orderModel.findOne(this.buildOrderLookupFilter(identifier));

    if (!order) {
      throw new NotFoundException('Order not found. Check your private tracking link or sign in.');
    }

    const owner = actor?.id && order.customer.userId?.toString() === actor.id;
    const allowed =
      owner ||
      actor?.role === UserRole.ADMIN ||
      (actor?.role === UserRole.COURIER && order.courierId?.toString() === actor.id);
    if (!allowed) {
      throw new NotFoundException('Order not found. Check your private tracking link or sign in.');
    }

    const logs = await this.legacyLogs(order);

    return this.mapToDetails(order, logs, actor);
  }

  private listFilter(status?: string, search = '', actor?: UserSummary) {
    const filter: Record<string, unknown> = status ? { status } : {};
    if (search) {
      const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = ['orderNumber', 'customer.name', 'customer.phone'].map((field) => ({
        [field]: { $regex: literal, $options: 'i' },
      }));
    }
    if (actor?.role === UserRole.COURIER) {
      filter.courierId = actor.id;
    }
    return filter;
  }

  countOrders(status?: string, search = '', actor?: UserSummary) {
    return this.orderModel.countDocuments(this.listFilter(status, search, actor));
  }

  countMyOrders(phone?: string, ownerId?: string, deliveries = false, search = '') {
    return this.orderModel.countDocuments(this.historyFilter(phone, ownerId, deliveries, search));
  }

  private historyFilter(phone?: string, ownerId?: string, deliveries = false, search = '') {
    const filter = deliveries
      ? { courierId: ownerId }
      : {
          ...(phone ? { 'customer.phone': phone } : {}),
          ...(ownerId ? { 'customer.userId': ownerId } : {}),
        };
    return {
      ...filter,
      ...(search
        ? { orderNumber: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
        : {}),
    };
  }

  async getAllOrders(
    status?: string,
    limit = getRuntimeSettings().ORDER_LIST_DEFAULT_LIMIT,
    page = 1,
    search = '',
    actor?: UserSummary,
  ): Promise<OrderDetails[]> {
    const query = this.orderModel
      .find(this.listFilter(status, search, actor))
      .sort({ createdAt: -1, _id: -1 });
    if (page > 1) query.skip((page - 1) * limit);
    const orders = await query.limit(limit);

    const orderIds = orders
      .filter((order) => !order.auditTrailComplete)
      .map((order) => order._id.toString());
    const allLogs = orderIds.length
      ? await this.statusLogModel.find({ orderId: { $in: orderIds } }).sort({ timestamp: -1 })
      : [];

    return orders.map((order) => {
      const logs = allLogs.filter((l) => l.orderId.toString() === order._id.toString());
      return this.mapToDetails(order, logs, actor);
    });
  }

  async getMyOrders(
    phone?: string,
    limit = getRuntimeSettings().ORDER_HISTORY_LIMIT,
    page = 1,
    ownerId?: string,
    deliveries = false,
    actor?: UserSummary,
    search = '',
  ): Promise<OrderDetails[]> {
    const query = this.orderModel
      .find(this.historyFilter(phone, ownerId, deliveries, search))
      .sort({ createdAt: -1, _id: -1 });
    if (page > 1) query.skip((page - 1) * limit);
    const orders = await query.limit(limit);

    const orderIds = orders
      .filter((order) => !order.auditTrailComplete)
      .map((order) => order._id.toString());
    const allLogs = orderIds.length
      ? await this.statusLogModel.find({ orderId: { $in: orderIds } }).sort({ timestamp: -1 })
      : [];

    return orders.map((order) => {
      const logs = allLogs.filter((l) => l.orderId.toString() === order._id.toString());
      return this.mapToDetails(order, logs, actor);
    });
  }

  async getAvailableDeliveries(
    actor: UserSummary,
    page: number,
    limit: number,
  ): Promise<{ orders: AvailableDelivery[]; pagination: PaginationInfo }> {
    const filter = {
      courierId: null,
      status: {
        $nin: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      },
    };
    const pagination = paginate(await this.orderModel.countDocuments(filter), page, limit);
    const orders = await this.orderModel
      .find(filter)
      .select('orderNumber status items pricing.total createdAt deliveryRequests')
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * limit)
      .limit(limit);
    return {
      pagination,
      orders: orders.map((order) => {
        const request = order.deliveryRequests?.find(
          (entry) => entry.courierId.toString() === actor.id,
        );
        return {
          id: order._id.toString(),
          orderNumber: order.orderNumber,
          status: order.status,
          items: order.items.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
          })),
          total: order.pricing.total,
          createdAt: order.createdAt.toISOString(),
          ...(request
            ? {
                request: {
                  courierId: actor.id,
                  courierName: request.courierName,
                  status: request.status,
                  requestedAt: request.requestedAt.toISOString(),
                },
              }
            : {}),
        };
      }),
    };
  }

  async requestDelivery(identifier: string, actor: UserSummary): Promise<void> {
    if (actor.role !== UserRole.COURIER)
      throw new ForbiddenException('Only couriers can request a delivery.');
    const order = await this.orderModel.findOne(this.buildOrderLookupFilter(identifier));
    if (!order) throw new NotFoundException('Order not found.');
    if (
      [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED].some(
        (status) => status === order.status,
      )
    )
      throw new ConflictException('This delivery is no longer available.');
    const log = this.newLog(
      order._id.toString(),
      order.orderNumber,
      order.status,
      'Courier requested delivery; awaiting administrator approval',
      { userId: actor.id, role: actor.role, name: actor.name },
    );
    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: order._id,
        courierId: null,
        status: order.status,
        'deliveryRequests.courierId': { $ne: actor.id },
        $expr: {
          $lt: [
            { $size: { $ifNull: ['$deliveryRequests', []] } },
            getRuntimeSettings().DELIVERY_REQUESTS_MAX,
          ],
        },
      },
      {
        $push: {
          deliveryRequests: {
            courierId: actor.id,
            courierName: actor.name,
            status: 'PENDING',
            requestedAt: new Date(),
          },
          auditTrail: log,
        },
        $inc: { deliveryRevision: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!updated)
      throw new ConflictException(
        'This delivery is no longer available or you have already requested it. Refresh the list.',
      );
  }

  async rejectDeliveryRequest(
    identifier: string,
    courierId: string,
    actor: UserSummary,
  ): Promise<void> {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException();
    const order = await this.orderModel.findOne(this.buildOrderLookupFilter(identifier));
    if (!order) throw new NotFoundException('Order not found.');
    const log = this.newLog(
      order._id.toString(),
      order.orderNumber,
      order.status,
      'Courier delivery request declined',
      { userId: actor.id, role: actor.role, name: actor.name },
    );
    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: order._id,
        courierId: null,
        status: order.status,
        deliveryRequests: { $elemMatch: { courierId, status: 'PENDING' } },
      },
      {
        $set: { 'deliveryRequests.$.status': 'REJECTED' },
        $inc: { deliveryRevision: 1 },
        $push: { auditTrail: log },
      },
      { returnDocument: 'after' },
    );
    if (!updated) throw new ConflictException('This delivery request changed. Refresh the order.');
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

    if (!isValidStatusTransition(order.status, newStatus)) {
      throw new BadRequestException(
        `Invalid status progression from "${order.status}" to "${newStatus}"`,
      );
    }
    if (changedBy?.role === UserRole.COURIER && order.courierId?.toString() !== changedBy.userId) {
      throw new ForbiddenException('Couriers can only update their assigned delivery.');
    }
    if (newStatus === OrderStatus.CANCELLED) {
      const reason = CancellationReasonSchema.safeParse(note);
      if (!reason.success) throw new BadRequestException(reason.error.issues[0]!.message);
      note = reason.data;
    }
    if (newStatus === OrderStatus.OUT_FOR_DELIVERY && !order.courierId) {
      throw new BadRequestException('Assign a courier before starting delivery.');
    }

    const logEntry = this.newLog(
      order._id.toString(),
      order.orderNumber,
      newStatus,
      note || `Status advanced to ${newStatus}`,
      changedBy || {
        userId: null,
        role: UserRole.ADMIN,
        name: 'System Dispatcher',
      },
    );
    const updatedOrder = await this.orderModel.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        ...(changedBy?.role === UserRole.COURIER || newStatus === OrderStatus.OUT_FOR_DELIVERY
          ? { courierId: order.courierId }
          : {}),
      },
      {
        $set: { status: newStatus },
        $push: { auditTrail: logEntry },
        $inc: { deliveryRevision: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!updatedOrder) {
      throw new ConflictException(
        'This order changed in another session. Refresh the order and try again.',
      );
    }

    const logs = await this.legacyLogs(updatedOrder);

    return {
      order: this.mapToDetails(updatedOrder, [...logs, logEntry], {
        id: changedBy?.userId,
        role: changedBy?.role,
      }),
      logEntry: this.mapLog(logEntry),
    };
  }

  async updateCourierCoordinates(
    identifier: string,
    lat: number,
    lng: number,
    actor?: UserSummary,
    timestamp = new Date().toISOString(),
  ): Promise<string> {
    const observedAt = new Date(timestamp);
    const age = Date.now() - observedAt.getTime();
    const settings = getRuntimeSettings();
    if (
      !Number.isFinite(age) ||
      age > settings.TELEMETRY_MAX_AGE_MS ||
      age < -settings.TELEMETRY_MAX_FUTURE_MS
    ) {
      throw new BadRequestException('This location update is out of date. Send a fresh location.');
    }
    const order = actor
      ? await this.orderModel.findOne(this.buildOrderLookupFilter(identifier))
      : null;
    if (actor && !order) throw new NotFoundException('Order not found.');
    if (actor?.role === UserRole.COURIER && order?.courierId?.toString() !== actor.id) {
      throw new ForbiddenException('This delivery is not assigned to you.');
    }
    const lookup = this.buildOrderLookupFilter(identifier);
    const result = await this.orderModel.updateOne(
      {
        ...lookup,
        status:
          actor?.role === UserRole.COURIER
            ? OrderStatus.OUT_FOR_DELIVERY
            : { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        ...(actor?.role === UserRole.COURIER ? { courierId: actor.id } : {}),
        $and: [
          {
            $or: [
              { 'courierCoordinates.lastUpdated': null },
              { 'courierCoordinates.lastUpdated': { $lt: observedAt } },
            ],
          },
        ],
      },
      {
        $set: {
          'courierCoordinates.lat': lat,
          'courierCoordinates.lng': lng,
          'courierCoordinates.lastUpdated': observedAt,
        },
      },
    );
    if (result.matchedCount === 0) {
      if (await this.orderModel.exists(lookup)) {
        throw new ConflictException(
          'This delivery changed or a newer location is already saved. Refresh and try again.',
        );
      }
      throw new NotFoundException(`Order "${identifier}" not found`);
    }
    return order?._id.toString() || identifier;
  }

  async assignCourier(
    identifier: string,
    courierId: string | null,
    actor: UserSummary,
    approveRequest = false,
  ) {
    return this.access.run(() =>
      this.assignWithCurrentAccess(identifier, courierId, actor, approveRequest),
    );
  }

  private async assignWithCurrentAccess(
    identifier: string,
    courierId: string | null,
    actor: UserSummary,
    approveRequest: boolean,
  ) {
    if (actor.role !== UserRole.ADMIN)
      throw new ForbiddenException('An administrator must approve courier assignments.');
    const administrator = await this.userModel.findById(actor.id);
    if (administrator?.role !== UserRole.ADMIN || administrator.disabled) {
      throw new ForbiddenException('Your administrator access has changed. Sign in again.');
    }
    if (courierId) {
      const courier = await this.userModel.findById(courierId);
      if (courier?.role !== UserRole.COURIER || courier.disabled) {
        throw new BadRequestException('Choose an active courier account.');
      }
    }
    const order = await this.orderModel.findOne(this.buildOrderLookupFilter(identifier));
    if (!order) throw new NotFoundException('Order not found.');
    if (
      approveRequest &&
      !order.deliveryRequests?.some(
        (request) => request.courierId.toString() === courierId && request.status === 'PENDING',
      )
    ) {
      throw new ConflictException('This delivery request is no longer pending. Refresh the order.');
    }
    if (
      order.status === OrderStatus.OUT_FOR_DELIVERY ||
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new ConflictException('Courier assignment is closed for this order.');
    }
    const logEntry = this.newLog(
      order._id.toString(),
      order.orderNumber,
      order.status,
      courierId ? 'Courier assigned to delivery' : 'Courier assignment cleared',
      { userId: actor.id, role: actor.role, name: actor.name },
    );
    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        courierId: order.courierId || null,
        deliveryRevision: order.deliveryRevision || { $in: [0, null] },
      },
      {
        $set: {
          courierId,
          deliveryRequests: (order.deliveryRequests ?? []).map((request) => ({
            courierId: request.courierId,
            courierName: request.courierName,
            requestedAt: request.requestedAt,
            status: request.courierId.toString() === courierId ? 'APPROVED' : 'REJECTED',
          })),
        },
        $push: { auditTrail: logEntry },
        $inc: { deliveryRevision: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!updated)
      throw new ConflictException('This order changed. Refresh before assigning a courier.');
    return {
      order: this.mapToDetails(updated, [...(await this.legacyLogs(updated)), logEntry], actor),
      logEntry: this.mapLog(logEntry),
    };
  }

  async cancelOrder(
    identifier: string,
    reason?: string,
    changedBy?: { userId?: string; role: string; name: string },
  ): Promise<{ order: OrderDetails; logEntry: IOrderStatusLog }> {
    return this.updateOrderStatus(identifier, OrderStatus.CANCELLED, reason, changedBy);
  }

  private mapLog(log: OrderStatusLogRecord): IOrderStatusLog {
    return {
      id: log._id.toString(),
      orderId: log.orderId.toString(),
      orderNumber: log.orderNumber,
      status: log.status,
      note: log.note,
      changedBy: {
        userId: log.changedBy.userId?.toString() || null,
        role: log.changedBy.role,
        name: log.changedBy.name,
      },
      timestamp: log.timestamp.toISOString(),
    };
  }

  private mapToDetails(
    order: OrderDocument,
    logs: OrderStatusLogRecord[],
    actor?: { id?: string; role?: string },
  ): OrderDetails {
    const history = [
      ...new Map(
        [...logs, ...(order.auditTrail ?? [])].map((log) => [log._id.toString(), log]),
      ).values(),
    ].sort(
      (a, b) =>
        b.timestamp.getTime() - a.timestamp.getTime() ||
        b._id.toString().localeCompare(a._id.toString()),
    );
    return {
      id: order._id.toString(),
      revision: order.deliveryRevision ?? 0,
      orderNumber: order.orderNumber,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address,
      },
      courierId: order.courierId?.toString() || null,
      deliveryRequests: (order.deliveryRequests ?? [])
        .filter(
          (request) => actor?.role === UserRole.ADMIN || request.courierId.toString() === actor?.id,
        )
        .map((request) => ({
          courierId: request.courierId.toString(),
          courierName: request.courierName,
          status: request.status,
          requestedAt: request.requestedAt.toISOString(),
        })),
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
      status: order.status,
      deliveryCoordinates: {
        lat: order.deliveryCoordinates?.lat ?? getRuntimeSettings().KITCHEN_LATITUDE,
        lng: order.deliveryCoordinates?.lng ?? getRuntimeSettings().KITCHEN_LONGITUDE,
      },
      deliveryLocationProvided: order.deliveryLocationProvided ?? false,
      courierCoordinates: order.courierCoordinates
        ? {
            lat: order.courierCoordinates.lat,
            lng: order.courierCoordinates.lng,
            lastUpdated: order.courierCoordinates.lastUpdated
              ? order.courierCoordinates.lastUpdated.toISOString()
              : null,
          }
        : undefined,
      statusHistory: history.map((log) => this.mapLog(log)),
      estimatedDeliveryAt: order.estimatedDeliveryAt
        ? order.estimatedDeliveryAt.toISOString()
        : null,
      createdAt: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: order.updatedAt ? order.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
