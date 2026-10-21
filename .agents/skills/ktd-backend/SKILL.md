---
name: ktd-backend
description: >-
  Guides backend engineering for NestJS, Fastify, Mongoose, and Socket.io in KitchenToDoor.
  Trigger whenever creating or modifying controllers, services, database schemas,
  WebSocket gateways, authentication guards, or rate limiters.
---

# KitchenToDoor: Backend Architecture Skill

This skill provides authoritative patterns, version constraints, and checklists for building and maintaining services, controllers, database models, and WebSocket handlers in `@kitchentodoor/backend`.

## Technology Versions & Constraints

Technology | Version | Critical Architecture Constraint
:--- | :--- | :---
**NestJS** | `^12.2.0` | **CRITICAL:** Always use explicit `@Inject(Service)` on constructor parameters. `tsx` watch runner does not emit `design:paramtypes`. Without `@Inject()`, dependency injection fails!
**Fastify** | `^5.12.7` | Running via `@nestjs/platform-fastify`. Fastify request/reply lifecycle; no Express-only middleware.
**Mongoose** | `^9.11.2` | Strongly typed schemas with `@Schema()` / `@Prop()`. Optimistic concurrency control for order updates.
**Socket.io** | `^4.8.4` | `@WebSocketGateway`, handshake authentication, `WsJwtGuard`, `RolesGuard`, room-based broadcasting (`order_<id>`, `admins`, `couriers`).
**Bcryptjs** | `^3.0.3` | Password hashing with cost factor 12 (`getRuntimeSettings().PASSWORD_HASH_ROUNDS`).
**JWT & Passport**| `^12.0.3` | Stateless tokens validated via `JwtStrategy` and `WsJwtGuard`. Session revocation via `tokenVersion`.
**Throttler** | `^6.7.1` | HTTP rate limits via `@nestjs/throttler` (`@Throttle()`), plus in-memory `SocketRateLimiter` on WebSockets.

---

## 1. The `@Inject()` Constructor Rule (CRITICAL)

Because the development server runs under `tsx` without `emitDecoratorMetadata: true`, NestJS cannot infer constructor types automatically.
**Every injected service, repository, or model MUST have an explicit `@Inject()` token:**

```typescript
// ❌ FAILS at runtime under tsx (Nest can't resolve dependencies of OrdersService):
constructor(
  private readonly orderModel: Model<OrderDocument>,
  private readonly authService: AuthService,
) {}

// ✅ CORRECT:
constructor(
  @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  @Inject(AuthService) private readonly authService: AuthService,
) {}
```

---

## 2. Controller Pattern with Zod Validation

Use `ZodValidationPipe` to strictly validate request parameters, queries, and bodies against `@kitchentodoor/shared` schemas:

```typescript
import { Controller, Get, Post, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  CreateOrderSchema,
  OrderIdentifierSchema,
  UserRole,
  type CreateOrderDto,
  type UserSummary,
} from '@kitchentodoor/shared';

@Controller('api/orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly ordersService: OrdersService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body(new ZodValidationPipe(CreateOrderSchema)) body: CreateOrderDto,
    @CurrentUser() user: UserSummary,
  ) {
    const order = await this.ordersService.createOrder(body, user.id);
    return { success: true, order };
  }

  @Get(':orderId')
  async getOrder(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
  ) {
    const order = await this.ordersService.getOrderById(orderId);
    return { success: true, order };
  }
}
```

---

## 3. Optimistic Concurrency Control in Services

When advancing order statuses or modifying shared resources, **never** read and call `order.save()`. Other dispatchers or couriers could change the record in between. Use conditional atomic operations:

```typescript
// ✅ CORRECT: Atomic status progression with audit trail
const updatedOrder = await this.orderModel.findOneAndUpdate(
  {
    _id: order._id,
    status: currentExpectedStatus, // Conditional lock: fails if status already changed
  },
  {
    $set: { status: newStatus },
    $push: { auditTrail: logEntry },
  },
  { returnDocument: 'after' },
);

if (!updatedOrder) {
  throw new ConflictException(
    'This order changed in another session. Please refresh and try again.',
  );
}
```

---

## 4. WebSocket Gateway Standards

```typescript
import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Inject } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '@kitchentodoor/shared';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class OrdersGateway {
  @WebSocketServer()
  server: Server;

  // Handshake authentication attaches user to socket.data.user
  async handleConnection(client: Socket) {
    // Process handshake auth token if present
  }

  // Room subscriptions
  @SubscribeMessage('order:join')
  async handleJoinOrder(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    await client.join(`order_${data.orderId}`);
    return { ok: true };
  }

  // Protected mutation events
  @UseGuards(WsJwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @SubscribeMessage('order:cancel')
  async handleCancelOrder(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    // Process cancellation...
  }
}
```

---

## 5. Token Versioning & Session Revocation

The `User` document contains a `tokenVersion` counter (`number`).
- JWT payloads encode `ver: user.tokenVersion`.
- On logout or password reset: `await this.userModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } })`.
- `AuthService.validateSession(payload)` verifies `user.tokenVersion === payload.ver`. Older tokens become instantly invalid across both REST and Socket.io.

---

## Reference Documents

- [`references/endpoint-patterns.md`](./references/endpoint-patterns.md)
