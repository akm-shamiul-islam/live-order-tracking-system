# Implementation and verification report

Updated 2026-10-21 (Asia/Tokyo). This report records repository implementation and local verification. [CODEBASE_REVIEW.md](CODEBASE_REVIEW.md) keeps the task completion matrix and remaining external requirements.

## Implemented workflows

- Registration creates a normal customer and accepts an optional multiline delivery address. The saved name, phone and address prefill checkout and survive login/refresh. Customers edit details for the current delivery and click Deliver; their registered defaults remain unchanged. Address edits clear attached pins and ignore pending GPS callbacks for the previous address. Login, account recovery, rotating HttpOnly refresh, revocation, tab synchronization and current-role checks are implemented. The default development login template quotes passwords containing #; explicit development admin recovery handles existing hashes.
- Customers place server-priced orders and see only their own history/tracking. Matching phone numbers or possession of a tracking link cannot bypass account authorization.
- Admin-only Users supports search, pagination and themed editing of names, emails, phone numbers, roles and access. Stale edits are rejected; sensitive changes invalidate affected sessions. Self-demotion/disable and removing a courier with active work are rejected.
- Couriers request redacted available deliveries. Admin approval atomically selects one assignment and rejects competing requests. Other couriers lose availability and private read/room access. My Deliveries contains the caller's assigned orders.
- Admins and assigned couriers advance sequential statuses. Cancellation requires a reason in a modal and preserves it in customer-visible history. Completed/cancelled orders reject further status and location writes.
- Device GPS requires courier consent and an assigned delivery in progress. Customer location pins are optional. Written addresses are retained without invented coordinates. Street geocoding/navigation is not provided by the illustrative radar.
- Follow-up review fixes invalid reset links after account changes, late sign-in/logout races, refresh-cookie loss on 503, silent sign-out failures, post-commit notification failures, duplicate checkout retries, concurrent access/assignment decisions, stale tracking updates and child-process cleanup. [The committed-baseline review](CODEBASE_REVIEW.md#review-of-the-committed-baseline) records severity, reproduction and limits.

## Navigation and presentation

TanStack Router provides copyable URLs, direct-route loading, browser history and URL filters/pagination. Role-specific navigation is an animated responsive drawer, open by default with open/closed state in localStorage. It reserves content width on desktop and uses a closable modal on mobile. Breadcrumbs provide linked parent pages and an accessible current-page marker.

Drawer navigation uses router-managed native page fades (140 ms exit, 220 ms entry), with intent preloading on hover/focus. The header and drawer remain mounted and steady. Same-page filters/live updates stay immediate, reduced motion disables animation, and unsupported browser APIs/types retain normal navigation. A follow-up browser run exposed unhandled native ready-promise rejection when rapid navigation skipped a pending snapshot. The local TypeScript commit adapter handles skipped animations while preserving actual page-update failures. Unit and real Chrome checks verify both fades, rapid account navigation and fallback paths; [ARCHITECTURE.md](ARCHITECTURE.md#page-transitions) records the API choice and navigation map.

The menu uses 8/16/32/60 items per page, default 8. Other lists retain 10/25/50/100. Order history and Available Deliveries use full available content width, including when the desktop drawer opens or closes. Dispatch has centered headers and the requested centered data columns, date above time in YYYY/MM/DD and HH:MM:SS, aligned Track/Advance actions, themed dropdown/filter/search controls and consistent icons. Zod field errors use red borders, red text below fields and focus on the first error. Loading states cover initial content, lazy routes, tables and network actions.

The shared catalog includes 27 dishes in seven categories with realistic USD demo prices and local licensed food photos. Responsive WebP, self-hosted fonts, fixed image dimensions, deferred live/animation loading and reduced-motion handling improve rendering. Contrast issues identified in the measured history, dispatch and tracking pages have been corrected. Identical profile checks no longer trigger full authenticated rerenders. Locale date formatters are reused across rows/live updates, offscreen menu cards use rendering containment, and staff controls are split from customer tracking.

## Backend consistency, resilience and security

Order creation, statuses, requests and assignment store their audit entries in the same document write. Conditional filters reject concurrent changes. Legacy logs remain readable. Random order numbers have bounded collision retries; opaque tracking IDs are hashed and still require authorization. Majority journaled writes survive the tested MongoDB restart.

Socket.IO protection bounds packets per connection/IP, tracked IPs, handshakes, concurrent connections, payload bytes and rooms. IP budgets survive reconnects. Origin validation applies to upgrades. Protected events and passive broadcasts check current account/session/assignment access. Integration tests import public socket.io-client types, without ambient shims.

Database timeouts are bounded, readiness distinguishes outages, API errors return a usable 503 and sockets can reconnect after service recovery. Refresh 503s preserve the refresh cookie. Unknown internal socket failures are sanitized and do not turn acknowledged database mutations into failed responses. Checkout retry keys enforce uniqueness within the customer account; order indexes initialize before traffic. Persisted state revisions and GPS observation times prevent stale cache updates. TRUSTED_PROXY_IPS defaults to empty; forwarding headers affect client identity only through explicitly trusted proxy addresses. Process-local access coordination and rate budgets require shared coordination/transactions and limit storage before horizontal scaling or overlapping deployments.

Fastify serves the production SPA, API and sockets, with direct-route fallback, gzip/Brotli, immutable hashed assets, no-store API/HTML and strict CSP. Zod browser schemas use jitless mode. The early theme initializer is allowed by its exact build-derived SHA-256 hash. Initial production admin bootstrap, health/readiness and admin metrics are implemented.

## Dependencies and official documentation

The current inventory covers 59 distinct direct packages across 70 manifest declarations. React/React DOM are 19.3.1, Tailwind CSS 4.3.3, Zustand 5.0.15, TanStack Router 1.170.45, Query 5.104.5, Zod 4.6.7, Motion 14.5.0, NestJS 12.2.0, Fastify 5.12.7, Mongoose 9.11.2 and Socket.IO 4.8.4. Supported runtime is Node 24. The npm checker selects compatible Node 24 declarations; other direct packages target npm latest stable.

[DEPENDENCIES.md](DEPENDENCIES.md) records the complete inventory and official migration/API evidence. Mongoose updates use returnDocument: after, MongoDB uses journal write concern, refined Zod schemas use safeExtend, and Motion uses its current LazyMotion/react-m API. A selective Hyperid 4 override removes the vulnerable UUID dependency. The known upstream Vite+ alias peer warning remains; standalone Vite/Vitest/Oxc scripts are used.

Saved-address validation and persistence follow the current [Zod string/default APIs](https://zod.dev/api), [Mongoose string schema options](https://mongoosejs.com/docs/schematypes.html#string) and [HTML address autofill guidance](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill). Shared address validation counts UTF-16 units for the maximum to match browser and database limits, including surrogate pairs.

## Verification evidence

All nine remaining handwritten JavaScript files were converted to TypeScript: browser/Lighthouse/dependency tools, fixture processes, asset compression and the early theme initializer. Native Node type stripping runs the tools; strict compiler checks cover their options, IPC and browser protocol contracts. `pnpm source:check` rejects maintained JavaScript files, and `pnpm typecheck` includes that policy plus workspace/tooling checks. The theme source compiles through Vite's current Oxc transform while retaining the exact build-derived CSP hash. [Architecture](ARCHITECTURE.md#typescript-source-and-tooling) records source/runtime boundaries.

| Check | Result |
| --- | --- |
| Workspace/tooling typecheck | Passed, including orders.integration.ts socket types and the TypeScript source gate |
| Production build | Passed; compressed frontend assets and runnable backend/shared exports |
| Source tests | 210 passed across 21 files |
| MongoDB/HTTP/socket integration | 25 passed against isolated MongoDB |
| Browser workflows | 14 scenarios passed; [saved summary](../quality/browser-2026-10-21.json) |
| Lighthouse | [Eight-case summary](../quality/lighthouse-2026-10-21.json), [registration/courier follow-up](../quality/lighthouse-registration-courier-2026-10-21.json) and [TypeScript/theme follow-up](../quality/lighthouse-typescript-2026-10-21.json); see QUALITY.md |
| Registry/security/lint gates | 59 direct packages / 70 declarations current; 0 known advisories; lint 0 errors, 127 warnings |

[QUALITY.md](QUALITY.md) explains commands, isolation, measurement settings and limitations. Test databases, synthetic accounts, browser profiles, proxy ports and API processes are separate from existing development services. Run resource-heavy checks sequentially; concurrent runners caused local fixture timeouts and were rerun independently.

## Remaining work requiring external choices

Payments/refunds, operating-country taxes/currency, geocoding/zones, real SMTP delivery and production deployment need provider/location/domain choices and credentials. The repository includes mail integration and an operations runbook, but does not claim a deployed sender, cloud backups, production restore drills, configured alert destinations or TLS verification. Shared rate budgets/socket fanout and representative production load tests are required before multiple instances.

Automated Lighthouse/browser checks do not prove zero accessibility/security defects or production capacity. See [OPERATIONS.md](OPERATIONS.md) for deployment, backup, monitoring and scaling steps.
