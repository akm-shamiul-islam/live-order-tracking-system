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

| Technology    | Version                                           | Critical Architecture Constraint                                                                                                                                                       |
| :------------ | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NestJS**    | `^12.2.0`                                         | **CRITICAL:** Always use explicit `@Inject(Service)` on constructor parameters. `tsx` watch runner does not emit `design:paramtypes`. Without `@Inject()`, dependency injection fails! |
| **Fastify**   | `^5.12.7`                                         | Running via `@nestjs/platform-fastify`. Fastify request/reply lifecycle; no Express-only middleware.                                                                                   |
| **Mongoose**  | `^9.11.3`                                         | Strongly typed schemas with `@Schema()` / `@Prop()`. Optimistic concurrency control for order updates.                                                                                 |
| **Socket.io** | `^4.8.4`                                          | `@WebSocketGateway`, handshake authentication, `WsJwtGuard`, `RolesGuard`, room-based broadcasting (`order_<id>`, `admins`, `couriers`).                                               |
| **Bcryptjs**  | `^3.0.3`                                          | Password hashing with cost factor 12 (`getRuntimeSettings().PASSWORD_HASH_ROUNDS`).                                                                                                    |
| **JWT**       | `@nestjs/jwt ^12.0.3`                             | Signed access tokens and database session-version validation.                                                                                                                          |
| **Passport**  | `passport-jwt ^4.0.1`, `@nestjs/passport ^12.0.0` | Current account access is enforced by JwtStrategy and WsJwtGuard.                                                                                                                      |
| **Sharp**     | `0.35.5`                                          | Runtime raster validation/normalization for private profile photos; local receipt thumbnail preparation.                                                                               |
| **Throttler** | `^6.7.1`                                          | HTTP rate limits via `@nestjs/throttler` (`@Throttle()`), plus in-memory `SocketRateLimiter` on WebSockets.                                                                            |

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
import { Controller, Get, Post, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  CreateOrderSchema,
  OrderIdentifierSchema,
  type CreateOrderDto,
  type UserSummary,
} from '@kitchentodoor/shared';

@Controller('api/orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

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
  @UseGuards(JwtAuthGuard)
  async getOrder(
    @Param('orderId', new ZodValidationPipe(OrderIdentifierSchema)) orderId: string,
    @CurrentUser() user: UserSummary,
  ) {
    // The service checks ownership/assignment and returns not-found for unauthorized IDs.
    const order = await this.ordersService.getOrderById(orderId, user);
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

Use the project's `OrderSocket` and `OrderSocketServer` aliases from `backend/src/auth/authenticated-context.ts` so shared event contracts and authenticated socket data stay typed. `WsJwtGuard` populates `client.data.user`; reject a missing actor before a mutation. Keep handshake credentials and message payloads untrusted until validated.

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Inject, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import type { OrderSocket, OrderSocketServer } from '../auth/authenticated-context.js';
import { OrdersService } from './orders.service.js';
import { CancellationReasonSchema, OrderLookupSchema, UserRole } from '@kitchentodoor/shared';
import { allowedOrigins } from '../common/cors.js';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

// Use the configured frontend origin allowlist; do not enable origin: true in production.
@WebSocketGateway({ cors: { origin: allowedOrigins(), credentials: true } })
export class OrdersGateway {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
  ) {}

  @WebSocketServer()
  server: OrderSocketServer;

  // Validate handshake credentials; verify the caller again before privileged work.
  async handleConnection(client: OrderSocket) {
    // Process handshake auth token if present
  }

  // Validate and authorize before joining a customer-specific room.
  @SubscribeMessage('order:join')
  async handleJoinOrder(@ConnectedSocket() client: OrderSocket, @MessageBody() payload: unknown) {
    const { orderId } = OrderLookupSchema.parse(payload);
    const token: unknown = client.handshake.auth?.token;
    const actor = typeof token === 'string' ? await this.authService.verifyToken(token) : undefined;
    const order = await this.ordersService.getOrderById(orderId, actor);
    await client.join(`order_${order.id}`);
    return { ok: true };
  }

  // Protected mutation events
  @UseGuards(WsJwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COURIER)
  @SubscribeMessage('order:cancel')
  async handleCancelOrder(@ConnectedSocket() client: OrderSocket, @MessageBody() payload: unknown) {
    const { orderId, reason } = OrderLookupSchema.extend({
      reason: CancellationReasonSchema,
    }).parse(payload);
    const actor = client.data.user;
    if (!actor) throw new WsException('Sign in before updating an order.');
    // Pass the authenticated actor to the service; enforce assignment and role there too.
    await this.ordersService.cancelOrder(orderId, reason, {
      userId: actor.id,
      role: actor.role,
      name: actor.name,
    });
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
