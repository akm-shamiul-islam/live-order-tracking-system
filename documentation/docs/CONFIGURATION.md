# Environment configuration

Copy the root [.env.example](../../.env.example) to `.env`, configure MongoDB, and generate a unique `JWT_SECRET` before starting the API. Keep values containing `#` quoted. Environment files with real credentials stay out of Git.

The API reads the root `.env`, then `backend/.env` as a fallback. Existing process environment values take precedence. Zod validates runtime settings before application startup and reports invalid setting names without printing their values. Restart `pnpm dev` after changes.

The frontend reads root `.env`, `.env.local`, `.env.<mode>`, and `.env.<mode>.local` in that order; later files override earlier files, and process values take precedence. Only the explicitly allowlisted browser settings below are added to the bundle. Public browser values require a Vite restart in development and a new frontend build in production. Vite's [environment documentation](https://vite.dev/guide/env-and-mode) describes this build-time behavior.

## Server and accounts

| Setting | Default or example | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Template: `development` | Production disables default staff seeding. |
| `PORT` | `5000` | API listen port, from 1 to 65535. |
| `API_HOST` | `0.0.0.0` | API listen address. |
| `FRONTEND_PORT` | `5173` | Vite development port. Update `FRONTEND_URL` if it changes. |
| `FRONTEND_URL` | `http://localhost:5173` | Comma-separated allowed HTTP and socket origins. |
| `API_PROXY_TARGET` | Derived from `PORT` | Optional Vite development/preview API target. |
| `MONGODB_URI` | `mongodb://localhost:27017/kitchentodoor_db` | MongoDB connection string. |
| `JWT_SECRET` | Required | Access-token signing secret; no published fallback. |
| `JWT_EXPIRES_IN` | `1d` | Access-token lifetime. |
| `ADMIN_DEFAULT_EMAIL`, `ADMIN_DEFAULT_PASSWORD` | See template | Required for development administrator seeding/recovery. |
| `COURIER_DEFAULT_EMAIL`, `COURIER_DEFAULT_PASSWORD` | See template | Required for development courier seeding. |
| `PASSWORD_HASH_ROUNDS` | `12` | bcrypt work factor, integer from 10 to 15; affects new hashes. |

Development staff credentials have no hardcoded fallback in the seeder. Startup creates missing accounts and preserves existing passwords. Follow the [administrator recovery steps](../../README.md#recover-an-existing-development-administrator) to change an existing development password. `JWT_REFRESH_SECRET` and `JWT_REFRESH_EXPIRES_IN` are reserved template entries; refresh tokens are not implemented.

## HTTP limits

| Setting | Default | Purpose |
| --- | --- | --- |
| `RATE_LIMIT_MAX` | `120` | General requests allowed per IP and handler window. |
| `RATE_LIMIT_TTL_MS` | `60000` | General request window in milliseconds. |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Login requests allowed per IP and window. |
| `LOGIN_RATE_LIMIT_TTL_MS` | `60000` | Login window in milliseconds. |
| `REGISTER_RATE_LIMIT_MAX` | `5` | Registration requests allowed per IP and window. |
| `REGISTER_RATE_LIMIT_TTL_MS` | `60000` | Registration window in milliseconds. |

Limits and windows must be positive integers. Login and registration override the general settings. The UI derives retry guidance from the response's `Retry-After` header. The current limiter uses process-local storage; multiple API instances need shared storage. Socket events require their own flood protection.

Throttler configuration loads asynchronously, and per-route decorators resolve settings after environment loading, following [NestJS rate-limiting configuration](https://docs.nestjs.com/security/rate-limiting). Nest's [configuration guide](https://docs.nestjs.com/techniques/configuration) documents the startup validation hook.

## Orders and pricing

| Setting | Default | Purpose |
| --- | --- | --- |
| `ORDER_LIST_DEFAULT_LIMIT` | `50` | Default dispatch response size when `limit` is omitted. |
| `ORDER_LIST_MAX_LIMIT` | `100` | Maximum accepted dispatch response size. |
| `ORDER_HISTORY_LIMIT` | `20` | Default history size for requests without an explicit `limit`. |
| `ORDER_ESTIMATE_MINUTES` | `35` | Initial estimated delivery duration. |
| `DELIVERY_FEE` | `5` | Nonnegative delivery fee in the application's dollar currency. |
| `TAX_RATE` | `0.08` | Tax fraction from 0 to 1; `0.08` means 8%. |

Order limits and estimates must be positive integers, and the default list limit cannot exceed its maximum. `GET /api/config` exposes only `{ pricing: { deliveryFee, taxRate } }`. Cart, checkout, and server pricing use these values with the shared calculation in cents. New orders use the current server settings; stored orders retain their original pricing. Changing a fee does not change past orders.

The paginated UI defaults to 10 items and offers 25, 50, and 100. Dispatch/history send an explicit `limit`, bounded by `ORDER_LIST_MAX_LIMIT`, and `page`. To offer all four sizes, retain a maximum of at least 100. The history default no longer truncates a paginated lookup to the first 20 orders; matching totals and page metadata describe the complete result set.

## Database and DNS

| Setting | Default | Purpose |
| --- | --- | --- |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `30000` | MongoDB server selection timeout. |
| `MONGODB_RETRY_ATTEMPTS` | `9` | Nest connection retry setting; nonnegative integer. |
| `MONGODB_RETRY_DELAY_MS` | `3000` | Delay between connection retries. |
| `DNS_SERVERS` | Empty; template uses `8.8.8.8,1.1.1.1` | Optional comma-separated IPv4/IPv6 resolver addresses; empty uses system resolvers. |

Keep timeout/retry choices appropriate for the deployment. The 30-second selection default preserves time for replica-set elections; see [Mongoose connection options](https://mongoosejs.com/docs/connections.html). The optional resolver override uses Node's documented [dns.setServers](https://nodejs.org/docs/latest-v24.x/api/dns.html#dnssetserversservers) API.

## Public browser settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `VITE_REQUEST_TIMEOUT_MS` | `15000` | HTTP request timeout. |
| `VITE_QUERY_STALE_TIME_MS` | `30000` | Default cached-query freshness. |
| `VITE_QUERY_RETRY_COUNT` | `1` | Default query retries. |
| `VITE_SESSION_STALE_TIME_MS` | `60000` | Freshness of `/api/auth/me` verification; no periodic token refresh. |
| `VITE_SOCKET_ACK_TIMEOUT_MS` | `5000` | Order socket acknowledgment timeout. |
| `VITE_SOCKET_RECONNECT_ATTEMPTS` | `15` | Socket reconnection attempts. |
| `VITE_SOCKET_RECONNECT_DELAY_MS` | `1000` | Initial socket reconnection delay. |
| `VITE_HEARTBEAT_INTERVAL_MS` | `4000` | Connection badge heartbeat interval. |
| `VITE_HEARTBEAT_TIMEOUT_MS` | `3000` | Heartbeat acknowledgment timeout. |
| `VITE_SIMULATION_INTERVAL_MS` | `600` | Demonstration courier update interval. |
| `VITE_SIMULATION_STEP_PERCENT` | `5` | Progress per simulation tick, integer from 1 to 100. |

Values must be integers. Query freshness and retry count may be zero; other browser timing/count settings must be positive. Public pricing always loads from the API rather than a separate frontend fee setting. Browser settings contain no secrets.

## Deprecation checks

Both order status updates now use `returnDocument: 'after'`. Mongoose documents the deprecated `new` and `returnOriginal` options and their replacements in its [Mongoose 9 migration guide](https://mongoosejs.com/docs/migrating_to_9.html#new-and-returnoriginal-options-deprecated).

The audit also replaced deprecated React `FormEvent` types with `SubmitEvent` and TanStack Query `fetchQuery` with `query`, matching the installed declarations and primary sources: [React type definitions](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react/index.d.ts) and [QueryClient source](https://github.com/TanStack/query/blob/main/packages/query-core/src/queryClient.ts). Vite config imports use explicit TypeScript extensions for its [native config loader](https://vite.dev/config/).

The type-aware [Oxlint no-deprecated rule](https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-deprecated.html) is an error in workspace lint and staged-file checks. It catches APIs annotated as deprecated; it does not replace runtime checks or dependency migration reviews.
