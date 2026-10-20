# 🍳 KitchenToDoor: Real-Time Order & Telemetry Platform

> **Fresh from the Kitchen, Tracked to Your Door.**  
> Full-stack development application built with NestJS (Fastify), MongoDB Mongoose, Socket.io, React 19, Zustand 5, TanStack Router, Vite 8, Tailwind CSS v4, Motion, and automated Git verification gates.

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-v24.18.1-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/pnpm-v12.14.0-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/TypeScript-v7.0.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NestJS-v12.2.0-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Fastify-v5.12.7-000000?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose_v9.11.2-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Socket.io-v4.8.4-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/React-v19.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Zustand-v5.0.15-443E38?style=for-the-badge" alt="Zustand" />
  <img src="https://img.shields.io/badge/Vite-v8.3.4_(Rolldown)-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4.3.3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Motion-v14.4.0-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Motion" />
  <img src="https://img.shields.io/badge/Vitest-v5.0.5-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/Zod-v4.6.7-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" />
  <img src="https://img.shields.io/badge/Oxlint-v1.89.0-DEA584?style=for-the-badge&logo=rust&logoColor=white" alt="Oxlint" />
  <img src="https://img.shields.io/badge/Husky-v9.1.7-F05032?style=for-the-badge&logo=git&logoColor=white" alt="Husky" />
</p>

---

## 🌟 Overview & Key Features

**KitchenToDoor** supports guest food orders, live order updates, staff dispatch, and simulated courier movement.

- ⚡ **High-Throughput Fastify Engine:** Powered by NestJS + Fastify (`@nestjs/platform-fastify`), serving HTTP and Socket.io requests. Comparative throughput has not been benchmarked.
- 🛰️ **Live Telemetry & Radar Simulation:** Dynamic radar showing simulated courier movement with real-time GPS coordinate broadcasting.
- 🔒 **Authentication & RBAC:** Password hashing (`bcryptjs`, configurable work factor, default 12), JWT validation during WebSocket handshakes, and **`WsJwtGuard`** plus role checks for protected socket events.
- 🔑 **Shared Login State:** Zustand keeps navigation, dialogs, and staff views in sync, restores saved sessions after refresh, and synchronizes sign-in and sign-out across tabs on the same origin.
- 🔗 **Shareable Pages:** TanStack Router gives every navigation page its own URL, including individual tracking and courier views, with refresh and browser Back/Forward support.
- ✅ **Inline Form Validation:** Zod validates sign-in, checkout, phone lookups, and tracking searches. Invalid fields show red borders and messages beneath the input, with focus moved to the first error on submission.
- 🛡️ **Automated Quality Gates (Husky + lint-staged):**
  - `pre-commit`: Instant linting and formatting on staged files with `oxlint` and `oxfmt`.
  - `pre-push`: Automated typechecking (`pnpm typecheck`) and Vitest test runner (`pnpm test`) to check configured static and test gates before a push.
- 🌓 **Adaptive Dark & Light Mode:** Responsive navbar with a toggle switch and persistent theme preference.
- 📱 **Responsive UI:** A collapsible left navigation drawer, responsive cards, themed dropdowns, and accessible form controls. Desktop navigation reserves content space; mobile navigation opens as a modal drawer.
- 📄 **Paginated Lists:** Menu, dispatch, and history support 10/25/50/100 items per page. Dispatch and history paginate database results with total counts.
- 📦 **One-Command Monorepo:** Orchestrated with `pnpm` workspaces—run both frontend and backend dev servers simultaneously with `pnpm dev`.

---

## 🛠️ Technology Stack & Role Matrix

Package manifests define dependency versions and ranges; the lockfile records exact installed versions. The `^` prefix allows compatible newer releases. Run `pnpm deps:check` to compare declared and installed package versions with npm.

| Category               | Technology                                  | Target Version                  | Role & Justification / Project Usage Notes                                                                              |
| :--------------------- | :------------------------------------------ | :------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| **Runtime**            | `Node.js`                                   | `v24.x`                         | Modern JavaScript runtime offering top V8 performance, native fetch, and ES module support.                             |
| **Package Manager**    | `pnpm`                                      | `12.x` (`v12.14.0`)             | Workspace-native package manager providing ultra-fast installation and strict dependency isolation.                     |
| **Language**           | `typescript`                                | `^7.0.2`                        | Workspace-wide strict static type safety (`strict: true`, `noUncheckedIndexedAccess: true`).                            |
| **Monorepo Tooling**   | `vite-plus` (`vp`)                          | `^1.3.0`                        | Installed; current scripts invoke Vite, Vitest, TypeScript, Oxlint, and Oxfmt directly.                                 |
| **Git Hooks**          | `husky`                                     | `^9.1.7`                        | Git hooks orchestrator managing `pre-commit` and `pre-push` automated gates.                                            |
| **Staged Linting**     | `lint-staged`                               | `^17.6.0`                       | Runs linters and formatters strictly against git staged files on commit.                                                |
| **Linter**             | `oxlint`                                    | `^1.89.0`                       | Rust-based linter executing ~50x faster than traditional ESLint, enforcing React and TypeScript correctness.            |
| **Formatter**          | `oxfmt`                                     | `^0.74.0`                       | Rust-powered formatter ensuring Prettier compatibility, automatic Tailwind class sorting, and import sorting.           |
| **Shared Package**     | TypeScript                                  | `^7.0.2`                        | Shared Zod contracts, catalog, and pricing; builds ESM JavaScript and declarations into `shared/dist`.                  |
| **Backend Framework**  | `NestJS` (`@nestjs/core`)                   | `^12.2.0`                       | Enterprise architecture featuring modular dependency injection, decorators, and clean domain separation.                |
| **HTTP Engine**        | `@nestjs/platform-fastify`                  | `^12.2.0`                       | High-performance Fastify adapter selected over Express for superior throughput and lower latency.                       |
| **Real-Time Engine**   | `socket.io` / `@nestjs/platform-socket.io`  | `^4.8.4` / `^12.2.0`            | WebSocket engine managing room subscriptions (`order_<id>`, `admins`), bi-directional telemetry, and acknowledgments.   |
| **Database & ODM**     | `mongoose` / `@nestjs/mongoose`             | `^9.11.2` / `^12.0.0`           | Production MongoDB document database with typed Mongoose schemas, indices, and audit logging.                           |
| **Authentication**     | `bcryptjs` + `@nestjs/jwt` + `passport-jwt` | `^3.0.3` / `^12.0.3` / `^4.0.1` | Replaces insecure plaintext auth with salted bcrypt password hashing and cryptographically signed JWTs.                 |
| **WebSocket Guard**    | Custom `WsJwtGuard`                         | Internal                        | Revalidates JWTs for protected socket events; the gateway verifies handshake tokens and joins staff rooms by role.      |
| **API Security**       | `@fastify/helmet` + `@fastify/cors`         | `^13.2.0` / `^11.3.1`           | Native Fastify security plugins enforcing HTTP response headers and strict CORS origin whitelisting.                    |
| **Rate Limiter**       | `@nestjs/throttler`                         | `^6.7.1`                        | Limits HTTP traffic, with stricter login and registration limits. Socket flood protection is a remaining gap.           |
| **Frontend Toolchain** | `vite`                                      | `^8.3.4`                        | Development server and production bundler; build times depend on the project and machine.                               |
| **Frontend Framework** | `React` / `React DOM`                       | `^19.3.1`                       | Modern React UI with optimized rendering, Actions, and seamless transition management.                                  |
| **Client Auth State**  | `zustand`                                   | `5.0.15` (pinned)               | Shared user/token store, selective `useAuth` subscriptions, refresh persistence, and cross-tab session synchronization. |
| **Routing**            | `@tanstack/react-router`                    | `^1.170.45`                     | Typed page routes, real navigation links, individual order URLs, browser history, and a staff access layout.            |
| **Server State**       | `@tanstack/react-query`                     | `^5.104.5`                      | Server state cache updated directly by incoming Socket.io events (`setQueryData`), eliminating refetch round-trips.     |
| **Styling**            | `tailwindcss` + `@tailwindcss/vite`         | `^4.3.3`                        | Utility-first CSS framework using native CSS cascade layers and customized dark/light mode tokens.                      |
| **Animations**         | `motion` (`motion/react`)                   | `^14.4.0`                       | Rebranded Framer Motion library powering smooth route transitions, glowing order steppers, and telemetry radar.         |
| **Icons & UI**         | `lucide-react` + `clsx` + `tailwind-merge`  | `^1.60.0` / `^2.1.1` / `^3.7.0` | Accessible Feather-style SVG icons and clean conditional class merging.                                                 |
| **Testing**            | `vitest`                                    | `^5.0.5`                        | Runs unit and HTTP regression tests across the workspace packages.                                                      |

---

## 📁 Monorepo Workspace Architecture

```
kitchen-to-door/
├── .husky/
│   ├── pre-commit                          # Runs pnpm exec lint-staged (oxlint + oxfmt)
│   └── pre-push                            # Runs pnpm typecheck && pnpm test
├── backend/                                # @kitchentodoor/backend (NestJS Fastify + Mongoose + Socket.io)
│   ├── src/
│   │   ├── auth/                           # JWT Auth, Bcrypt, Guards, Strategies
│   │   ├── common/pipes/                   # ZodValidationPipe for strict request validation
│   │   ├── database/                       # Mongoose schemas, staff seeding, development admin recovery
│   │   ├── orders/                         # Orders Controller, Service, & WebSocket Gateway
│   │   ├── app.module.ts
│   │   └── main.ts                         # Fastify bootstrap with Helmet & CORS
│   ├── package.json
│   └── tsconfig.json
├── frontend/                               # @kitchentodoor/frontend (React 19 + Zustand + Tailwind CSS v4 + Motion)
│   ├── src/
│   │   ├── components/                     # Navbar, Stepper, Radar, Cart, Admin tables
│   │   │   ├── auth/AuthSessionSync.tsx     # Root session verification, tab sync, and socket identity
│   │   │   └── forms/FieldError.tsx         # Accessible inline validation messages
│   │   ├── hooks/                          # useOrderSocket, useTheme, useAuth, useZodForm
│   │   ├── lib/                            # api.ts, socket.ts, queryClient.ts
│   │   │   └── authSession.ts              # Zustand store and compatible localStorage persistence
│   │   ├── pages/                          # Menu and tracking/courier route content
│   │   ├── router.tsx                      # Typed route tree, lazy page loading, error boundaries
│   │   ├── App.tsx                         # Shared route layout, cart, checkout, and staff dialog
│   │   ├── index.css                       # Tailwind v4 theme tokens
│   │   └── main.tsx                        # QueryClientProvider, AuthSessionSync, and RouterProvider
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── shared/                                 # @kitchentodoor/shared (Shared Zod Schemas & Contracts)
│   ├── src/
│   │   ├── schemas/                        # Zod validation schemas (Auth, Order, Telemetry)
│   │   ├── enums.ts                        # OrderStatus sequence & transition state machine
│   │   └── socket-events.ts                # Typed Socket.io event interfaces
│   ├── package.json
│   └── tsconfig.json
├── documentation/
│   └── docs/                               # Technical architecture & configuration guides
├── .env.example                            # Environment template; generate your own JWT secret
├── .oxlintrc.json                          # Workspace Oxlint configuration
├── .oxfmtrc.json                           # Workspace Oxfmt configuration
├── pnpm-workspace.yaml                     # Monorepo workspace configuration
└── package.json                            # Workspace root scripts
```

---

## ⚡ Quick Start & Development

### 1. Prerequisites

- **Node.js**: `v24.x`
- **PNPM**: `pnpm` (`v12.14.0`, pinned in `package.json`)
- **MongoDB**: A running local MongoDB instance or a free MongoDB Atlas cluster connection string.

### 2. Environment Configuration

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Generate a unique secret and set `JWT_SECRET` in `.env` before starting the API:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set `MONGODB_URI` to a reachable database. `FRONTEND_URL` accepts a comma-separated list of allowed origins. Development and preview proxies use `PORT`, or `API_PROXY_TARGET` when supplied.

The API loads the root `.env` before the `backend/.env` fallback, regardless of the command's working directory. Existing process environment variables take precedence over both files. Keep passwords quoted so dotenv preserves `#` characters; see [Login and local development](#login-and-local-development).

Rate limits, order limits, delivery fees, tax, password hashing, database retries, DNS, and browser timeouts are configurable in `.env`. Zod rejects invalid settings at startup. See the [configuration guide](documentation/docs/CONFIGURATION.md) for every setting and its default. Restart `pnpm dev` after environment changes; rebuild production frontend assets when changing `VITE_*` values. Cart and checkout load public pricing from `/api/config`.

### 3. Install Dependencies & Initialize Git Hooks

```bash
pnpm install
```

_(This automatically runs `husky` to activate the `pre-commit` and `pre-push` hooks)_

### 4. Run Both Backend & Frontend with One Command

```bash
# Starts backend/ (port 5000) and frontend/ (port 5173):
pnpm dev
```

---

## Login and local development

Open `http://localhost:5173` and choose **Staff Sign In** for dispatch or courier tools. Use the account configured in your environment. The defaults in [.env.example](.env.example) are:

```dotenv
ADMIN_DEFAULT_EMAIL=admin@kitchentodoor.io
ADMIN_DEFAULT_PASSWORD="KitchenAdmin#2026!Secure"
COURIER_DEFAULT_EMAIL=courier@kitchentodoor.io
COURIER_DEFAULT_PASSWORD="Courier#2026!Speed"
```

The quotes belong in the environment file; enter the password without surrounding quotes when signing in. An unquoted `#` starts a dotenv comment and truncates the password.

Development startup creates missing staff accounts. Changing environment values does not reset an existing password. Production startup does not seed staff accounts, and the sign-in dialog does not display hardcoded credentials.

### Recover an existing development administrator

If the administrator was created with an earlier unquoted password, correcting `.env` alone leaves the old password hash in MongoDB. Set `NODE_ENV=development`, confirm the full quoted `ADMIN_DEFAULT_PASSWORD` and intended `MONGODB_URI`, then run from the workspace root with MongoDB available:

```bash
pnpm auth:reset-dev-admin
```

The command resets the configured administrator's password and preserves its profile and role. It refuses non-development environments and accounts with a non-admin role. Normal startup never resets an existing password. Restart the API after changing environment values, then sign in with the full configured password.

### Login troubleshooting

- **Invalid email or password:** use the credentials belonging to the existing database account. Email whitespace and capitalization are normalized; passwords remain case sensitive. For an older development admin, follow the recovery steps above.
- **Service unavailable:** start both servers with `pnpm dev` and check the API terminal for database connection errors.
- **Missing `JWT_SECRET`:** generate a secret as described above, add it to the root `.env`, and restart the API.
- **Too many attempts:** wait for the interval shown in the message, based on the API's `Retry-After` header. Defaults are 10 login requests and 5 registration requests per minute per IP; each limit and window is configurable.
- **Session expired:** sign in again. A 401 for the current authenticated session clears it and reconnects the socket as a guest. Refresh tokens are not implemented.

Backend constructors use explicit NestJS injection tokens because the `tsx` development runner does not emit `design:paramtypes`. Keep those annotations when adding controllers, services, and guards.

## Shared login state with Zustand

[Zustand 5.0.15](frontend/package.json) owns the frontend's shared `user` and `token`. Components read that state through [useAuth](frontend/src/hooks/useAuth.ts); login, registration, and logout update the same store, so navigation and staff views update immediately.

- **Persistence:** [authSession.ts](frontend/src/lib/authSession.ts) uses the existing `ktd_token` and `ktd_user` localStorage keys, preserving compatibility with saved sessions. Malformed user data or an incomplete stored pair starts a guest session. If storage is blocked, login still works in memory; refresh persistence and tab synchronization require working storage.
- **Session synchronization:** One [AuthSessionSync](frontend/src/components/auth/AuthSessionSync.tsx) mounted inside `QueryClientProvider` listens for other tabs' storage changes, requests `/api/auth/me` when a token is available, and updates socket authentication. Logout also removes staff and session-verification query data.
- **State responsibilities:** TanStack Query owns order data and the session-verification cache. TanStack Router owns the current page and selected order URL. Cart contents, dialogs, and form drafts remain local React state in the shared layout or page.
- **Authorization:** Backend JWT and role guards enforce access. Client role flags control the UI. Sign-out clears this browser's saved session and synchronizes open tabs on the same origin; server-side token revocation and automatic token refresh are not implemented.

## Shared package builds

`pnpm build` emits the shared package before building its consumers. Production imports use compiled ESM from `shared/dist`; development uses source exports through the `development` condition. Root source tests use an explicit alias and do not depend on a previous build. To run the compiled API after building, use `pnpm --filter @kitchentodoor/backend start`.

## Pages and shareable links

| Page                           | URL                                               | Access                |
| ------------------------------ | ------------------------------------------------- | --------------------- |
| Order Food                     | `/`                                               | Public                |
| Live Tracking search           | `/tracking`                                       | Public                |
| Track an order                 | `/tracking/KTD-1234` or `/tracking/<database-id>` | Public guest tracking |
| My Orders                      | `/orders`                                         | Public phone lookup   |
| Dispatch Station               | `/dispatch`                                       | Admin or courier      |
| Courier Telemetry search       | `/courier`                                        | Admin or courier      |
| Courier telemetry for an order | `/courier/<order-number-or-database-id>`          | Admin or courier      |

Navigation, dispatch Track actions, and order-history tracking actions use actual links. Copy the address bar URL to reopen a page in another tab or after a refresh. Checkout opens the new order's tracking URL. Staff pages retain the requested URL while showing a sign-in gate; signing in continues on that page.

Vite development and preview serve direct page URLs. Production hosting must rewrite frontend routes to `index.html` while forwarding `/api` and `/socket.io` to the backend.

## Navigation and list controls

Use the header's hamburger button to open navigation. On desktop, the drawer slides in from the left and reserves 288px; closing it restores the content width. On mobile it opens over the page, contains keyboard focus, and closes with its close button, Escape, a backdrop click, or a page link. Motion follows the reduced-motion preference.

Dispatch has a themed status dropdown and **Filter** button on the left, plus an icon-aligned search field and **Search** button on the right. Selecting a status or editing a search leaves the current results unchanged until its action button is pressed. Search matches order numbers, customer names, and phones across database results.

Menu, dispatch, and history provide item-size selection, result ranges, page controls, and disabled boundary buttons. Filters and page-size changes reset the page. Examples of shareable list state are `/?category=burgers&size=25` and `/dispatch?status=PLACED&q=KTD&page=2&size=25`. History keeps phone numbers out of the URL. Browser history restores list settings; invalid URL values normalize to defaults.

Paged order requests use `page` and `limit`; dispatch also accepts `search` and `status`. Responses include `pagination: { page, pageSize, total, totalPages }`, and out-of-range pages clamp to the last available page. The configured `ORDER_LIST_MAX_LIMIT` applies. Requests without `page` retain their existing defaults for compatibility.

## Form errors and dispatch behavior

Sign-in, checkout, history, and tracking forms use shared Zod schemas through `useZodForm`. Validation runs on blur and submission, and invalid fields are rechecked while edited. Each invalid input has `aria-invalid`, a red border, and a linked red error message beneath it. Submission focuses the first invalid field. General network or service failures remain form-level messages; server validation retains field paths so errors can appear beside the relevant input.

All dispatch table headers are centered. Order #, Total, Current Status, Created, and Actions cells are centered; customer and item details remain left aligned. Created shows `YYYY/MM/DD` above the 24-hour time `HH:MM:SS`, using the browser's local time zone. Track and Advance share a centered flex action row and an equal 32px height. Status updates and cancellations use a conditional database write, so a competing dispatcher receives a conflict message instead of overwriting a newer status. Delivered and cancelled orders reject further courier telemetry, and their simulator stops.

## Git hook behavior

- **On `git commit` (`pre-commit` via `lint-staged`):**  
  Files staged for commit run through `oxlint --fix` and `oxfmt`. The type-aware `typescript/no-deprecated` rule rejects APIs marked deprecated by the installed dependency types.
- **On `git push` (`pre-push`):**  
  Executes `pnpm typecheck` (strict TypeScript 7.x) and `pnpm test` (Vitest across all packages). If any test or type check fails, the push is immediately halted, preventing broken code on GitHub.
