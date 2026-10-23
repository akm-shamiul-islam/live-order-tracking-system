# KitchenToDoor backend source map

| Repository-relative source | Responsibility |
| --- | --- |
| `backend/src/bootstrap.ts`, `backend/src/main.ts`, `backend/src/app.module.ts` | Fastify app, plugin/security setup, configured modules and startup |
| `backend/src/config/runtime-settings.ts` | Runtime schema, bounds, cross-setting constraints and safe validation |
| `backend/src/common/pipes/zod-validation.pipe.ts`, `backend/src/common/api-response.interceptor.ts` | Runtime request parsing and private HTTP cache policy; the interceptor adds no-store, not response-schema validation |
| `backend/src/common/database-exception.filter.ts` | Safe database outage/error mapping |
| `backend/src/common/frontend-hosting.ts` | Built SPA/static paths, compression, CSP initializer hash and caching |
| `backend/src/common/client-address.ts`, `backend/src/common/rate-limit.ts`, `backend/src/common/socket-adapter.ts` | Explicit proxy trust and bounded HTTP/socket entry points |
| `backend/src/orders/orders.service.ts` | Status/audit atomic writes, owner/assignment checks and checkout idempotency |
| `backend/src/common/account-access-coordinator.ts` | Process-local cross-resource coordination |
| `backend/src/operations/operations.controller.ts`, `backend/src/operations/metrics.service.ts` | Liveness/readiness and admin-only operational metrics |
| `shared/package.json`, `shared/src/index.ts`, `tsconfig.base.json` | Source/compiled exports and strict compiler rules |
| `documentation/docs/TYPESCRIPT_GUIDE.md`, `documentation/docs/OPERATIONS.md` | Runtime/module boundaries and deployment/scaling requirements |

Reference versions: NestJS 12.2.0, Fastify 5.12.7, Mongoose 9.11.3, Node 24.x, TypeScript 7.0.2. Check the target's actual manifest/lockfile and compatible plugin versions. The reference includes an Express adapter for isolated comparisons; production runs Fastify.

The browser API parses JSON responses with shared runtime schemas, while the server uses typed/explicit response projections. `RuntimeSettingsSchema` covers runtime knobs and cross-setting constraints; `JWT_SECRET`, MongoDB URI and Origin allowlists have separate readers, so this schema alone is not complete credential/origin validation. A new backend should validate all of its required deployment settings. `main.ts` enables Nest shutdown hooks; operational supervision, cloud backups and restore drills still depend on the deployment.

Existing verification: configuration/rate/client-address/controller/service specs, `backend/src/orders/orders.integration.ts`, `profiles/profiles.integration.ts` and isolated compiled-browser checks. Actual cloud deployment, provider delivery, backups and restore exercises require their own evidence. The current repo has no committed CI workflow.
