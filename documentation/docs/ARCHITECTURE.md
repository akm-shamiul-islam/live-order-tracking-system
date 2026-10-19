# System Architecture & Technical Specifications: KitchenToDoor

## Executive Summary
This document provides the high-level architecture, database schema design, and security protocols for **KitchenToDoor** (`kitchen-to-door`). The project is structured as a **PNPM Monorepo** managed with **Vite+ / VoidZero** unified tooling, **TypeScript 7.x**, and automated quality gates powered by **Husky** (`v9.1.x`) and **lint-staged** (`v17.x`).

## Monorepo Layout & Package Namespaces
```
kitchen-to-door/
├── .husky/
│   ├── pre-commit    # Staged linting & formatting (oxlint + oxfmt via lint-staged)
│   └── pre-push      # Automated typecheck & Vitest unit/integration tests
├── apps/
│   ├── api/          # @kitchentodoor/api: NestJS (Fastify) + Mongoose + Socket.io Gateway
│   └── web/          # @kitchentodoor/web: React 19 + TanStack (Router + Query) + Tailwind v4 + Motion
├── packages/
│   └── shared/       # @kitchentodoor/shared: Zod schemas, DTOs, and Socket.io event interfaces
└── documentation/
    ├── audit/        # Initial reference specifications
    ├── docs/         # Architecture, security, and developer guides
    └── plan/         # Master upgrade and migration plans
```

## Quality Assurance & Git Hooks
1. **`pre-commit` (via `lint-staged`):**
   * Instant Rust-based linting (`oxlint --fix`).
   * Instant Rust-based formatting (`oxfmt`) with automatic Tailwind CSS class sorting.
2. **`pre-push` (via Husky):**
   * Full TypeScript 7.x workspace typecheck (`pnpm typecheck`).
   * Vitest test suite execution (`pnpm test`).
   * Ensures that no broken code, invalid schemas, or failing tests reach the remote repository.

## HTTP & Real-Time Engine: NestJS + Fastify + Socket.io
* **HTTP Adapter:** Fastify (`@nestjs/platform-fastify` v12.1.3), delivering 2x to 3x higher throughput compared to Express.
* **Security Middleware:** `@fastify/helmet` and `@fastify/cors`.
* **Socket.io Gateway:** Connected to Fastify's underlying Node HTTP server for WebSocket connection management, rooms (`order_<id>`, `admins`), and live telemetry broadcasting.

## Database Architecture: MongoDB + Mongoose
In accordance with system requirements, the database utilizes **MongoDB** with strongly typed Mongoose schemas:

1. **Users (`users`)**:
   - `_id`: ObjectId
   - `name`: String
   - `email`: String (Unique index)
   - `passwordHash`: String (Bcryptjs, salt rounds: 12)
   - `role`: Enum `['CUSTOMER', 'COURIER', 'ADMIN']`
   - `phone`: String (Indexed)
   - `createdAt`, `updatedAt`: Timestamps

2. **Orders (`orders`)**:
   - `_id`: ObjectId
   - `orderNumber`: String (Unique indexed, e.g. `ORD-8492`)
   - `customer`: Subdocument `{ userId?, name, phone, address }`
   - `courierId`: ObjectId (Ref `User`)
   - `items`: Array of `{ itemId, name, price, quantity }`
   - `pricing`: Subdocument `{ subtotal, deliveryFee, tax, total }`
   - `status`: Enum `['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']`
   - `deliveryCoordinates`: `{ lat, lng }`
   - `courierCoordinates`: `{ lat, lng, lastUpdated }`
   - `estimatedDeliveryAt`: Date
   - `createdAt`, `updatedAt`: Timestamps

3. **Order Status Logs (`order_status_logs`)**:
   - `_id`: ObjectId
   - `orderId`: ObjectId (Ref `Order`)
   - `orderNumber`: String
   - `status`: String
   - `note`: String
   - `changedBy`: `{ userId, role, name }`
   - `timestamp`: Date

## Security Architecture
1. **Password Hashing:** `bcryptjs` with a work factor of 12. No plaintext credentials are ever logged or persisted.
2. **Stateless JWT Authorization:** Signed with `JWT_SECRET` for REST endpoints and WebSocket handshakes.
3. **Socket.io Handshake Guard (`WsJwtGuard`):** Authenticates connections using the WebSocket handshake `auth.token`.
4. **Role-Based Access Control (RBAC):** Protects administrative status transitions and broadcast channels.
5. **Rate-Limiting:** Guarded by `@nestjs/throttler` to prevent event flooding.
