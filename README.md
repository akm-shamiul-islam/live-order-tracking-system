# 🍳 KitchenToDoor: Real-Time Order & Telemetry Platform

> Fresh from the kitchen, tracked to your door.

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

## Overview

KitchenToDoor connects customer ordering, kitchen dispatch and courier delivery in one application.

- **Customer accounts:** register as a normal user, order from 27 dishes in seven categories, and view only your own order history and tracking.
- **Admin workspace:** manage all dispatch orders, review delivery requests, assign couriers, and edit names, emails, phone numbers, roles and account access from Users.
- **Courier workspace:** request an available delivery, wait for admin approval, then manage assigned deliveries and share device GPS with consent.
- **Order updates:** sequential statuses, cancellation with a required explanation, atomic audit history and authenticated Socket.IO updates.
- **Friendly navigation:** shareable URLs, breadcrumbs, a role-aware drawer that opens by default and remembers its state, themed filters, menu page sizes of 8/16/32/60 (other lists: 10/25/50/100), responsive dark/light themes and inline Zod field errors.
- **Loading feedback:** initial/route/table skeletons and spinners for network actions. Food photos and fonts are hosted locally.
- **Shared login state:** Zustand persists the user/access token, synchronizes tabs and works with rotating HttpOnly refresh cookies. Backend checks enforce permissions.

Prices are realistic USD demonstration amounts. Ordering does not collect payment. Street geocoding, delivery zones and jurisdiction-specific tax require the chosen providers and operating location. Device GPS and optional customer current-location pins work independently of geocoding.

## Technology stack

| Area                                    | Packages / current versions                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Runtime / package manager               | Node **24.x** (verified 24.18.1), pnpm **12.14.0**                                                            |
| Language                                | TypeScript **7.0.2**                                                                                          |
| API                                     | NestJS **12.2.0**, Fastify **5.12.7**                                                                         |
| Database                                | Mongoose **9.11.2**, @nestjs/mongoose **12.0.0**                                                              |
| Realtime                                | Socket.IO / socket.io-client **4.8.4**                                                                        |
| Authentication                          | bcryptjs **3.0.3**, @nestjs/jwt **12.0.3**, passport-jwt **4.0.1**                                            |
| Security / hosting                      | @fastify/helmet **13.2.0**, @fastify/cors **11.3.1**, @fastify/static **10.1.6**, @nestjs/throttler **6.7.1** |
| Recovery mail                           | Nodemailer **10.1.7**; SMTP configuration required                                                            |
| UI                                      | React / React DOM **19.3.1**, Zustand **5.0.15**                                                              |
| Navigation / server state               | TanStack Router **1.170.45**, Query **5.104.5**                                                               |
| Styling / animation                     | Tailwind CSS + Vite plugin **4.3.3**, Motion **14.4.0**, Lucide **1.60.0**                                    |
| Build tools                             | Vite **8.3.4**, React plugin **6.1.2**; Vite+ **1.3.0** installed                                             |
| Contracts                               | Zod **4.6.7**                                                                                                 |
| Quality tools                           | Vitest **5.0.5**, Lighthouse **13.5.0**, Oxlint **1.89.0**, Oxfmt **0.74.0**                                  |
| Git gates                               | Husky **9.1.7**, lint-staged **17.6.0**                                                                       |
| Isolated integration tools              | mongodb-memory-server **11.3.0**                                                                            |

The manifests specify ranges; pnpm-lock.yaml records exact versions. `pnpm deps:check` checks every direct package against npm. Node declarations follow the supported Node 24 runtime. Current scripts invoke the standalone Vite, Vitest, TypeScript and Oxc tools. Vite+ has a known upstream alias peer warning; application builds and standalone test commands remain verified.

## Quick start

Requirements: Node 24, pnpm 12.14.0 and a reachable local MongoDB or MongoDB Atlas database.

```bash
cp .env.example .env
pnpm install
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set the generated value as JWT_SECRET in the root .env and configure MONGODB_URI. Keep passwords containing `#` quoted. Then:

```bash
pnpm dev
```

Open **http://localhost:5173**. The API defaults to port 5000. Use `pnpm dev:frontend` or `pnpm dev:backend` for one server. [Configuration](documentation/docs/CONFIGURATION.md) covers ports, exact Origin allowlists, rate limits, sessions, SMTP and public browser settings.

## Accounts and ordering

1. Open **My Account → Create an Account**. You can save an optional delivery address during registration. New accounts are normal customers; registration cannot choose admin/courier privileges.
2. Add food to the bag and continue to checkout. Sign-in preserves the cart during navigation. Checkout fills in your saved name, phone number and address. Edit any details for this delivery and click **Deliver**; these edits do not change your registered defaults. A delivery address is required. You can attach a current-location pin if you are at that address; editing the address clears the pin.
3. **My Orders** shows only orders owned by the signed-in customer. Open an order for items, totals, address, status, cancellation reason and live updates.
4. Admins see new orders in **Dispatch Station**. **Users → Edit** changes profiles and roles using a themed dropdown. Email/access changes sign the affected user out; they sign in again with their current details.
5. Couriers use **Available Deliveries → Request Delivery**. Admins approve/decline from an order's delivery controls. Once assigned, the order moves to that courier's **My Deliveries** and disappears from other available lists.
6. Admins and the assigned courier can advance each stage in order. Cancellation requires an explanation and is final. Real location sharing is available during OUT_FOR_DELIVERY and stops when the page closes or delivery finishes.

Available delivery summaries omit customer contact/address details until assignment. Tracking URLs do not bypass account permissions. Old guest orders without an account owner are retained for admin access rather than claimed by matching a phone number.

If a checkout response is lost, retry the same checkout. The app reuses its retry key so the saved order is returned without creating a duplicate. **My Orders** also shows orders that were saved before a connection interruption.

**Sign Out Everywhere** clears this device immediately and revokes existing sessions on the server. If the service cannot be reached, a warning provides a retry action. Email, role and access changes invalidate existing sessions and password reset links; request a new recovery email after such a change.

### Pages and shareable links

| URL                                 | Access / purpose                                        |
| ----------------------------------- | ------------------------------------------------------- |
| `/`                                 | Public food menu; sign-in required to place an order    |
| `/account`, `/account/register`     | Sign-in, registration and profile                       |
| `/account/forgot`, `/account/reset` | Password recovery when SMTP is enabled                  |
| `/orders`                           | Signed-in customer orders or courier assignments        |
| `/tracking/:orderId`                | Owner/admin/assigned-courier order details              |
| `/courier`                          | Courier available deliveries; admin oversight permitted |
| `/courier/:orderId`                 | Assigned-courier/admin delivery controls                |
| `/dispatch`                         | Admin dispatch station                                  |
| `/users`                            | Admin user management                                   |

Filters and pagination are stored in URLs. Direct page loads, refresh and browser Back/Forward are supported. The menu defaults to 8 items; other lists default to 10. The drawer reserves space on desktop and uses a closable overlay on mobile. Its open/closed preference survives refresh through localStorage. My Orders and Available Deliveries use the full available content width.

### Local staff login

Development creates missing staff from the quoted ADMIN_DEFAULT_* and COURIER_DEFAULT_* values in .env. The template uses:

- Admin: `admin@kitchentodoor.io` / `KitchenAdmin#2026!Secure`
- Courier: `courier@kitchentodoor.io` / `Courier#2026!Speed`

Changing environment values does not reset an existing account's password. Use your database account's credentials if they differ. Production does not seed these public samples.

### Recover an existing development administrator

Verify the configured email/password and NODE_ENV=development, then explicitly run:

```bash
pnpm auth:reset-dev-admin
```

This updates only the existing configured admin, preserves its role/profile and invalidates its sessions. It refuses production and never promotes a customer.

For service errors, run both servers and check MongoDB readiness. For rate limits, follow the displayed retry interval. Known Vite proxy restart errors now provide one actionable warning and recover when the API returns; check PORT/API_PROXY_TARGET if the API remains unavailable.

## Production use

```bash
pnpm build
pnpm --filter @kitchentodoor/backend start
```

Configure production settings before starting: NODE_ENV=production, SERVE_FRONTEND=true, a real database, JWT secret, HTTPS PUBLIC_APP_URL/FRONTEND_URL and AUTH_COOKIE_SECURE=true. Fastify serves built pages, API and sockets from one origin, including compressed assets and direct page URLs.

On a fresh production database, configure separate BOOTSTRAP_ADMIN_EMAIL/PASSWORD, run `pnpm auth:bootstrap-admin` after building, then remove the bootstrap password. Existing administrators manage roles through Users. [Operations](documentation/docs/OPERATIONS.md) covers supervision, TLS/proxy configuration, backups, readiness, metrics and scaling requirements. Live hosting, payment/geocoding providers and SMTP delivery require your infrastructure configuration.

## Commands and quality gates

```bash
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:browser
pnpm audit:lighthouse
pnpm deps:check
pnpm audit
pnpm lint
```

Integration, browser and Lighthouse commands create isolated synthetic databases and stop their own processes; they do not use development orders. The first integration run may download a MongoDB binary. Browser checks require Chrome; see [quality commands](documentation/docs/QUALITY.md).

- **pre-commit:** lint/fix and format staged JS/TS files through lint-staged.
- **pre-push:** workspace typechecking and maintained source tests.

## Workspace

```text
backend/src/
  auth/          Login, sessions, recovery, guards
  users/         Admin user management
  orders/        Orders, courier requests, assignment, sockets
  database/      Schemas, seeding and operator commands
  common/        Validation, limits, hosting and error handling
  operations/    Health/readiness and admin metrics
frontend/src/
  pages/         Account, user management, courier and tracking pages
  components/    Menu, cart, forms, navigation and dispatch table
  hooks/         Auth, queries, dialogs and form helpers
  lib/           API, Zustand session, settings and sockets
  router.tsx     Typed page URLs and access layouts
shared/src/      Catalog, prices, roles, Zod and socket contracts
scripts/         Isolated browser and Lighthouse tools
```
