---
name: nestjs-fastify-production-api
description: Build a type-safe NestJS API with the Fastify adapter, runtime-validated contracts, atomic persistence, bounded resources, production hosting and operational health checks.
---

# NestJS/Fastify production API

Use this when building a NestJS/Fastify service or adapting its architectural boundaries to another backend. Inspect installed versions, module mode, database topology and deployment constraints. [The source map](references/kitchentodoor.md) records the implementation.

## Application structure and types

- Group modules by business capability: auth, users, profiles/reviews, orders, documents and operations. Controllers validate/authorize transport input; services enforce business rules; persistence modules own schemas/indexes. Keep pricing/status rules in shared contracts when client and server need them.
- Use `NestFactory.create<NestFastifyApplication>` with a compatible Fastify adapter. Register Fastify plugins with their Fastify APIs. Runtime Express middleware/request types are inappropriate for this adapter even if Express exists in a benchmark dependency.
- Under tsx without decorator metadata, every constructor dependency needs an explicit token: `@Inject(Service)`, `@InjectModel(Entity.name)` or `@InjectConnection()`. Preserve the receiving runtime's actual decorator/transpilation requirements.
- Share runtime schemas and derive DTOs with `z.infer` or the host's equivalent. Parse path/query/body and WebSocket inputs as `unknown`; parse public response/config boundaries too. Use strict objects for security-sensitive allowlists and return explicit response projections instead of raw database documents.
- Preserve strict TypeScript, unchecked-index protection, exported contract types and correct ESM/Bundler module modes. Backend NodeNext imports use compiled `.js` specifiers; development can select shared source exports while production selects compiled output. Build shared contracts before dependent packages.

## Request and persistence workflow

1. Validate environment at startup, with actionable setting names and no secret values. Keep safe public config on an allowlisted endpoint; never serialize the whole process environment.
2. Register authentication/role guards and apply resource ownership/assignment rules inside services. Use bounded HTTP payloads, rate windows, proxy trust and socket budgets. Derive client IP from the socket peer unless the immediate proxy is explicitly trusted.
3. Use conditional atomic updates with expected status/revision/access predicates for shared state. Combine the state mutation and its audit entry in one write where possible; return a conflict when the condition fails. Avoid read-modify-`save()` races.
4. For retried creation, scope an idempotency key by actor and operation and enforce a unique index. A transport retry reuses that key; a lost response must not create a duplicate order/payment/job. Payment itself is not implemented in the reference project.
5. Use bounded queries, supported filter allowlists, deterministic sort and appropriate indexes. Calculate authoritative totals from canonical server data and preserve saved snapshots.
6. Disable buffering through database outages, bound connection/selection/pool wait/socket/write times, and choose write durability intentionally. Use transactions/shared coordination for multi-document invariants when deploying multiple processes. An in-process mutex does not coordinate replicas.
7. Map database/transient failures to consistent safe HTTP errors, preserving retryability. Keep unknown internal errors and stack traces out of public responses. A failed post-commit socket notification must not report that an already-saved mutation failed; clients reconcile from storage.

## Hosting and operations

Use Helmet/CSP, deliberate CORS/credential settings, no-store for private API responses and TLS at the hosting boundary. Serve static/SPA fallbacks only for intended frontend paths: unknown `/api` or missing assets remain 404. Cache fingerprinted static assets immutably while keeping HTML/initialization current. Preserve compiled shared code, frontend assets, document fonts and locale files in the deployment artifact.

Provide process liveness separately from bounded database readiness; return 503 when not ready. Restrict metrics/operational details to authorized operators. Add graceful shutdown, process supervision, monitoring, backups and restore drills in the receiving deployment. “Production” is a set of verified operational properties; package choices alone do not establish it.

The source serves one API process. Before horizontal scaling, introduce shared rate storage, suitable database transactions/coordination, socket fanout/affinity and distributed revocation checks. For guaranteed mail/events, add a durable outbox/queue with bounded retries; the reference asynchronous mail/live events do not provide guaranteed replay.

## Environment map

KitchenToDoor defaults are shown. Keep all of these server-only; use the receiving project's validated names instead when appropriate.

| Area | Variables and defaults |
| --- | --- |
| Runtime | `NODE_ENV=development`, `API_HOST=0.0.0.0`, `PORT=5000` |
| Database | `MONGODB_URI` required for the chosen database; local source example `mongodb://localhost:27017/kitchentodoor_db` |
| DB timeouts/pool | `MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000`, `MONGODB_SOCKET_TIMEOUT_MS=10000`, `MONGODB_WAIT_QUEUE_TIMEOUT_MS=5000`, `MONGODB_WRITE_TIMEOUT_MS=5000`, `MONGODB_MAX_POOL_SIZE=100` |
| DB startup/recovery | `MONGODB_RETRY_ATTEMPTS=1`, `MONGODB_RETRY_DELAY_MS=3000`, `MONGODB_HEARTBEAT_FREQUENCY_MS=10000` |
| Auth prerequisite | Generated `JWT_SECRET`, `JWT_EXPIRES_IN=15m`, `AUTH_SESSION_TTL_MS=604800000`, `AUTH_REFRESH_HISTORY_MAX=1000`, `PASSWORD_HASH_ROUNDS=12` |
| Origins/cookies | `FRONTEND_URL` exact allowlist, canonical `PUBLIC_APP_URL`, HTTPS `AUTH_COOKIE_SECURE=true`; local HTTP example false |
| Request bounds | `HTTP_BODY_LIMIT_BYTES=4100000`, `RATE_LIMIT_TTL_MS=60000`, `RATE_LIMIT_MAX=120` |
| Auth limits | `LOGIN_RATE_LIMIT_TTL_MS=60000`, `LOGIN_RATE_LIMIT_MAX=10`, `REGISTER_RATE_LIMIT_TTL_MS=60000`, `REGISTER_RATE_LIMIT_MAX=5`, `REFRESH_RATE_LIMIT_MAX=30`, `RESET_RATE_LIMIT_MAX=5` |
| Hosting | `SERVE_FRONTEND=false` locally; production true when serving built SPA; `STATIC_ASSET_MAX_AGE_SECONDS=3600`, `STATIC_HASHED_MAX_AGE_SECONDS=31536000` |
| Proxy/health/DNS | `TRUSTED_PROXY_IPS=` empty by default, `HEALTHCHECK_TIMEOUT_MS=1000`, optional `DNS_SERVERS=` |
| First production admin | One-time `BOOTSTRAP_ADMIN_EMAIL`, private `BOOTSTRAP_ADMIN_PASSWORD`; remove after provisioning |
| Development staff only | `ADMIN_DEFAULT_EMAIL`, `ADMIN_DEFAULT_PASSWORD`, `COURIER_DEFAULT_EMAIL`, `COURIER_DEFAULT_PASSWORD` for missing local staff; never seed public samples in production |
| Production account mail | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` required together; `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true`, `SMTP_FROM_NAME` host brand, `SMTP_CONNECTION_TIMEOUT_MS=10000`, `SMTP_SOCKET_TIMEOUT_MS=15000` |
| Account challenges | `AUTH_OTP_TTL_SECONDS=600`, `AUTH_OTP_RESEND_SECONDS=60`, `AUTH_OTP_MAX_ATTEMPTS=5`, `AUTH_TRUSTED_DEVICES_MAX=20`, `OTP_REQUEST_RATE_LIMIT_MAX=5`, `OTP_VERIFY_RATE_LIMIT_MAX=10` |

Feature-specific profile/receipt/socket/list settings should be added only when implementing those features, with validated defaults and bounds. KitchenToDoor's full original inventory is `.env.example` and `documentation/docs/CONFIGURATION.md`; a copied skill is not a replacement application configuration file. A non-Node backend can preserve modules/contracts, transactions, bounded IO and health behavior using its native tools.

## Acceptance criteria

Run isolated HTTP tests against the actual Fastify adapter; verify validation/field errors, role/resource isolation, atomic contention/idempotency and safe failure responses. Stop/restart the test database and check readiness/recovery without losing acknowledged writes or valid refresh cookies. Build and start the compiled artifact with its real assets. Test direct frontend URLs, missing API/assets, cache/security headers and shutdown. Validate multi-instance invariants before claiming support for multiple replicas.
