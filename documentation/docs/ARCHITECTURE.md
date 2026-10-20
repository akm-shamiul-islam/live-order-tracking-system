# System Architecture & Technical Specifications: KitchenToDoor

## Executive Summary

This document describes the architecture, database schemas, and authentication flow for **KitchenToDoor** (`kitchen-to-door`). The **pnpm monorepo** uses TypeScript 7.x, NestJS, React 19, Zustand 5.0.15, and automated checks through Husky and lint-staged. Vite+ is installed; the current scripts invoke the individual build, test, lint, and formatting tools directly.

## Monorepo Layout & Package Namespaces

```
kitchen-to-door/
├── .husky/
│   ├── pre-commit    # Staged linting & formatting (oxlint + oxfmt via lint-staged)
│   └── pre-push      # Automated typecheck & Vitest unit/integration tests
├── backend/          # @kitchentodoor/backend: NestJS (Fastify) + Mongoose + Socket.io Gateway
├── frontend/         # @kitchentodoor/frontend: React 19 + Zustand + TanStack Query + Tailwind v4 + Motion
├── shared/           # @kitchentodoor/shared: Zod schemas, DTOs, and Socket.io event interfaces
└── documentation/
    ├── docs/         # Architecture, security, and developer guides
    ├── audit/        # Ignored audit specifications
    └── plan/         # Ignored master upgrade and migration plans
```

## Quality Assurance & Git Hooks

1. **`pre-commit` (via `lint-staged`):**
   * Type-aware linting (`oxlint --fix`), including deprecated API errors.
   * Rust-based formatting (`oxfmt`) using the shared workspace settings.
2. **`pre-push` (via Husky):**
   * Full TypeScript 7.x workspace typecheck (`pnpm typecheck`).
   * Vitest test suite execution (`pnpm test`).
   * Runs the configured static and test gates before a push; runtime verification is still necessary.

## HTTP & Real-Time Engine: NestJS + Fastify + Socket.io

* **HTTP Adapter:** Fastify (`@nestjs/platform-fastify` v12.2.0), serving HTTP requests; comparative throughput has not been benchmarked.
* **Security Middleware:** `@fastify/helmet` and `@fastify/cors`.
* **Socket.io Gateway:** Connected to Fastify's underlying Node HTTP server for WebSocket connection management, rooms (`order_<id>`, `admins`), and live telemetry broadcasting.

## Database Architecture: MongoDB + Mongoose

In accordance with system requirements, the database utilizes **MongoDB** with strongly typed Mongoose schemas:

1. **Users (`users`)**:
   - `_id`: ObjectId
   - `name`: String
   - `email`: String (Unique index)
   - `passwordHash`: String (Bcryptjs, configurable work factor, default 12)
   - `role`: Enum `['CUSTOMER', 'COURIER', 'ADMIN']`
   - `phone`: String (Indexed)
   - `createdAt`, `updatedAt`: Timestamps

2. **Orders (`orders`)**:
   - `_id`: ObjectId
   - `orderNumber`: String (Unique indexed, e.g. `KTD-8492`)
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

1. **Password Hashing:** `bcryptjs` with the configured `PASSWORD_HASH_ROUNDS` work factor (default 12). User database records store password hashes.
2. **Stateless JWT Authorization:** Signed with `JWT_SECRET` for REST endpoints and WebSocket handshakes.
3. **Socket authentication:** The gateway verifies supplied handshake tokens; guest tracking remains allowed. `WsJwtGuard` revalidates tokens for protected events, followed by `RolesGuard`. Raw and Bearer-prefixed tokens are supported.
4. **Role-Based Access Control (RBAC):** Protects administrative status transitions and broadcast channels.
5. **HTTP rate limiting:** `HttpThrottlerGuard` limits HTTP requests and skips socket events. Socket flood protection remains to be implemented.

## Frontend state and session lifecycle

| State | Owner | Usage |
| --- | --- | --- |
| Current user and access token | Zustand 5.0.15 | One shared session for `useAuth`, the API client, and the socket client. |
| Orders and session verification | TanStack Query | REST results, socket-driven order updates, and cached `/api/auth/me` checks. |
| Page, selected order, list filters and pagination | TanStack Router | Typed URLs, direct links, browser history, and staff route layout. |
| Cart, dialogs, and form drafts | React component state | The root layout preserves the cart while navigating between pages. |

The session uses a singleton `createStore` from `zustand/vanilla`, with selective `useStore` subscriptions in React. It does not need a Zustand provider. Persistence is implemented explicitly around the existing `ktd_token` and `ktd_user` localStorage keys, preserving saved sessions from before the migration. Zustand's `persist` middleware is not used.

### Session lifecycle

1. **Restore:** The store reads the saved token/user pair and validates the user's shape with `UserSummarySchema`. An incomplete pair or malformed user data starts a guest session. This does not verify the JWT; the backend performs that check.
2. **Sign in:** The API client validates successful login and registration responses with `AuthResponseSchema`, then saves the returned user and access token to the store and localStorage. Every `useAuth` consumer observes the same state. Passwords are not placed in the store.
3. **Synchronize:** One `AuthSessionSync` component inside `QueryClientProvider` registers a storage listener and rereads storage when it mounts, including changes that occurred during startup. Same-origin tabs synchronize login and logout through storage events. If storage is inaccessible, an active in-memory login is preserved, but persistence and cross-tab synchronization are unavailable.
4. **Verify and connect:** When the token changes, `AuthSessionSync` updates the singleton socket's identity and fetches `/api/auth/me` through `queryClient.query` with the `['auth-session', token]` key. `VITE_SESSION_STALE_TIME_MS` controls freshness (default 60 seconds), with no automatic retries; this is not periodic token refresh. Socket identity changes disconnect and reconnect with the new token, or with guest authentication after logout.
5. **Sign out or expire:** Logout clears the store and saved values. A 401 from a request using the current token also clears the session; a delayed 401 for an older token cannot clear a newer login. With no token, `AuthSessionSync` removes `admin-orders` and `auth-session` queries and connects the socket as a guest.

`useAuth` derives `isAuthenticated`, `isAdmin`, and `isCourier` for display and navigation. JWT and role guards on the backend enforce access. The `/api/auth/me` query verifies the session but does not replace the stored user profile. Automatic refresh, server-side revocation, and immediate synchronization of role changes are not implemented.

### Source responsibilities

| Source | Responsibility |
| --- | --- |
| [authSession.ts](../../frontend/src/lib/authSession.ts) | Vanilla Zustand store, storage validation, save/clear helpers, and cross-tab listener. |
| [useAuth.ts](../../frontend/src/hooks/useAuth.ts) | User/token selectors, role flags, and login/register/logout actions. |
| [AuthSessionSync.tsx](../../frontend/src/components/auth/AuthSessionSync.tsx) | Root owner of storage synchronization, session verification, socket identity, and logout cache cleanup. |
| [api.ts](../../frontend/src/lib/api.ts) | Reads the current token for authenticated requests, saves auth responses, and handles 401 expiration without clearing a newer session. |
| [socket.ts](../../frontend/src/lib/socket.ts) | Singleton Socket.io client and reconnection when authentication changes. |
| [main.tsx](../../frontend/src/main.tsx) | Mounts `AuthSessionSync` and `RouterProvider` inside `QueryClientProvider`. |

Regression coverage is in [authSession.spec.ts](../../frontend/src/lib/authSession.spec.ts) and [api.spec.ts](../../frontend/src/lib/api.spec.ts). See the [implementation report](IMPLEMENTATION_AND_VERIFICATION_REPORT.md#9-last-code-verification) for the last code verification results.

## Navigation and field validation

[router.tsx](../../frontend/src/router.tsx) defines a typed TanStack route tree. The root [App layout](../../frontend/src/App.tsx) renders an `Outlet`, owns cart and dialog state, and shares cart/login actions through `AppActionsContext`. Page components load lazily. The navbar, dispatch Track actions, and history actions render `Link` elements, supporting copying links and opening new tabs.

Public pages are `/`, `/tracking`, `/tracking/$orderId`, and `/orders`. The pathless `StaffOnly` layout wraps `/dispatch`, `/courier`, and `/courier/$orderId`. It renders a sign-in prompt instead of the protected outlet for guests, keeping the requested URL. Backend guards continue to authorize private data and mutations. Tracking IDs are part of the URL, so refresh and browser history restore the selected order. The root supplies unknown-page and loading-error views.

[useZodForm](../../frontend/src/hooks/useZodForm.ts) validates fields on blur and submission, then rechecks invalid fields during editing. Inputs reference a [FieldError](../../frontend/src/components/forms/FieldError.tsx) with `aria-describedby` and expose `aria-invalid`; shared CSS supplies red borders, including focused inputs and dark mode. Submission focuses the first invalid field. Forms use `noValidate` so native browser popups do not intercept the Zod messages. API errors preserve server field paths for inline display, while network/service errors remain form-level.

[Shared lookup schemas](../../shared/src/schemas/lookup.schema.ts) validate phone numbers and normalize order numbers/database IDs. The API validates order-history queries and tracking parameters with the same schemas. Customer names and addresses are trimmed before minimum-length checks. Checkout validates its visible fields before validating the full order payload. Malformed authentication responses produce a readable service error and cannot create a session.

Production hosts must route frontend paths to `index.html` and proxy API/socket paths separately. See the [README URL matrix](../../README.md#pages-and-shareable-links) and [TanStack's routing guide](https://tanstack.com/router/latest/docs/routing/code-based-routing).

### Drawer navigation and list controls

The header contains the brand, navigation trigger, and account/cart/theme actions. `NavigationDrawer` renders a fixed, nonmodal desktop sidebar or a native mobile dialog according to `useDesktopLayout`. The desktop content margin animates with the 288px sidebar; mobile content retains its width. Closed desktop navigation is inert. Mobile focus containment, Escape handling, and scroll locking use `useDialog`. CSS provides opening/closing transitions and reduced-motion overrides.

`ThemedSelect` implements a select-only combobox with an active descendant, listbox options, keyboard navigation, Home/End, type-ahead, Escape, and outside-click dismissal. Dispatch uses separate draft controls for explicit Filter/Search submission. The shared `Pagination` component presents result counts, the requested 10/25/50/100 sizes, and boundary/page controls.

List search schemas validate category/status/query/page/size in URLs; router middleware omits defaults. Phone history queries keep the phone in component state. Menu pagination slices the complete shared catalog locally. Dispatch/history request database pages, count matching orders, clamp stale page numbers, and sort by `createdAt` plus unique `_id` for stable ties. Dispatch search escapes regex characters and applies to the database before pagination. Existing unpaged API requests remain compatible.

Implementation references: [TanStack search parameters](https://tanstack.com/router/latest/docs/guide/search-params), [select-only combobox behavior](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [native dialog transitions](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog#animating_dialogs), and [MongoDB sort consistency](https://www.mongodb.com/docs/manual/reference/method/cursor.sort/#sort-consistency).

## Environment configuration and development accounts

The API resolves the root `.env` before the `backend/.env` fallback using paths relative to `app.module.ts`, so starting from either workspace directory uses the same precedence. Existing process environment variables override file values. `JWT_SECRET` is required, and `JWT_EXPIRES_IN` controls token lifetime.

Outside production, startup creates missing default staff accounts from `ADMIN_DEFAULT_*` and `COURIER_DEFAULT_*`. It does not overwrite existing passwords. Values containing `#` must remain quoted in environment files; the earlier unquoted defaults could seed a hash of a truncated password. Production skips default staff seeding.

Runtime limits, pricing, estimates, connection retries, DNS, password work factor, and browser timing settings are configurable and validated with Zod. There are no hardcoded staff credential fallbacks. The API's `/api/config` endpoint exposes only public pricing; cart and checkout use it with the same calculation as order creation. See [CONFIGURATION.md](CONFIGURATION.md) for settings, defaults, precedence, and restart/build requirements.

The explicit `pnpm auth:reset-dev-admin` command requires `NODE_ENV=development`. It resets the configured administrator's password without changing its profile or role and refuses an account with a non-admin role. Follow the [README recovery steps](../../README.md#recover-an-existing-development-administrator) to repair an administrator created from the older template. This command does not implement a user-facing password-reset workflow.

## Current implementation details

- The API client handles failed requests, timeouts, malformed responses, and expired sessions. Session ownership and synchronization are described above.
- Tracking resolves an order identifier over REST and subscribes using the canonical database ID. Each socket connection rejoins the order room and reconciles missed updates. Cancellation and GPS events update the same order cache.
- Status advancement and cancellation condition database writes on the previously read status and return the updated document with `returnDocument: 'after'`. A stale request returns a conflict before an audit entry is created. Audit records are still separate writes; cross-document atomicity remains a gap. Telemetry updates exclude delivered/cancelled orders, and the UI removes their simulator.
- `shared/src/catalog.ts` supplies the menu to both applications. The backend derives prices and names from this catalog. Cart, checkout, and API share cent-based rounding in `calculatePricing` with explicit fee/tax settings.
- Public registration only creates customers. Cancellation requires an administrator over REST and Socket.io. Production does not seed default staff accounts, and the API requires an explicit `JWT_SECRET`.
- Native dialogs provide focus containment, Escape dismissal, and background scroll locking. Staff and tracking components load when opened.
- The shared package emits ESM JavaScript, declarations, and source maps to `shared/dist` through [tsconfig.build.json](../../shared/tsconfig.build.json). Production exports resolve to `dist/index.js`; typechecking resolves source types. Frontend development and the backend's `tsx --conditions=development` runner use source exports. Root Vitest aliases the package to source, so tests do not require or accidentally execute a stale build. Build all packages before running the compiled backend.
- Vite+ is installed, while the current scripts invoke Vite, Vitest, TypeScript, Oxlint, and Oxfmt directly. A completed Vite+ migration is not claimed.

Read [CODEBASE_REVIEW.md](CODEBASE_REVIEW.md) before using this development application with real customer data. It records guest privacy, audit persistence, deployment, and courier assignment gaps.

## Dependency maintenance

Shared request contracts, environment settings, and client forms use Zod 4. Email normalization precedes format validation, and the HTTP pipe translates Zod `issues` into the existing `{ field, message }` error list. This preserves inline error handling across the API boundary. Motion 14 renders the existing native React motion elements.

The [dependency audit](DEPENDENCIES.md) lists the registry-verified versions and migration notes. `pnpm deps:check` compares all four manifests and installed package versions against npm. The lockfile records exact installations, including indirect dependencies within their owning packages' supported ranges. Vite+ remains installed alongside standalone root tools; its core-alias peer warning is documented in the audit.

## Package compatibility follow-up

Motion 14 uses a root `MotionConfig` with `reducedMotion="user"`; courier position updates also use `useReducedMotion` because left/top animations are outside that automatic transform policy. Router search validation consumes native Zod 4 schemas with explicit defaults and fallback values. Node types follow the Node 24 LTS runtime declared in the root `engines.node`. See [the package compatibility review](DEPENDENCIES.md#official-documentation-compatibility-review) for official sources and verification.
