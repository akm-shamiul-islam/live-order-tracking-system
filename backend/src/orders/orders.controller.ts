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
  BadRequestException,
  Headers,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { OrdersService } from './orders.service.js';
import { OrdersGateway } from './orders.gateway.js';
import { AuthService } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  CreateOrderSchema,
  OrderStatusChangeSchema,
  CourierLocationUpdateSchema,
  UserRole,
  OrderStatus,
  OrderIdentifierSchema,
  PhoneSchema,
  LanguageSchema,
  CancellationReasonSchema,
  UserIdSchema,
  PageNumberSchema,
  paginate,
  type PaginationInfo,
} from '@kitchentodoor/shared';
import { z } from 'zod';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { ReceiptService } from '../receipts/receipt.service.js';

const getListOrdersQuerySchema = () =>
  z.object({
    status: z.enum(OrderStatus).optional(),
    page: PageNumberSchema.optional(),
    search: z.string().trim().max(100).default(''),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(getRuntimeSettings().ORDER_LIST_MAX_LIMIT)
      .default(getRuntimeSettings().ORDER_LIST_DEFAULT_LIMIT),
  });
const getHistoryQuerySchema = () =>
  z.object({
    phone: PhoneSchema.optional(),
    q: z.string().trim().max(100).default(''),
    page: PageNumberSchema.optional(),
    limit: z.coerce.number().int().min(1).max(getRuntimeSettings().ORDER_LIST_MAX_LIMIT).optional(),
  });
const getReceiptQuerySchema = () => z.object({ language: LanguageSchema.optional() });
import type {
  CreateOrderDto,
  UpdateOrderStatusDto,
  CourierLocationUpdateDto,
  OrderDetails,
  UserSummary,
} from '@kitchentodoor/shared';

@Controller('api/orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(OrdersGateway) private readonly ordersGateway: OrdersGateway,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ReceiptService) private readonly receiptService: ReceiptService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body(new ZodValidationPipe(CreateOrderSchema)) body: CreateOrderDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') checkoutKey?: string,
  ): Promise<{ success: boolean; order: OrderDetails }> {
    if (!z.uuid().optional().safeParse(checkoutKey).success) {
      throw new BadRequestException('Use a valid UUID for the Idempotency-Key header.');
    }
    const order = await this.ordersService.createOrder(body, userId, checkoutKey);
    await this.ordersGateway.notifyOrderCreated({ ...order, trackingId: undefined });
    return { success: true, order };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllOrders(
    @Query(new ZodValidationPipe(getListOrdersQuerySchema)) query: z.infer<
      ReturnType<typeof getListOrdersQuerySchema>
    >,
    @CurrentUser() user: UserSummary,
  ): Promise<{
    success: boolean;
    count: number;
    orders: OrderDetails[];
    pagination?: PaginationInfo;
  }> {
    const pagination =
      query.page === undefined
        ? undefined
        : paginate(
            await this.ordersService.countOrders(query.status, query.search, user),
            query.page,
            query.limit,
          );
    const orders = await this.ordersService.getAllOrders(
      query.status,
      query.limit,
      pagination?.page,
      query.search,
      user,
    );
    return { success: true, count: orders.length, orders, ...(pagination ? { pagination } : {}) };
  }

  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(
    @Query(new ZodValidationPipe(getHistoryQuerySchema)) query: z.infer<
      ReturnType<typeof getHistoryQuerySchema>
    >,
    @CurrentUser() user: UserSummary,
  ): Promise<{
    success: boolean;
    count: number;
    orders: OrderDetails[];
    pagination?: PaginationInfo;
  }> {
    const limit = query.limit ?? getRuntimeSettings().ORDER_HISTORY_LIMIT;
    const pagination =
      query.page === undefined
        ? undefined
        : paginate(
            await this.ordersService.countMyOrders(
              query.phone,
              user.id,
              user.role === UserRole.COURIER,
              query.q,
            ),
            query.page,
            limit,
          );
    const orders = await this.ordersService.getMyOrders(
      query.phone,
      limit,
      pagination?.page,
      user.id,
      user.role === UserRole.COURIER,
      user,
      query.q,
    );
    return { success: true, count: orders.length, orders, ...(pagination ? { pagination } : {}) };
  }

  @Get('couriers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getCouriers() {
    return { couriers: await this.authService.listCouriers() };
  }

  @Get('available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COURIER, UserRole.ADMIN)
  getAvailable(
    @Query(new ZodValidationPipe(getListOrdersQuerySchema)) query: z.infer<
      ReturnType<typeof getListOrdersQuerySchema>
    >,
    @CurrentUser() user: UserSummary,
  ) {
    return this.ordersService.getAvailableDeliveries(user, query.page ?? 1, query.limit);
  }

  @Post(':orderId/delivery-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COURIER)
  async requestDelivery(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @CurrentUser() user: UserSummary,
  ) {
    await this.ordersService.requestDelivery(orderId, user);
    await this.ordersGateway.notifyListsChanged();
    return { success: true };
  }

  @Post(':orderId/delivery-requests/:courierId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reviewDeliveryRequest(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @Param('courierId', new ZodValidationPipe(UserIdSchema)) courierId: string,
    @Body(new ZodValidationPipe(z.object({ decision: z.enum(['APPROVE', 'REJECT']) }))) body: {
      decision: 'APPROVE' | 'REJECT';
    },
    @CurrentUser() user: UserSummary,
  ) {
    if (body.decision === 'REJECT') {
      await this.ordersService.rejectDeliveryRequest(orderId, courierId, user);
    } else {
      const result = await this.ordersService.assignCourier(orderId, courierId, user, true);
      await this.ordersGateway.notifyStatusUpdated(result.order, result.logEntry);
    }
    await this.ordersGateway.notifyListsChanged();
    return { success: true };
  }

  @Post(':orderId/courier')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async assignCourier(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          courierId: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .nullable()
            .optional(),
        }),
      ),
    )
    body: { courierId?: string | null },
    @CurrentUser() user: UserSummary,
  ) {
    const courierId = body.courierId ?? null;
    const result = await this.ordersService.assignCourier(orderId, courierId, user);
    await this.ordersGateway.notifyStatusUpdated(result.order, result.logEntry);
    return { success: true, order: result.order };
  }

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  async getOrder(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @CurrentUser() user: UserSummary,
  ): Promise<{ success: boolean; order: OrderDetails }> {
    const order = await this.ordersService.getOrderById(orderId, user);
    return { success: true, order };
  }

  @Get(':orderId/receipt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @Throttle({
    default: {
      limit: () => getRuntimeSettings().RECEIPT_RATE_LIMIT_MAX,
      ttl: () => getRuntimeSettings().RATE_LIMIT_TTL_MS,
    },
  })
  async downloadReceipt(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @Query(new ZodValidationPipe(getReceiptQuerySchema)) query: z.infer<
      ReturnType<typeof getReceiptQuerySchema>
    >,
    @CurrentUser() user: UserSummary,
    @Res() response: FastifyReply,
  ): Promise<FastifyReply> {
    const receipt = await this.receiptService.create(orderId, user, query.language);
    const safeOrderNumber = receipt.orderNumber.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    return response
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="KitchenToDoor-Receipt-${safeOrderNumber || 'order'}.pdf"`,
      )
      .header('Content-Length', receipt.pdf.byteLength)
      .header('X-Content-Type-Options', 'nosniff')
      .send(Buffer.from(receipt.pdf));
  }

  @Patch(':orderId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  async updateStatus(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @Body(new ZodValidationPipe(OrderStatusChangeSchema))
    body: Omit<UpdateOrderStatusDto, 'orderId'>,
    @CurrentUser() user: UserSummary,
  ): Promise<{ success: boolean; order: OrderDetails }> {
    const result = await this.ordersService.updateOrderStatus(orderId, body.status, body.note, {
      userId: user?.id,
      role: user?.role || UserRole.ADMIN,
      name: user?.name || 'Dispatcher',
    });

    await this.ordersGateway.notifyStatusUpdated(result.order, result.logEntry);

    return { success: true, order: result.order };
  }

  @Post(':orderId/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  async cancelOrder(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @Body(new ZodValidationPipe(z.object({ reason: CancellationReasonSchema })))
    body: { reason: string },
    @CurrentUser() user: UserSummary,
  ): Promise<{ success: boolean; order: OrderDetails }> {
    const result = await this.ordersService.cancelOrder(orderId, body.reason, {
      userId: user?.id,
      role: user?.role || UserRole.CUSTOMER,
      name: user?.name || 'Customer',
    });

    await this.ordersGateway.notifyOrderCancelled(result.order, result.logEntry, body.reason);

    return { success: true, order: result.order };
  }

  @Post(':orderId/telemetry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COURIER, UserRole.ADMIN)
  async updateTelemetry(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @Body(new ZodValidationPipe(CourierLocationUpdateSchema.omit({ orderId: true })))
    body: Omit<CourierLocationUpdateDto, 'orderId'>,
    @CurrentUser() user: UserSummary,
  ): Promise<{ success: boolean }> {
    const canonicalId = await this.ordersService.updateCourierCoordinates(
      orderId,
      body.lat,
      body.lng,
      user,
      body.timestamp,
    );
    await this.ordersGateway.notifyCourierLocation(
      canonicalId,
      body.lat,
      body.lng,
      body.heading,
      body.speed,
      body.timestamp,
    );
    return { success: true };
  }
}
