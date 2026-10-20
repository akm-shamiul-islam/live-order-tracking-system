# KitchenToDoor: Implementation & Quality Verification Report

**Project:** **KitchenToDoor** (`kitchen-to-door`)  
**Status:** Development implementation with known production gaps. See [CODEBASE_REVIEW.md](CODEBASE_REVIEW.md) for current findings. The component checklist and verification results below do not establish production readiness.
<!-- **Date:** October 2026   -->
**Target Environment:** Node.js (v24.x), pnpm 12.14.0 workspace, TypeScript 7.x, React 19, Zustand 5.0.15

---

## 1. Executive Summary

This document summarizes the implemented components and last code verification for **KitchenToDoor** (`kitchen-to-door`), a development application for food ordering, staff dispatch, and simulated courier tracking. The monorepo uses **NestJS (Fastify)**, **MongoDB (Mongoose)**, **Socket.io**, **React 19**, **Zustand 5.0.15**, **TanStack Query**, **Tailwind CSS v4**, and **Motion**.

Shared Zod schemas validate request and authentication contracts. The backend uses salted `bcryptjs` password hashing, JWT authorization, handshake token verification, and JWT/role guards on protected socket events. Guest order tracking remains public; the review records the resulting privacy gaps.

### 1.1 Zustand and login repair

The frontend now uses one Zustand session store for the current user and token. `useAuth` selects shared state, while one root `AuthSessionSync` owns cross-tab synchronization, session verification, socket identity changes, and logout cache cleanup. Existing localStorage keys remain compatible; TanStack Query continues to own order data. See the [session lifecycle and source responsibilities](ARCHITECTURE.md#frontend-state-and-session-lifecycle).

The default-password rejection was caused by unquoted `#` characters in dotenv values. The template now quotes both sample passwords. Existing hashes require an explicit repair; `pnpm auth:reset-dev-admin` restores the configured administrator only with `NODE_ENV=development` and refuses accounts with a non-admin role. Normal startup does not overwrite existing passwords. The staff dialog no longer displays hardcoded credentials. See the [README recovery steps](../../README.md#recover-an-existing-development-administrator).

### 1.2 Navigation, inline errors, and dispatch review

TanStack Router now owns page URLs and selected tracking/courier orders. The shared layout preserves cart and dialog state, lazy pages render through `Outlet`, and the navbar and order actions use real `Link` elements. Staff routes retain their destination while displaying a sign-in gate. See the [README URL matrix](../../README.md#pages-and-shareable-links).

Sign-in, checkout, phone lookup, and tracking forms use Zod field validation with red borders, messages beneath inputs, accessible descriptions, and focus on the first invalid field. The API client retains server field paths and rejects malformed authentication JSON with a readable message. Phone and tracking lookup validation is shared with the backend; whitespace-only customer details are rejected.

Dispatch headers and the requested data columns are centered. Track and Advance controls share equal-height flex alignment. Status advancement and cancellation use conditional writes to reject competing updates before creating an audit entry. Delivered/cancelled orders reject telemetry, and their simulator stops. Audit entries remain separate writes; durable cross-document consistency is still a production gap.

The final runtime review found that source-only shared exports prevented the compiled API from starting under plain Node. The shared build now emits ESM and declarations; production exports use `dist/index.js`, development uses source conditions, and root Vitest explicitly aliases source. A temporary production-mode API process successfully started and returned 401 from its protected profile endpoint.

### 1.3 Runtime settings and deprecation audit

Zod validates environment configuration for HTTP limits/windows, order limits/estimates, pricing, password hashing, database retries, DNS, and browser timings. The frontend loads public pricing from `/api/config`; server secrets are not exposed. Rate-limit feedback uses `Retry-After`. See [CONFIGURATION.md](CONFIGURATION.md) for defaults and deployment behavior.

The Mongoose update paths use `returnDocument: 'after'`; React submit handlers use `SubmitEvent`, and session verification uses `queryClient.query`. The type-aware deprecated API lint rule is an error. These replacements were checked against current primary documentation and installed package declarations, with references in the configuration guide.

### 1.4 Dependency release audit

All 49 maintained external packages across the four manifests match their compatible targets as checked on 2026-10-20: 48 use npm latest, and Node types use the Node 24 release line. Six installed-package upgrades remain, including Zod 4.6.7 and Motion 14.4.0. React 19.3.1 and Tailwind CSS 4.3.3 were already installed; outdated declared minimums and badges were corrected. The deprecated bcrypt types stub was removed, and the standalone root Vitest runner has an explicit Vite peer. See [DEPENDENCIES.md](DEPENDENCIES.md) for every version, migrations, and the upstream Vite+ alias peer warning. Run `pnpm deps:check` to repeat the registry comparison.

---

## 2. Monorepo Directory Architecture

The workspace is organized into **three distinct root-level packages**:

```
kitchen-to-door/
├── .husky/                         # Automated pre-commit (lint-staged) & pre-push (test & typecheck)
│   ├── pre-commit                  # Runs pnpm exec lint-staged (oxlint --fix + oxfmt)
│   └── pre-push                    # Runs pnpm typecheck && pnpm test
├── backend/                        # @kitchentodoor/backend (NestJS Fastify + Mongoose + Socket.io)
│   ├── src/
│   │   ├── auth/                   # Bcryptjs, JWT service, Passport, WsJwtGuard, RolesGuard
│   │   │   ├── decorators/         # @Roles, @CurrentUser
│   │   │   ├── guards/             # JwtAuthGuard, RolesGuard, WsJwtGuard
│   │   │   ├── strategies/         # JwtStrategy (Bearer token extraction)
│   │   │   ├── auth.service.ts     # Password hashing, validation, token issuance
│   │   │   ├── auth.controller.ts  # /api/auth/login, register, me
│   │   │   └── auth.module.ts
│   │   ├── common/
│   │   │   └── pipes/              # ZodValidationPipe (Strict Zod request validation)
│   │   ├── database/               # Mongoose ODM schemas & seeding
│   │   │   ├── schemas/            # user.schema.ts, order.schema.ts, order-status-log.schema.ts
│   │   │   ├── database.module.ts
│   │   │   ├── seed.service.ts     # Missing staff seeding; skipped in production
│   │   │   └── reset-dev-admin.ts  # Explicit development-only administrator password recovery
│   │   ├── orders/                 # Core orders domain
│   │   │   ├── orders.service.ts   # Order creation, status progression state machine, audit logs
│   │   │   ├── orders.gateway.ts   # Socket.io gateway with room routing & WsJwtGuard
│   │   │   ├── orders.controller.ts# REST endpoints with ZodValidationPipe
│   │   │   └── orders.module.ts
│   │   ├── app.module.ts           # Root AppModule with Mongoose & Throttler
│   │   └── main.ts                 # Fastify bootstrap with Helmet & CORS
│   ├── package.json
│   └── tsconfig.json
├── frontend/                       # @kitchentodoor/frontend (React 19 + Zustand + Tailwind v4 + Motion)
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/              # AdminOrdersTable, AdminLoginModal
│   │   │   ├── auth/               # AuthSessionSync (root session effects)
│   │   │   ├── customer/           # MenuCatalog, CartDrawer, CheckoutModal, OrderHistory
│   │   │   ├── forms/              # Accessible FieldError messages
│   │   │   ├── layout/             # Navbar (Dark/Light toggle, ConnectionBadge, Mobile Drawer)
│   │   │   └── tracking/           # OrderTimeline (6-step stepper), LiveMapTracker, CourierSimulator
│   │   ├── hooks/                  # useOrderSocket, useTheme, useAuth, useZodForm
│   │   ├── lib/                    # api.ts (typed client), socket.ts (singleton), queryClient.ts
│   │   │   └── authSession.ts      # Zustand store, persistence, and cross-tab listener
│   │   ├── pages/                  # Menu and tracking/courier route content
│   │   ├── router.tsx              # Typed route tree, lazy pages, unknown-page/error views
│   │   ├── App.tsx                 # Shared route layout, cart, checkout, and staff dialog
│   │   ├── index.css               # Tailwind CSS v4 design tokens, glassmorphism, radar keyframes
│   │   └── main.tsx                # QueryClientProvider, AuthSessionSync, and RouterProvider
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── shared/                         # @kitchentodoor/shared (Shared Zod Schemas & Contracts)
│   ├── src/
│   │   ├── schemas/                # Auth, Order, Telemetry Zod Schemas
│   │   ├── enums.ts                # OrderStatus sequence & transition state machine
│   │   ├── socket-events.ts        # Strongly typed Socket.io client & server event maps
│   │   ├── enums.spec.ts           # Unit tests for status transition state machine
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.build.json          # ESM/declaration output; tests excluded from emitted artifacts
│   └── tsconfig.json
├── documentation/
│   └── docs/                       # Permanent architecture & developer documentation
│       ├── ARCHITECTURE.md         # High-level architecture & technical specifications
│       ├── CODEBASE_REVIEW.md      # Login repairs, verification, and remaining gaps
│       └── IMPLEMENTATION_AND_VERIFICATION_REPORT.md
├── .env.example                    # Environment template; generate JWT_SECRET locally
├── .oxlintrc.json                  # Oxlint configuration
├── .oxfmtrc.json                   # Shared Oxfmt formatting configuration
├── pnpm-workspace.yaml             # PNPM workspace definition
└── package.json                    # Workspace root commands (pnpm dev, dev:backend, dev:frontend)
```

---

## 3. Technology Stack & Role Matrix

| Layer | Technology | Target Version | Project Usage & Justification |
| :--- | :--- | :--- | :--- |
| **Runtime** | `Node.js` | `v24.x` | Modern ECMAScript features, top V8 execution speeds, native fetch, ESM support. |
| **Package Manager** | `pnpm` | `12.14.0` (pinned) | Workspace dependency installation and root commands. |
| **Language** | `typescript` | `^7.0.2` | Workspace-wide strict static type safety (`strict: true`, `noUncheckedIndexedAccess: true`). |
| **Monorepo Tooling** | `vite-plus` (`vp`) | `^1.3.0` | Installed; current scripts invoke Vite, Vitest, TypeScript, Oxlint, and Oxfmt directly. |
| **Git Hooks** | `husky` | `^9.1.7` | Git hooks orchestrator managing `pre-commit` and `pre-push` automated gates. |
| **Staged Linting** | `lint-staged` | `^17.6.0` | Runs linters and formatters strictly against git staged files on commit. |
| **Linter** | `oxlint` | `^1.89.0` | Rust-based linter executing ~50x faster than traditional ESLint, enforcing React and TypeScript correctness. |
| **Formatter** | `oxfmt` | `^0.74.0` | Formats source files using the shared workspace formatting configuration. |
| **Backend Framework** | `NestJS` (`@nestjs/core`) | `^12.2.0` | Enterprise architecture featuring modular dependency injection, decorators, and clean domain separation. |
| **HTTP Engine** | `@nestjs/platform-fastify` | `^12.2.0` | NestJS HTTP adapter; comparative throughput has not been benchmarked. |
| **Real-Time Engine** | `socket.io` / `@nestjs/platform-socket.io` | `^4.8.4` / `^12.2.0` | WebSocket engine managing room subscriptions (`order_<id>`, `admins`), bi-directional telemetry, and acknowledgments. |
| **Database & ODM** | `mongoose` / `@nestjs/mongoose` | `^9.11.2` / `^12.0.0` | Production MongoDB document database with typed Mongoose schemas, indices, and audit logging. |
| **Authentication** | `bcryptjs` + `@nestjs/jwt` + `passport-jwt` | `^3.0.3` / `^12.0.3` / `^4.0.1` | Replaces insecure plaintext auth with salted bcrypt password hashing and cryptographically signed JWTs. |
| **WebSocket Guard** | Custom `WsJwtGuard` | Internal | Revalidates JWTs for protected socket events, followed by role checks. The gateway verifies supplied handshake tokens. |
| **API Security** | `@fastify/helmet` + `@fastify/cors` | `^13.2.0` / `^11.3.1` | Native Fastify security plugins enforcing HTTP response headers and strict CORS origin whitelisting. |
| **Rate Limiter** | `@nestjs/throttler` | `^6.7.1` | HTTP limits, including 10 login attempts and 5 registrations per minute per IP. Socket event limits are not implemented. |
| **Frontend Toolchain** | `vite` | `^8.3.4` | Ultra-fast next-gen build tool with native Rolldown engine, building the frontend for production. |
| **Frontend Framework** | `React` / `React DOM` | `^19.3.1` | Modern React UI with optimized rendering, Actions, and seamless transition management. |
| **Client Auth State** | `zustand` | `5.0.15` (pinned) | Shared user/token store, selective `useAuth` subscriptions, explicit localStorage persistence, and cross-tab synchronization. |
| **Server State** | `@tanstack/react-query` | `^5.104.5` | Orders, cached session verification, and socket-driven cache updates. |
| **Routing** | `@tanstack/react-router` | `^1.170.45` | Typed page routes, shared layouts, staff access gate, order URLs, and browser history. |
| **Styling** | `tailwindcss` + `@tailwindcss/vite` | `^4.3.3` | Utility-first CSS framework using native CSS cascade layers and customized dark/light mode tokens. |
| **Animations** | `motion` (`motion/react`) | `^14.4.0` | Rebranded Framer Motion library powering smooth route transitions, glowing order steppers, and telemetry radar. |
| **Icons & UI** | `lucide-react` + `clsx` + `tailwind-merge` | `^1.60.0` / `^2.1.1` / `^3.7.0` | Accessible Feather-style SVG icons and clean conditional class merging. |
| **Testing** | `vitest` | `^5.0.5` | Maintained source unit and HTTP tests. Browser smoke checks are separate from the automated suite. |

---

## 4. Security Architecture & Hardening Highlights

### 4.1 Current Security Implementation

| Security Domain | Implementation |
| :--- | :--- |
| **Password Storage & Cryptography** | **Bcrypt Password Hashing:** `bcryptjs` uses configured `PASSWORD_HASH_ROUNDS` (default 12). Plaintext passwords are never stored or logged in database records or audit trails. |
| **Session & Token Authorization** | JWTs use the required `JWT_SECRET` and configured `JWT_EXPIRES_IN`. Refresh tokens and server-side revocation are not implemented. |
| **Frontend Session State** | Zustand shares the user and access token. Root synchronization verifies sessions through `/api/auth/me`, reconnects sockets on identity changes, and removes staff/session queries on logout. Backend guards enforce authorization. |
| **WebSocket Connection Security** | The gateway verifies supplied raw or Bearer-prefixed tokens and rejects invalid tokens. Valid staff join rooms according to role. Guests can connect for tracking. Protected events run `WsJwtGuard` and `RolesGuard`. |
| **Role-Based Access Control (RBAC)** | **Strict Role Segregation:** Custom decorators (`@Roles('ADMIN', 'COURIER')`) and guards ensure only authorized roles can mutate order statuses, access dispatch panels, or stream GPS telemetry. |
| **HTTP Rate Limiting** | `HttpThrottlerGuard` applies HTTP limits and skips socket events. Dedicated socket flood protection remains a gap. |
| **HTTP Transport Hardening** | **Fastify Security Plugins:** `@fastify/helmet` supplies security headers including HSTS and X-Frame-Options; CSP is disabled in the current API bootstrap. `@fastify/cors` restricts configured cross-origin requests. |

### 4.2 Socket.io Authentication Handshake Sequence

```mermaid
sequenceDiagram
    participant Client as Frontend
    participant Gateway as OrdersGateway
    participant Auth as AuthService
    participant Guards as WsJwtGuard + RolesGuard

    Client->>Gateway: Connect with optional auth.token
    alt Token supplied
        Gateway->>Auth: Verify raw or Bearer-prefixed JWT
        alt Valid token
            Auth-->>Gateway: User summary
            Gateway->>Gateway: Attach user; join staff room if applicable
            Gateway-->>Client: authenticated with user
        else Invalid or expired token
            Auth-->>Gateway: Verification failed
            Gateway-->>Client: Error and disconnect
        end
    else No token
        Gateway->>Gateway: Keep guest connection for tracking
    end
    Client->>Gateway: Protected mutation event
    Gateway->>Guards: Verify JWT and required role
    Guards-->>Gateway: Allow or reject handler
```

Token changes from Zustand cause the client to reconnect with its current identity. Signing out reconnects as a guest; it does not revoke the previously issued JWT.

---

## 5. Strict Zod Data Validation

We have replaced untyped payloads with shared, strongly typed **Zod Schemas**:

1. **`ZodValidationPipe` (`backend/src/common/pipes/zod-validation.pipe.ts`):**
   * Automatically parses and sanitizes incoming HTTP bodies and queries.
   * On validation failure, returns a formatted `400 Bad Request` with field-level error messages.
2. **`CreateOrderSchema` (`shared/src/schemas/order.schema.ts`):**
   * Enforces non-empty item lists, positive pricing, customer phone numbers, and delivery addresses on `POST /api/orders` and within the frontend checkout modal.
3. **`UpdateOrderStatusSchema` (`shared/src/schemas/order.schema.ts`):**
   * Validates incoming status changes against the strict sequential progression state machine (`PLACED` ➔ `CONFIRMED` ➔ `PREPARING` ➔ `READY_FOR_PICKUP` ➔ `OUT_FOR_DELIVERY` ➔ `DELIVERED`).
4. **`CourierLocationUpdateSchema` (`shared/src/schemas/telemetry.schema.ts`):**
   * Validates latitude (`[-90, 90]`), longitude (`[-180, 180]`), speed, and heading for incoming telemetry events.
5. **`LoginSchema` & `RegisterSchema` (`shared/src/schemas/auth.schema.ts`):**
   * Validates email formats and password lengths before hashing with `bcryptjs`.
6. **Lookup schemas (`shared/src/schemas/lookup.schema.ts`):**
   * Phone numbers require 7–15 digits with supported formatting. Order numbers and MongoDB IDs are validated and normalized for frontend searches and backend reads.

Frontend forms use `useZodForm` to display each field's Zod message below the input with a red border, `aria-invalid`, and `aria-describedby`. Validation runs on blur/submission and rechecks invalid fields during editing. The first invalid input receives focus. `noValidate` ensures browser popups do not intercept the inline messages. Server field paths are preserved by `ApiError`; general service errors remain form-level messages.

---

## 6. Real-Time Order State Synchronization

[useOrderSocket](../../frontend/src/hooks/useOrderSocket.ts) manages order data through TanStack Query. Zustand supplies the shared authentication state used by the API and socket clients.

1. **Load:** A query keyed by `['order', orderId]` fetches order details through REST when an identifier is available.
2. **Resolve and subscribe:** The response supplies the canonical database ID. The hook uses that ID for `order:join` and `order:leave`, including when the original lookup used an order number.
3. **Update the cache:** Typed `order:status_updated` and `courier:location_updated` handlers update the existing query data. Status history entries are deduplicated. Subscribed React views render the new data without an HTTP request for every event.
4. **Handle cancellation:** `order:cancelled` updates the cached status and invalidates the query to reconcile full details.
5. **Reconnect and clean up:** On each socket `connect`, including reconnections after a token change, the hook rejoins the room and invalidates the query to recover missed updates. Cleanup leaves the room and removes its listeners.

---

## 7. Component-by-Component Implementation Checklist

| Component | Path | Status | Verification Details |
| :--- | :--- | :--- | :--- |
| **Workspace Config** | `pnpm-workspace.yaml` | ✅ Passed | Links `backend`, `frontend`, and `shared`. |
| **Root Scripts** | `package.json` | ✅ Passed | Development, build, typecheck, test, and explicit `auth:reset-dev-admin` commands. |
| **Git Pre-commit Hook**| `.husky/pre-commit` | ✅ Passed | Executes `pnpm exec lint-staged` (`oxlint --fix` & `oxfmt`). |
| **Git Pre-push Hook** | `.husky/pre-push` | ✅ Passed | Executes `pnpm typecheck && pnpm test` before pushing to git. |
| **Base TSConfig** | `tsconfig.base.json` | ✅ Passed | Strict TS 7.x base configuration (`strict: true`, `noUncheckedIndexedAccess: true`). |
| **Shared Enums** | `shared/src/enums.ts` | ✅ Passed | `OrderStatus`, `UserRole`, `isValidStatusTransition()`. |
| **Shared Schemas** | `shared/src/schemas/` | ✅ Passed | Zod schemas for Auth, Orders, and Telemetry. |
| **Shared Enums Tests** | `shared/src/enums.spec.ts`| ✅ Passed (6 tests) | State machine progression, cancellation rules, invalid transitions. |
| **Shared Schemas Tests** | `shared/src/schemas.spec.ts`| ✅ Passed (10 tests) | Zod schema validation: Login, Register, Status Updates, GPS Telemetry. |
| **Lookup Schema Tests** | `shared/src/schemas/lookup.schema.spec.ts` | ✅ Passed (17 tests) | Identifier normalization, phone formatting/digit limits, trimmed customer fields, and whitespace-only rejection. |
| **Backend Main** | `backend/src/main.ts` | ✅ Passed | FastifyAdapter, `@fastify/helmet`, `@fastify/cors`, port `5000`. |
| **Database Schemas** | `backend/src/database/schemas/`| ✅ Passed | Mongoose schemas with explicit types for `User`, `Order`, `OrderStatusLog`. |
| **Database Seeder** | `backend/src/database/seed.service.ts`| ✅ Passed | Creates missing staff using configured credentials and hash work factor; production skips seeding; existing passwords are preserved. |
| **Development Admin Recovery** | `backend/src/database/reset-dev-admin.ts` | ✅ Passed | Explicit configured-admin reset; requires development mode and refuses non-admin roles. |
| **Seed and Recovery Tests** | `backend/src/database/seed.service.spec.ts` | ✅ Passed (9 tests) | Parses the actual dotenv template, rejects missing credentials, preserves complete passwords, and checks reset guards and profile preservation. |
| **Auth Service** | `backend/src/auth/auth.service.ts` | ✅ Passed | Bcrypt verification, JWT signing, token verification. |
| **Auth Unit Tests** | `backend/src/auth/auth.service.spec.ts` | ✅ Passed (7 tests) | Bcrypt verification, JWT issuance, duplicate prevention, token validation. |
| **HTTP Regression Tests** | `backend/src/auth/auth.http.spec.ts` | ✅ Passed (32 tests) | Fastify/NestJS auth/roles, lookups, configurable rates/limits, public pricing, paginated responses, and invalid list controls. |
| **Auth Guards** | `backend/src/auth/guards/` | ✅ Passed | `JwtAuthGuard`, `RolesGuard`, `WsJwtGuard`. |
| **Zod Request Pipe** | `backend/src/common/pipes/` | ✅ Passed | `ZodValidationPipe` returning formatted 400 errors. |
| **Orders Gateway** | `backend/src/orders/orders.gateway.ts`| ✅ Passed | Socket.io gateway with room routing & WsJwtGuard. |
| **Orders Controller** | `backend/src/orders/orders.controller.ts`| ✅ Passed | REST endpoints protected by ZodValidationPipe and RBAC. |
| **Orders Unit Tests** | `backend/src/orders/orders.service.spec.ts`| ✅ Passed (17 tests) | Pricing, transitions, concurrent changes, history references, terminal telemetry, literal search, stable sorting, and pagination offsets. |
| **Zustand Auth Store** | `frontend/src/lib/authSession.ts` | ✅ Passed | Shared session with compatible persistence and cross-tab synchronization. |
| **Auth Hook** | `frontend/src/hooks/useAuth.ts` | ✅ Passed | Selects shared user/token state and derives role flags; actions delegate to the API client. |
| **Root Session Sync** | `frontend/src/components/auth/AuthSessionSync.tsx` | ✅ Passed | Owns session verification, storage listener, socket identity, and logout cache cleanup. |
| **Session Store Tests** | `frontend/src/lib/authSession.spec.ts` | ✅ Passed (7 tests) | Stored-session compatibility, malformed data, tab changes, startup races, and blocked storage. |
| **API Client Tests** | `frontend/src/lib/api.spec.ts` | ✅ Passed (11 tests) | Shared sessions, expiration, stale responses, storage failures, field paths, malformed auth, public pricing, and Retry-After. |
| **Router Tests** | `frontend/src/router.spec.ts` | ✅ Passed (11 tests) | Page/order URLs, staff layouts, unknown pages, memory history, shared filters/pages, and canonical search defaults. |
| **Pagination Tests** | `shared/src/pagination.spec.ts` | ✅ Passed (11 tests) | Empty and stale-page boundaries, page-size choices, and invalid page requests. |
| **Runtime Configuration Tests** | `backend/src/config/runtime-settings.spec.ts` | ✅ Passed (15 tests) | Template/default settings, overrides, non-finite values, transformed DNS defaults, and public pricing isolation. |
| **Browser Configuration Tests** | `frontend/src/lib/client-settings-schema.spec.ts` | ✅ Passed (4 tests) | Public defaults, overrides, invalid values, and exclusion of server secrets. |
| **Pricing Tests** | `shared/src/pricing.spec.ts` | ✅ Passed (3 tests) | Custom fees/tax, zero-cost settings, empty orders, and cent rounding. |
| **Frontend Entry** | `frontend/src/main.tsx` | ✅ Passed | React 19 + QueryClientProvider with one root AuthSessionSync and RouterProvider. |
| **Navbar** | `frontend/src/components/layout/Navbar.tsx`| ✅ Passed | Compact header, collapsible desktop sidebar, and animated mobile dialog with keyboard dismissal. |
| **Connection Badge** | `frontend/src/components/tracking/ConnectionBadge.tsx`| ✅ Passed | Live socket status pill with roundtrip ping latency in milliseconds. |
| **Order Stepper** | `frontend/src/components/tracking/OrderTimeline.tsx`| ✅ Passed | 6-stage animated progress stepper with `motion/react` pulsing rings. |
| **Telemetry Radar** | `frontend/src/components/tracking/LiveMapTracker.tsx`| ✅ Passed | Circular radar sweep with animated courier beacon traveling to doorstep. |
| **GPS Simulator** | `frontend/src/components/tracking/CourierSimulator.tsx`| ✅ Passed | Interactive controls to broadcast live GPS coordinates over WebSockets. |
| **Food Menu** | `frontend/src/components/customer/MenuCatalog.tsx`| ✅ Passed | Food menu cards with categories, prices, calorie badges, and cart adding. |
| **Cart Drawer** | `frontend/src/components/customer/CartDrawer.tsx`| ✅ Passed | Animated slide-out drawer with quantity controls and price breakdown. |
| **Checkout Modal** | `frontend/src/components/customer/CheckoutModal.tsx`| ✅ Passed | Zod field errors, focus management, full order validation, and navigation to the new tracking URL. |
| **Staff Login** | `frontend/src/components/admin/AdminLoginModal.tsx`| ✅ Passed | Accessible dialog with inline field errors, password visibility, and no hardcoded credential hint. |
| **Dispatch Table** | `frontend/src/components/admin/AdminOrdersTable.tsx`| ✅ Passed | Equal-height Track/Advance controls, shareable tracking links, real-time updates, search, filters, and conflict messages. |
| **Git Exclusions** | `.gitignore` | ✅ Passed | Excludes `backup/`, `documentation/audit/`, `documentation/plan/`, `documentation/to-do/`, `.env`, `node_modules/`. |

---

## 8. Development & Run Commands

```bash
# 1. Install all monorepo dependencies
pnpm install

# 2. Run both backend and frontend concurrently (One Command)
pnpm dev

# 3. Or run backend independently (Fastify on http://localhost:5000)
pnpm dev:backend

# 4. Or run frontend independently (Vite on http://localhost:5173)
pnpm dev:frontend

# 5. Run typechecking across all workspaces
pnpm typecheck

# 6. Run all unit and integration tests (Vitest)
pnpm test

# 7. Build all workspace packages
pnpm build

# 8. Run the compiled API after building (configure production environment before deployment)
pnpm --filter @kitchentodoor/backend start
```

For development credential recovery, follow the [README instructions](../../README.md#recover-an-existing-development-administrator) before running `pnpm auth:reset-dev-admin`. MongoDB must be reachable; the command changes the configured administrator's stored password hash.

---

## 9. Last Code Verification

The last implementation verification passed `pnpm typecheck`, **161 source tests across 15 suites** with `pnpm test`, and `pnpm build` for all packages. Lint reported **0 errors**, including the type-aware deprecated API check; existing warnings remain. [vitest.config.ts](../../vitest.config.ts) selects maintained source tests from the three packages, excluding compiled copies and backups.

After the dependency upgrades, a fresh compiled production API and frontend preview passed browser checks for normalized staff login, inline Zod errors and focus, Motion tracking rendering, live Socket.io connectivity, and cart pricing from overridden delivery/tax settings. No order was created or advanced. `pnpm deps:check` found no outdated direct package; `pnpm audit --json` reported zero vulnerabilities. The known Vite+ core-alias peer warning is documented in the dependency audit.

Authentication coverage includes the HTTP login/validation/authorization flow, Zustand persistence and cross-tab races, expired-session handling, delayed 401 responses, and the actual dotenv template. Separate local browser smoke checks covered desktop and mobile sign-in, full default credentials, immediate UI updates, refresh persistence, logout, guest socket reconnection, and two-tab session changes. These checks are not an automated end-to-end browser suite.

The navigation/form review also checked equal 32px action-button bounds, direct tracking refresh, Back/Forward, courier URLs, invalid tracking URLs, phone errors, checkout field errors, first-error focus, native Escape dismissal, mobile links, and page overflow. New source tests cover route matching/history, invalid lookups, malformed auth JSON, competing status changes, and terminal telemetry rejection.

The configuration follow-up verified all seven dispatch headers and the five requested data columns with computed browser styles. Track and Advance retained identical 32px bounds. Cart fee/tax matched `/api/config`, and submitted invalid checkout fields displayed red borders, linked messages, and first-error focus. An isolated compiled production API returned overridden fee/tax settings, rejected an unauthenticated profile request, skipped staff seeding, and emitted no Mongoose startup warnings.

Runtime verification also imported the shared JavaScript in plain Node, resolved source exports through the development condition, and started the compiled API in production mode on an isolated port. Source test discovery and typechecking remain independent of built shared artifacts.

The navigation/list follow-up verifies a 288px desktop content shift and restoration, mobile drawer Escape/link dismissal and scroll unlock, dark category hover styles, all eight dispatch statuses, explicit Filter/Search actions, equal search-icon spacing, and button icons. Temporary browser response fixtures exercise next-page navigation, a 25-item selection resetting to page one, and a partial final page. Real API reads verify filtering/history; no existing orders are advanced for these checks. Invalid direct URLs normalize to defaults, and server-clamped pages correct their URL. A 1024px tablet check covers light mode, contained overflow, and reduced-motion transitions.

See [CODEBASE_REVIEW.md](CODEBASE_REVIEW.md#verification) for the verification scope and remaining implementation gaps.

## Official package compatibility follow-up

The documentation review found and corrected missing JavaScript reduced-motion handling, aligned Node declarations with Node 24 LTS, adopted native Zod 4 router validation with explicit defaults, and corrected formatter feature claims. The staged-file hook now includes JavaScript/TypeScript module extensions. Source tests, typechecking, builds, lint, and fresh production browser checks pass. Temporary browser fixtures verify normal and reduced-motion tracking behavior without changing orders. Official documentation links and package-by-package findings are recorded in [DEPENDENCIES.md](DEPENDENCIES.md#official-documentation-compatibility-review).
