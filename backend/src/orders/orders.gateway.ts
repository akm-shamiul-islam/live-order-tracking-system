import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UseGuards,
  forwardRef,
  Inject,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { OrdersService } from './orders.service.js';
import { AuthService } from '../auth/auth.service.js';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { isAllowedOrigin } from '../common/cors.js';
import { SocketRateLimiter } from '../common/socket-rate-limiter.js';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { clientAddress } from '../common/client-address.js';
import {
  UserRole,
  UpdateOrderStatusSchema,
  CourierLocationUpdateSchema,
  OrderLookupSchema,
  CancellationReasonSchema,
  type OrderDetails,
  type OrderStatusLog,
} from '@kitchentodoor/shared';

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) =>
      callback(null, isAllowedOrigin(origin)),
    credentials: true,
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private failureMessage(error: unknown): string {
    if (error instanceof ZodError)
      return error.issues[0]?.message || 'Please check the submitted fields.';
    return error instanceof HttpException
      ? error.message
      : 'The order service is temporarily unavailable. Please try again.';
  }
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);
  private readonly packetLimits = new SocketRateLimiter(getRuntimeSettings);

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    client.use((packet, next) => {
      if (this.packetLimits.consume(client.id, clientAddress(client.request))) return next();
      const acknowledge: unknown = packet.at(-1);
      if (typeof acknowledge === 'function')
        acknowledge({ ok: false, error: 'Too many updates. Wait a moment and try again.' });
      next(new Error('SOCKET_RATE_LIMIT'));
    });
    client.on('error', (error: Error) => {
      if (error.message !== 'SOCKET_RATE_LIMIT') return;
      client.emit('error', {
        code: 'RATE_LIMITED',
        message: 'Too many updates. Wait a moment and try again.',
      });
    });
    this.logger.log(`⚡ Client connected: ${client.id}`);

    // Optional handshake authentication: if token is supplied, verify and attach user
    const token = client.handshake?.auth?.token || client.handshake?.headers?.authorization;

    if (token) {
      try {
        if (typeof token !== 'string')
          throw new UnauthorizedException('Invalid authentication token');
        const user = await this.authService.verifyToken(token.replace(/^Bearer\s+/i, ''));
        (client as any).user = user;

        if (user.role === UserRole.ADMIN) {
          void client.join('admins');
          this.logger.log(`👨‍💼 Admin joined admins room: ${client.id}`);
        } else if (user.role === UserRole.COURIER) {
          void client.join('couriers');
          this.logger.log(`🛵 Courier joined couriers room: ${client.id}`);
        }

        client.emit('authenticated', { user });
      } catch (error) {
        if (!(error instanceof UnauthorizedException)) {
          client.emit('error', {
            code: 'SERVICE_UNAVAILABLE',
            message: 'The order service is temporarily unavailable. Reconnecting…',
          });
          client.conn.close();
          return;
        }
        this.logger.warn(`Unauthenticated handshake for socket: ${client.id}`);
        client.emit('error', {
          message: 'Your session has expired. Please sign in again.',
          code: 'UNAUTHORIZED',
        });
        client.disconnect(true);
      }
    }
  }

  handleDisconnect(client: Socket) {
    this.packetLimits.disconnect(client.id);
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('order:join')
  async handleJoinOrder(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    try {
      const { orderId } = OrderLookupSchema.parse(data);
      const token = client.handshake?.auth?.token || client.handshake?.headers?.authorization;
      const actor =
        typeof token === 'string'
          ? await this.authService.verifyToken(token.replace(/^Bearer\s+/i, ''))
          : undefined;
      const order = await this.ordersService.getOrderById(orderId, actor);
      const subscribed = [...client.rooms].filter((room) => room.startsWith('order_'));
      if (
        !client.rooms.has(`order_${order.id}`) &&
        subscribed.length >= getRuntimeSettings().SOCKET_ORDER_ROOMS_MAX
      ) {
        return { ok: false, error: 'Close an existing tracker before opening another order.' };
      }
      await client.join(`order_${order.id}`);
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: 'Unable to join this order. Use its private tracking link or sign in.',
      };
    }
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { ok: true };
  }

  @SubscribeMessage('order:leave')
  handleLeaveOrder(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    if (!data?.orderId) return;
    const room = `order_${data.orderId}`;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
  }

  @SubscribeMessage('order:update_status')
  @UseGuards(WsJwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  async handleUpdateStatus(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    try {
      const validated = UpdateOrderStatusSchema.parse(payload);
      const user = (client as any).user;

      const result = await this.ordersService.updateOrderStatus(
        validated.orderId,
        validated.status,
        validated.note,
        {
          userId: user?.id,
          role: user?.role || UserRole.ADMIN,
          name: user?.name || 'Dispatcher',
        },
      );

      await this.notifyStatusUpdated(result.order, result.logEntry);

      return { ok: true, order: result.order };
    } catch (error) {
      return { ok: false, error: this.failureMessage(error) };
    }
  }

  @SubscribeMessage('courier:update_location')
  @UseGuards(WsJwtGuard, RolesGuard)
  @Roles(UserRole.COURIER, UserRole.ADMIN)
  async handleCourierLocation(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    try {
      const validated = CourierLocationUpdateSchema.parse(payload);

      const canonicalId = await this.ordersService.updateCourierCoordinates(
        validated.orderId,
        validated.lat,
        validated.lng,
        (client as any).user,
        validated.timestamp,
      );

      await this.notifyCourierLocation(
        canonicalId,
        validated.lat,
        validated.lng,
        validated.heading,
        validated.speed,
        validated.timestamp,
      );

      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.failureMessage(error) };
    }
  }

  @SubscribeMessage('order:cancel')
  @UseGuards(WsJwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  async handleCancelOrder(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    try {
      const validated = OrderLookupSchema.extend({ reason: CancellationReasonSchema }).parse(
        payload,
      );

      const user = (client as any).user;
      const result = await this.ordersService.cancelOrder(validated.orderId, validated.reason, {
        userId: user?.id,
        role: user?.role || UserRole.CUSTOMER,
        name: user?.name || 'Customer',
      });

      await this.notifyOrderCancelled(result.order, result.logEntry, validated.reason);

      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.failureMessage(error) };
    }
  }

  // Recheck recipients because a role change, reassignment or logout can happen after joining.
  private async emitAuthorized(event: string, payload: unknown, orderId?: string) {
    try {
      await this.deliverAuthorized(event, payload, orderId);
    } catch {
      // Persistence has already succeeded. Polling and reconnect refetches recover missed events;
      // reporting a failed mutation here would encourage a second order or status change.
      this.logger.warn(
        `Live notification ${event} could not be delivered. Saved data is unchanged.`,
      );
    }
  }

  private async deliverAuthorized(event: string, payload: unknown, orderId?: string) {
    const rooms = orderId
      ? [`order_${orderId}`, 'admins', 'couriers']
      : event === 'orders:changed'
        ? ['admins', 'couriers']
        : ['admins'];
    const clients = await this.server.in(rooms).fetchSockets();
    await Promise.all(
      clients.map(async (client) => {
        try {
          const token = client.handshake.auth?.token || client.handshake.headers?.authorization;
          const user =
            typeof token === 'string'
              ? await this.authService.verifyToken(token.replace(/^Bearer\s+/i, ''))
              : undefined;
          if (token && !user) throw new UnauthorizedException('Invalid authentication token');
          if (user?.role !== UserRole.ADMIN) client.leave('admins');
          if (user?.role !== UserRole.COURIER) client.leave('couriers');
          if (!orderId) {
            if (
              user?.role === UserRole.ADMIN ||
              (event === 'orders:changed' && user?.role === UserRole.COURIER)
            )
              client.emit(event, payload);
            return;
          }
          try {
            await this.ordersService.getOrderById(orderId, user);
          } catch (error) {
            if (error instanceof HttpException && [403, 404].includes(error.getStatus())) {
              client.leave(`order_${orderId}`);
              return;
            }
            throw error;
          }
          client.emit(event, payload);
        } catch (error) {
          if (!(error instanceof UnauthorizedException)) {
            client.emit('error', {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Live updates are temporarily unavailable. Please try again shortly.',
            });
            return;
          }
          client.emit('error', {
            code: 'UNAUTHORIZED',
            message: 'Your session has expired. Please sign in again.',
          });
          client.disconnect(true);
        }
      }),
    );
  }

  async notifyStatusUpdated(order: OrderDetails, logEntry: OrderStatusLog) {
    const payload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      updatedAt: order.updatedAt,
      revision: order.revision ?? 0,
      logEntry,
      courierId: order.courierId,
    };

    await this.emitAuthorized('order:status_updated', payload, order.id);
    await this.notifyListsChanged();
  }

  async notifyCourierLocation(
    orderId: string,
    lat: number,
    lng: number,
    heading?: number,
    speed?: number,
    timestamp = new Date().toISOString(),
  ) {
    const payload = {
      orderId,
      lat,
      lng,
      heading,
      speed,
      timestamp,
    };

    await this.emitAuthorized('courier:location_updated', payload, orderId);
  }

  async notifyOrderCreated(order: OrderDetails) {
    await this.emitAuthorized('order:created', { order: { ...order, trackingId: undefined } });
    await this.notifyListsChanged();
  }

  async notifyListsChanged() {
    // Invalidation contains no customer, courier, or order identifiers.
    await this.emitAuthorized('orders:changed', {});
  }

  async notifyOrderCancelled(order: OrderDetails, logEntry: OrderStatusLog, reason?: string) {
    const payload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      reason,
      revision: order.revision ?? 0,
      updatedAt: order.updatedAt,
      logEntry,
    };
    await this.emitAuthorized('order:cancelled', payload, order.id);
    await this.notifyListsChanged();
  }
}
