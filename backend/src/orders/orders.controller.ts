import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrdersGateway } from './orders.gateway.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  CourierLocationUpdateSchema,
  UserRole,
  OrderStatus,
  OrderIdentifierSchema,
  OrderHistorySearchSchema,
} from '@kitchentodoor/shared';
import { z } from 'zod';
import { getRuntimeSettings } from '../config/runtime-settings.js';

const getListOrdersQuerySchema = () =>
  z.object({
    status: z.nativeEnum(OrderStatus).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(getRuntimeSettings().ORDER_LIST_MAX_LIMIT)
      .default(getRuntimeSettings().ORDER_LIST_DEFAULT_LIMIT),
  });
import type {
  CreateOrderDto,
  UpdateOrderStatusDto,
  CourierLocationUpdateDto,
  OrderDetails,
} from '@kitchentodoor/shared';

@Controller('api/orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(OrdersGateway) private readonly ordersGateway: OrdersGateway,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body(new ZodValidationPipe(CreateOrderSchema)) body: CreateOrderDto,
    @CurrentUser('id') userId?: string,
  ): Promise<{ success: boolean; order: OrderDetails }> {
    const order = await this.ordersService.createOrder(body, userId);
    this.ordersGateway.notifyOrderCreated(order);
    return { success: true, order };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  async getAllOrders(
    @Query(new ZodValidationPipe(getListOrdersQuerySchema)) query: z.infer<
      ReturnType<typeof getListOrdersQuerySchema>
    >,
  ): Promise<{ success: boolean; count: number; orders: OrderDetails[] }> {
    const orders = await this.ordersService.getAllOrders(query.status, query.limit);
    return { success: true, count: orders.length, orders };
  }

  @Get('my-orders')
  async getMyOrders(
    @Query(new ZodValidationPipe(OrderHistorySearchSchema)) query: z.infer<
      typeof OrderHistorySearchSchema
    >,
  ): Promise<{ success: boolean; count: number; orders: OrderDetails[] }> {
    const orders = await this.ordersService.getMyOrders(query.phone);
    return { success: true, count: orders.length, orders };
  }

  @Get(':orderId')
  async getOrder(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
  ): Promise<{ success: boolean; order: OrderDetails }> {
    const order = await this.ordersService.getOrderById(orderId);
    return { success: true, order };
  }

  @Patch(':orderId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  async updateStatus(
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(UpdateOrderStatusSchema.omit({ orderId: true })))
    body: Omit<UpdateOrderStatusDto, 'orderId'>,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; order: OrderDetails }> {
    const result = await this.ordersService.updateOrderStatus(orderId, body.status, body.note, {
      userId: user?.id,
      role: user?.role || UserRole.ADMIN,
      name: user?.name || 'Dispatcher',
    });

    this.ordersGateway.notifyStatusUpdated(
      result.order.id,
      result.order.orderNumber,
      result.order.status,
      result.logEntry,
    );

    return { success: true, order: result.order };
  }

  @Post(':orderId/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async cancelOrder(
    @Param('orderId') orderId: string,
    @Body('reason') reason?: string,
    @CurrentUser() user?: any,
  ): Promise<{ success: boolean; order: OrderDetails }> {
    const result = await this.ordersService.cancelOrder(orderId, reason, {
      userId: user?.id,
      role: user?.role || UserRole.CUSTOMER,
      name: user?.name || 'Customer',
    });

    this.ordersGateway.notifyOrderCancelled(result.order.id, result.order.orderNumber, reason);

    return { success: true, order: result.order };
  }

  @Post(':orderId/telemetry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COURIER, UserRole.ADMIN)
  async updateTelemetry(
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(CourierLocationUpdateSchema.omit({ orderId: true })))
    body: Omit<CourierLocationUpdateDto, 'orderId'>,
  ): Promise<{ success: boolean }> {
    await this.ordersService.updateCourierCoordinates(orderId, body.lat, body.lng);
    this.ordersGateway.notifyCourierLocation(orderId, body.lat, body.lng, body.heading, body.speed);
    return { success: true };
  }
}
