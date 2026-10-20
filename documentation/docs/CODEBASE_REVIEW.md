# Codebase review and login repair

Reviewed the `frontend`, `backend`, and `shared` workspace packages, the root scripts and environment template, and the architecture and implementation reports. Existing worktree changes were preserved. No deployment was performed. The follow-up section below records the explicit development credential repair.

## Login failure

The running API and Vite proxy both returned `500 Internal server error` for valid development staff credentials. The API uses `tsx watch`, which omits TypeScript `design:paramtypes` metadata. Several constructors relied on that metadata, including `AuthController`. NestJS created the controller without its authentication service, so valid login requests failed when invoking that service.

Explicit injection tokens now identify controller, gateway, and guard dependencies. HTTP regression tests remove `design:paramtypes` before building the test application, exercising the development runner's injection behavior. Tests call the actual Fastify/NestJS request pipeline with mocked persistence, rather than instantiating only the service.

The UI also kept independent authentication state in each `useAuth` call. A shared Zustand 5.0.15 session now updates navigation, dialogs, and staff views together. Logout clears the session, removes staff query data, and replaces socket authentication with a guest connection. Authenticated 401 responses clear expired sessions without allowing an older request to clear a newer login.

## Other repairs

| Area | Repair |
| --- | --- |
| Input validation | Auth endpoints use the existing Zod pipe and return 400 with field errors. Emails are trimmed and normalized. Registration enforces bcrypt's password byte limit. |
| Staff authorization | Public registration cannot select administrator or courier roles. Protected socket events execute both JWT and role guards. Cancellation requires an administrator. |
| Socket authentication | Raw and Bearer-prefixed handshake tokens work. Invalid supplied tokens are rejected. Logout and token changes reconnect with the current identity. |
| HTTP rate limiting | Async configuration and route callbacks use validated environment settings. Defaults are 10 login, 5 registration, and 120 general requests per IP/handler per minute. The UI honors Retry-After. The HTTP guard skips sockets, which need separate limits. |
| Environment | Removed the published fallback JWT secret; a configured secret is required. JWT lifetime uses `JWT_EXPIRES_IN`. Production skips default staff seeding. The hardcoded login credential hint was removed. CORS uses configured frontend origins. |
| Pricing | Menu data is shared. The API replaces client-supplied names and prices with catalog values and rejects unknown items. Cart and checkout load configured fee/tax from the public pricing endpoint; all three use the same calculation in cents. |
| Order data | MongoDB ObjectId references are normalized when grouping history and mapping response fields. Missing telemetry orders return 404. Dispatch filters and limits are validated. |
| Tracking | Subscriptions use the resolved database ID, so order-number searches receive GPS updates. Cancellation updates the cache. Socket connections rejoin rooms and reconcile missed events. Duplicate history entries are filtered. |
| Navigation | TanStack Router gives pages and selected orders their own URLs. Navbar and tracking actions use real links; refresh and browser history restore the page. A shared staff layout retains the destination while showing its sign-in prompt. |
| Form errors | Zod validates visible fields on blur/submission and rechecks invalid fields while edited. Invalid inputs have red borders and linked red messages below them. Submission focuses the first invalid field; API field paths are retained. |
| Dispatch actions | Track and Advance share a centered flex row and 32px height. All headers and the requested data columns are centered. Conditional status/cancellation writes reject concurrent changes before creating a misleading audit entry. |
| Completed deliveries | Telemetry updates exclude delivered/cancelled orders. The UI removes their simulator, stopping its timer. |
| Courier controls | Simulation timers stop on unmount; controls show failed acknowledgments and offline errors. Guest tracking does not expose courier mutation controls. |
| Error handling | Network failures, timeouts, unavailable services, and invalid responses have readable messages. Dispatch and history show failed requests instead of empty results. |
| Accessibility | Native cart, checkout, and staff dialogs support keyboard focus and Escape dismissal. Inputs have labels and autocomplete, icon buttons have accessible names, errors are announced, focus is visible, and CSS honors reduced motion. |
| Startup performance | Staff, history, dialog, and tracking components use lazy imports rather than loading every screen with the menu. |
| Development proxy | Development and preview proxy HTTP and socket requests using the configured API port or `API_PROXY_TARGET`. |
| Shared runtime | The shared build emits ESM/declarations and production exports resolve to JavaScript. Development uses source conditions, and Vitest aliases source. The built backend now starts in plain Node. |
| Documentation | Documents Zustand state ownership, persistence, session synchronization, and development credential recovery. Corrected missing-secret setup, package-manager version, unused routing claims, shared build behavior, scope of rate limiting, and unsupported production-readiness claims. |
| Test discovery | Root Vitest configuration runs maintained tests under the three source packages. Compiled tests in `backend/dist` and old backups no longer inflate the count or execute stale code. |

## Verification

Last code verification: `pnpm typecheck` passed; `pnpm test` passed **161 source tests across 15 suites**; `pnpm build` passed for all packages. Lint completed with **0 errors**, including the deprecated API rule; the warning backlog remains. Earlier totals included compiled copies of backend tests and are superseded by the source-only test configuration. Optional pages and tracking components load separately. Production assets were checked to exclude the development password hint.

- Workspace typechecking, regression tests, and production builds are run from the root using `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- HTTP tests cover normalized login, incorrect credentials, validation failures, authenticated profiles, staff dispatch access, customer denial, registration role escalation, invalid query limits, cancellation restrictions, and login rate limits.
- API-client tests cover shared session subscriptions, logout, expired tokens, stale-response races, unavailable storage, field errors, network failures, and invalid HTML responses.
- Zustand session tests cover existing stored sessions, malformed user data, same-origin tab changes, logout during startup, and preserving an in-memory session when storage is blocked. Seed/recovery tests parse the actual environment template and enforce development/admin restrictions on password resets.
- Order tests cover server-authoritative pricing, unknown items, ObjectId history references, and missing telemetry orders.
- Additional regressions cover typed page URLs and memory history, shared phone/order lookup validation, whitespace-only customer details, malformed auth JSON, stale status changes, and terminal telemetry.
- Configuration tests cover the actual environment template, custom rate windows and order limits, invalid settings, explicit pricing inputs, the public endpoint allowlist, browser settings, and Retry-After guidance.
- A local headless browser checks incorrect-password feedback, successful sign-in without refreshing, refresh persistence, logout and guest socket reconnection, staff route access, cart and checkout Escape dismissal, associated form labels, body scroll restoration, and mobile sign-in at 390px. These are smoke checks, not a complete accessibility or browser compatibility certification.
- Live API and Socket.io checks verify staff authentication and protected reads, handshake token formats, heartbeat acknowledgments, and rejection of customer courier actions. Tokens and passwords are not written to this report.
- The navigation/form browser checks verify matching 32px Track/Advance bounds, direct tracking refresh, Back/Forward, courier deep links, unknown/invalid order input, inline phone and checkout errors, first-error focus, native Escape dismissal, mobile links, and contained table overflow.
- Runtime checks import emitted shared JavaScript in plain Node, resolve shared source through the development condition, and start the compiled API in production mode on a temporary port, verifying its protected endpoint before stopping that test process.

## Remaining implementation gaps

These need further implementation before a public release with real customer information.

1. **Guest order privacy and ownership — high priority.** `GET /api/orders/:orderId` and socket order-room joins are public; four-digit order numbers are guessable. Phone-only order history reveals matching orders without verifying the caller. Use authenticated customer ownership or opaque, scoped guest tracking capabilities, verified history access, and authorization on room joins. Merely hiding controls does not secure these reads.
2. **Audit consistency and order identifiers — high priority.** Conditional writes now protect status advancement and cancellation from stale competing updates. Order creation/status changes and their audit logs are still separate writes. Use a transaction or another durable consistency mechanism for audit records. The current four-digit order number space also needs a larger identifier and bounded duplicate-key retries.
3. **Courier assignment and event throttling.** The schema contains `courierId`, but assignment and ownership checks are not implemented. Staff couriers can act on any order allowed by their role. Socket events need dedicated limits; the HTTP guard intentionally skips them. Terminal-status checks are implemented; telemetry freshness validation remains.
4. **Real delivery and payments.** Checkout generates demonstration coordinates around a fixed location. Addresses are not geocoded, courier movement is simulated, and payment collection is absent. Tax and delivery fees are configurable demo rules; jurisdictional tax calculation is not implemented.
5. **Customer account and session lifecycle.** Registration exists as an API, but the UI only exposes staff sign-in and guest checkout. User-facing password recovery, refresh tokens, server-side token revocation, and immediate role-change enforcement are absent. The development admin recovery command is an operator tool. JWTs remain valid until expiry; sign-out clears the saved session and synchronizes open tabs on the same origin.
6. **Deployment.** Page and selected-order URLs now use TanStack Router with browser history. Vite development/preview support direct links, while production hosting still needs frontend SPA rewrites, HTTP/socket routing, and a process supervisor. Database configuration should fail fast with an operator-friendly error.
7. **Operational verification.** Current unit/HTTP tests and browser smoke checks do not cover MongoDB failure recovery, concurrent traffic, payment processing, or sustained socket load. A production release needs those checks, backups, monitoring, and durable audit verification. Existing lint warnings should be reviewed separately from the errors addressed here.

The [implementation report](IMPLEMENTATION_AND_VERIFICATION_REPORT.md) summarizes implemented components and verified behavior. These remaining gaps limit production readiness.

## Follow-up: rejected default credentials and Zustand

The default admin password was rejected because both development environment files contained an unquoted `#`. Dotenv interpreted the suffix as a comment and seeded a hash of the truncated prefix. Quoting the environment values alone does not repair the stored hash. The environment template and local configurations were corrected, the development administrator was restored with the explicit `pnpm auth:reset-dev-admin` command, and the courier was repaired only after its hash was confirmed to match the same truncated seed value. No unrelated custom password was replaced.

The hardcoded password hint was removed from the sign-in dialog. The API now resolves the root environment file consistently before the backend fallback. The administrator reset command requires development mode and refuses a non-admin account. A regression test parses the actual example template with dotenv and checks that both complete sample passwords survive.

Zustand 5.0.15 replaces the manual subscription store. Existing persisted sessions remain compatible. One root component owns session verification and socket identity changes, including a logout that occurs during another tab's startup. Inaccessible storage preserves an active in-memory login. API tests and real desktop/mobile browser checks use the full admin credentials supplied in the bug report; two-tab checks verify shared sign-in, refresh, and sign-out.

See the [session architecture](ARCHITECTURE.md#frontend-state-and-session-lifecycle) for state ownership and source responsibilities, and the [README recovery steps](../../README.md#recover-an-existing-development-administrator) to repair an existing development administrator.

## Follow-up: page links and field errors

The route migration keeps cart and dialog state in the root layout, moves order queries into the active tracking/courier page, and gates staff outlets without fetching dispatch data for guests. Selected orders are URL parameters. Dispatch/history tracking controls are links, and checkout navigates to the newly created order URL. Responsive navigation switches to the mobile menu before desktop controls overflow.

The review also fixed lookup validation, whitespace-only checkout fields, repeating an order-history search without refetching, lost server validation paths, and raw Zod diagnostics from malformed authentication responses. Field focus waits for submitting controls to be re-enabled after server errors. Backend compare-and-set status writes reject stale actions, and completed orders stop accepting courier updates.

The shared package's source-only runtime entry was also an implementation gap: the compiled API could not resolve source `.js` imports under plain Node. The package now provides compiled production exports and source development exports, with a dedicated build configuration and source aliases for root tests. The built API was verified in production mode without resetting or seeding staff accounts.

## Follow-up: deprecations, environment values, and table alignment

The installed Mongoose 9.11.2 migration guide confirms that `new` and `returnOriginal` are deprecated. Both status/cancellation update paths now use `returnDocument: 'after'`, retaining their conditional-write behavior. A source audit found no remaining deprecated Mongoose options or legacy update/remove APIs. Type-aware deprecation lint also found React form event types and a TanStack Query method; these were updated using the installed declarations and primary documentation. The Vite configuration import now includes its TypeScript extension for native loader compatibility.

The new deprecation lint rule fails on annotated deprecated APIs. Environment schemas centralize HTTP limits/windows, order limits/estimates, pricing, password work factor, database retries, DNS, and browser timings. Development seeding requires configured credentials. Cart and checkout load only public pricing from the API, and rate-limit messages use the actual retry interval. See the [configuration guide and primary references](CONFIGURATION.md).

All Kitchen Dispatch Station headers are centered. Order #, Total, Current Status, Created, and Actions cells are centered while Customer and Items retain left alignment. Track and Advance retain matching 32px heights inside a centered flex row.

## Follow-up: navigation, themed filters, and pagination

The cramped horizontal navigation was replaced with a hamburger-controlled left drawer. Desktop content reserves the sidebar width while open; mobile uses a modal dialog with focus containment and scroll locking. Category hover colors explicitly override light-mode text, border, and background in dark mode. History Search Orders and tracking Track buttons include icons.

Dispatch now has a themed status dropdown with all eight statuses and explicit Filter/Search actions. Its search icon has equal 14px spacing inside a 44px region. The dropdown sits above the table, including dark mode. The new select supports keyboard selection, type-ahead, Escape, and outside dismissal.

Pagination covers menu, dispatch, and history with 10/25/50/100 choices, ranges, page buttons, and boundary states. A former implementation limit was also removed: dispatch search previously filtered only the fetched subset, and history stopped at its implicit 20-order limit. Database search/count/skip/limit now make the complete matching order set reachable through paged requests. Search text is escaped literally, and timestamp ties use `_id` for stable sorting. URL schemas restore list state and normalize invalid inputs.

Verification adds pagination boundaries, filtered database queries, stable sorting, history offsets, HTTP validation, and route URL cases. Browser checks use real API reads for filters/history and a temporary response fixture for multi-page controls, without changing existing orders. They cover drawer width restoration, mobile dismissal, dark hover colors, all statuses, icon spacing, keyboard selection, page-size reset, and invalid direct URLs.

## Follow-up: current dependency releases

The npm audit covered every declared external package in all four manifests. All 49 remaining packages now match npm's latest stable version in both the declared minimum and installed metadata. Seven installed packages changed, including Zod 4.6.7 and Motion 14.4.0. React 19.3.1 and Tailwind CSS 4.3.3 were already current; their manifest minimums and documentation were stale. The deprecated bcrypt types stub was removed because bcryptjs supplies its own types. See the [complete version comparison and compatibility notes](DEPENDENCIES.md).

The Zod migration preserves normalized email validation and the API's field-error response shape, replaces removed/deprecated schema APIs, and tests non-finite environment values and transformed DNS defaults. A fresh compiled production API and frontend preview verified real staff sign-in, inline errors and focus, tracking animations, Socket.io connectivity, and overridden delivery/tax settings without creating or advancing orders. The npm security audit reported zero vulnerabilities. `pnpm deps:check` repeats the online version comparison. The Vite+ alias peer warning and existing lint warnings remain documented; application builds and standalone tests pass.
