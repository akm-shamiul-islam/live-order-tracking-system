import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, forwardRef, Inject } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { AuthService } from '../auth/auth.service.js';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { isAllowedOrigin } from '../common/cors.js';
import {
  OrderStatus,
  UserRole,
  UpdateOrderStatusSchema,
  CourierLocationUpdateSchema,
} from '@kitchentodoor/shared';

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) =>
      callback(null, isAllowedOrigin(origin)),
    credentials: true,
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`⚡ Client connected: ${client.id}`);

    // Optional handshake authentication: if token is supplied, verify and attach user
    const token = client.handshake?.auth?.token || client.handshake?.headers?.authorization;

    if (token) {
      try {
        if (typeof token !== 'string') throw new Error('Invalid authentication token');
        const user = await this.authService.verifyToken(token.replace(/^Bearer\s+/i, ''));
        (client as any).user = user;

        if (user.role === UserRole.ADMIN) {
          void client.join('admins');
          this.logger.log(`👨‍💼 Admin joined admins room: ${client.id} (${user.email})`);
        } else if (user.role === UserRole.COURIER) {
          void client.join('couriers');
          this.logger.log(`🛵 Courier joined couriers room: ${client.id}`);
        }

        client.emit('authenticated', { user });
      } catch {
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
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('order:join')
  handleJoinOrder(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    if (!data?.orderId) {
      return { ok: false, error: 'Order ID is required' };
    }
    const room = `order_${data.orderId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { ok: true };
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

      this.notifyStatusUpdated(
        result.order.id,
        result.order.orderNumber,
        result.order.status,
        result.logEntry,
      );

      return { ok: true, order: result.order };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to update order status' };
    }
  }

  @SubscribeMessage('courier:update_location')
  @UseGuards(WsJwtGuard, RolesGuard)
  @Roles(UserRole.COURIER, UserRole.ADMIN)
  async handleCourierLocation(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    try {
      const validated = CourierLocationUpdateSchema.parse(payload);

      await this.ordersService.updateCourierCoordinates(
        validated.orderId,
        validated.lat,
        validated.lng,
      );

      this.notifyCourierLocation(
        validated.orderId,
        validated.lat,
        validated.lng,
        validated.heading,
        validated.speed,
      );

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Invalid location data' };
    }
  }

  @SubscribeMessage('order:cancel')
  @UseGuards(WsJwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async handleCancelOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { orderId: string; reason?: string },
  ) {
    try {
      if (!payload?.orderId) {
        return { ok: false, error: 'Order ID is required' };
      }

      const user = (client as any).user;
      const result = await this.ordersService.cancelOrder(payload.orderId, payload.reason, {
        userId: user?.id,
        role: user?.role || UserRole.CUSTOMER,
        name: user?.name || 'Customer',
      });

      this.notifyOrderCancelled(result.order.id, result.order.orderNumber, payload.reason);

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to cancel order' };
    }
  }

  // Helper broadcast methods called from Gateway or OrdersController
  notifyStatusUpdated(orderId: string, orderNumber: string, status: OrderStatus, logEntry: any) {
    const payload = {
      orderId,
      orderNumber,
      status,
      updatedAt: new Date().toISOString(),
      logEntry,
    };

    // Emit to specific order subscribers
    this.server.to(`order_${orderId}`).emit('order:status_updated', payload);
    // Also emit to order number room if subscribed by number
    this.server.to(`order_${orderNumber}`).emit('order:status_updated', payload);
    // Emit to all dispatchers / admins
    this.server.to('admins').emit('order:status_updated', payload);
  }

  notifyCourierLocation(
    orderId: string,
    lat: number,
    lng: number,
    heading?: number,
    speed?: number,
  ) {
    const payload = {
      orderId,
      lat,
      lng,
      heading,
      speed,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`order_${orderId}`).emit('courier:location_updated', payload);
    this.server.to('admins').emit('courier:location_updated', payload);
  }

  notifyOrderCreated(order: any) {
    this.server.to('admins').emit('order:created', { order });
  }

  notifyOrderCancelled(orderId: string, orderNumber: string, reason?: string) {
    const payload = { orderId, orderNumber, reason };
    this.server.to(`order_${orderId}`).emit('order:cancelled', payload);
    this.server.to(`order_${orderNumber}`).emit('order:cancelled', payload);
    this.server.to('admins').emit('order:cancelled', payload);
  }
}
