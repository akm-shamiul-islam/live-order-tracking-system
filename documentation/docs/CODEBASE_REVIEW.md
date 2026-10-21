# Codebase review and task status

Updated 2026-10-21 (Asia/Tokyo). This document tracks implementation and verification; the README remains focused on project installation and use.

## Completed implementation

| Request or former gap | Current implementation and evidence |
| --- | --- |
| Default staff login | Quoted `#` passwords in the real template, normalized emails, explicit Nest injection for tsx, useful service errors and development admin recovery. Existing passwords are not reset silently. |
| Login state | Zustand 5.0.15 persistence/tab sync, rotating refresh cookies, server revocation, disabled-account/current-role checks and stale-response protection. |
| Registration and customer ownership | Registration forces CUSTOMER. Ordering/tracking require login; history uses account ownership, without phone-only or tracking-link bypass. Real HTTP/MongoDB/socket tests include unrelated users with the same phone. |
| Saved registration address | Optional multiline address persists with the authenticated profile and prefills checkout with name/phone. Customers edit details for the current delivery and click Deliver; registered defaults stay intact. Shared validation, session synchronization, real MongoDB and browser checks cover persistence, edits and stale location pins. |
| Admin Users menu | Admin-only searchable/paginated users, themed role editor, name/email/phone/access changes, stale-write rejection, management audit and session invalidation. Direct URLs/APIs deny non-admins. |
| Courier requests | Redacted available summaries, delivery requests, admin approval/decline and one winning assignment under contention. Other couriers lose list/full-read/room access after assignment. My Deliveries contains assigned orders only. |
| Status/cancellation | Admin/assigned-courier dropdowns follow sequential stages. Cancellation requires a modal reason and retains it in customer-visible history. Terminal orders reject further status/GPS writes. |
| Guest privacy | Public order/history reads and public room joins are closed. Opaque IDs are hashed but still require authorization. Legacy guest orders remain admin-only unless a real owner is already recorded. |
| Audit and identifiers | Creation/mutations and their audit records are one document write. Legacy logs remain readable. Random 48-bit order numbers have bounded retries; majority journaled writes survive the tested database restart. |
| Courier ownership/freshness | Assignment applies to HTTP, sockets, reads and passive broadcasts. Device GPS is opt-in; stale/future/reordered samples are rejected. Unknown addresses no longer receive random coordinates. |
| Socket flood protection | Configurable packet/IP/handshake/concurrent-connection/payload/room limits. Reconnects do not reset the IP packet budget. Real socket and unit tests exercise failure acknowledgments and recovery. |
| Integration TypeScript errors | Backend imports public `io`/`Socket` from its own socket.io-client dependency. `transports`, `once` and `on` compile without ambient declaration shims. |
| Mongoose deprecation | Current `returnDocument: 'after'` and driver `journal` options replace deprecated forms. Type-aware deprecated-API lint is an error. |
| Environment settings | Limits, windows, pagination caps, GPS timing, estimates, work factor, pricing, database retry/timeouts, sessions, mail and hosting are validated and documented. |
| Navigation/dispatch design | Shareable TanStack URLs, breadcrumbs, role-filtered animated drawer open by default with a saved preference, full-width history and Available Deliveries, dark category hovers, themed status filter, action icons, menu page sizes 8/16/32/60, other lists 10/25/50/100, date above time, centered requested headers/cells and equal-height Track/Advance. |
| Smooth page navigation | Router-managed native page fades, drawer intent preloading, a stable header/drawer, reduced-motion support and normal navigation when transition APIs/types are unavailable. A TypeScript commit adapter handles skipped-snapshot promises on rapid navigation while propagating actual page errors. Unit/Chrome checks cover both fades, browser history, rapid account navigation and same-page filters. |
| TypeScript-only maintained code | All nine remaining JavaScript files converted to TypeScript, including tooling and the early theme initializer. Strict tooling checks, typed browser/IPC contracts and a no-JavaScript source gate run through workspace typechecking and pre-push. Builds emit the runtime JavaScript. |
| Loading and food | Route/table skeletons and action spinners; 27 menu items across seven categories, local real photos, ingredient descriptions and realistic USD demo prices. |
| Packages and current APIs | Every direct package is checked against npm, with Node types matching Node 24. Current official APIs are reviewed. The Hyperid 4 override removes the vulnerable UUID dependency; the security audit is clear. |
| Account lifecycle | Registration/sign-in/profile/recovery pages, one-time reset, rotating HttpOnly refresh and server revocation. SMTP is implemented and mocked in tests; actual delivery requires mail setup. |
| Production application | Built shared exports, Fastify SPA hosting, compressed assets, CSP, initial-admin CLI, health/readiness and admin metrics. Database stop/restart recovery is tested against isolated MongoDB. |

Commands, saved browser/Lighthouse summaries and limitations are in [IMPLEMENTATION_AND_VERIFICATION_REPORT.md](IMPLEMENTATION_AND_VERIFICATION_REPORT.md) and [QUALITY.md](QUALITY.md).

## Appearance and language follow-up

- Whole-interface theme/language crossfades respect reduced motion and API support. Hover transitions, custom cart/theme tooltips and icon-only actions preserve accessible labels, keyboard focus and Escape dismissal.
- Users centers the requested columns and uses the themed Account Status dropdown. Available Deliveries gives its introduction the full header width.
- EN/JA JSON resources cover interface/validation copy and the food catalog. Local device preferences and owned MongoDB preferences restore on reload/sign-in; failed saves retain a scoped retry record. Strict preference validation and revision/identity guards reject account-edit injection and stale session writes.
- The Japanese browser check found an untranslated conditional account heading and breadcrumb label; both are corrected and the source locale gate now checks conditional display text as well.
- Current verification is recorded below and in the implementation report. Existing Lighthouse measurements remain historical; this follow-up does not rerun Lighthouse.

## Review of the committed baseline

Reviewed the application at `9361f45`, including the account/courier implementation in `83353a9`, against the earlier requirements. Passing workflow tests had not covered several failure paths. This follow-up adds regression coverage and fixes the following findings; severity describes their impact before the fix.

| Severity | Finding | Correction and evidence |
| --- | --- | --- |
| High | A reset link delivered before an admin changed the account email, role or access could still reset that account, including after disable/re-enable. | Remove reset hash, expiry and cooldown atomically with the sensitive account update. Three real-database scenarios now reject the old link and preserve the original password. |
| High | A late login/registration response could restore authentication after sign-out or replace a newer sign-in. Cookie-changing operations used different coordination boundaries. | One Web Lock serializes cookie changes, with an in-tab fallback; intent checks reject superseded responses. Logout clears local state again after server revocation. Source tests cover pending login, refresh, newer login and logout races; Chrome verifies the real cookie flow. |
| Medium | Refresh errors cleared the HttpOnly cookie even on a database 503, preventing recovery after the outage. | Clear it only for rejected credentials. The MongoDB stop/restart test verifies no deletion cookie on 503 and successful reuse after recovery. |
| Medium | Sign-out silently ignored server errors; auxiliary session cleanup could report failure after logout/password reset had already invalidated credentials. | Show sign-out progress/failure and retry. Token versioning remains authoritative if auxiliary cleanup fails. Two fault-injection integration cases reject old access/refresh credentials and allow a fresh login. Chrome verifies failed revocation and retry. |
| Medium | A socket adapter failure made an already committed order/status mutation look unsuccessful. | Sanitize/log notification failures without failing the saved mutation. Real HTTP and socket acknowledgments remain successful when the adapter throws. Polling/reconnects recover missed notifications. |
| Medium | Repeated checkout requests could create duplicate orders after a lost response. Eight concurrent retries created eight orders in the baseline. | Customer-scoped UUID keys plus a unique partial index return one existing order. Changed payloads conflict; another customer cannot replay the first customer's order. Chrome drops the response after commit and retries without a duplicate. |
| Medium | Role edits and assignments raced across documents: a courier could be demoted while being assigned, and two admins could demote one another concurrently. | Coordinate these writes within one API process and re-read current actor/courier access inside that boundary. Deterministic race tests now preserve a valid assignment/access decision. Distributed coordination remains a deployment prerequisite below. |
| Medium | Delayed status/GPS events or HTTP responses could overwrite newer tracking state. | Persist state revisions, emit stored revision/time, reject older events/snapshots, merge GPS by observation time, and preserve unchanged Query references. Source regressions cover terminal states, duplicate events, late reads and GPS ordering. |
| Low | Verification cleanup could wait forever for a child already terminated by a signal. | Check both `exitCode` and `signalCode`. The final browser run completes all checks and exits normally. |

The follow-up also removes obsolete checkout phone persistence and fills missing account action icons.

### Documentation checked for these changes

- [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) and [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): token lifecycle and server invalidation.
- [Mongoose atomic updates](https://mongoosejs.com/docs/tutorials/findoneandupdate.html), [indexes](https://mongoosejs.com/docs/guide.html#indexes), [MongoDB partial unique indexes](https://www.mongodb.com/docs/manual/core/index-partial/) and [single-document atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/): conditional writes, unique checkout enforcement and distributed limits.
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/): best-effort events require reconciliation; persisted order success is independent of notification delivery.
- [TanStack cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) and [structural sharing](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations): cancel reads and retain stable cache references.
- [Web Locks](https://www.w3.org/TR/web-locks/) and [Node child process lifecycle](https://nodejs.org/api/child_process.html#subprocesssignalcode): coordinate browser cookie changes and recognize signal termination.

## Remaining external integrations and operating requirements

| Work | Status and required input |
| --- | --- |
| Payments, refunds and jurisdictional tax | Not integrated. Requires country/currency and a payment provider. Current server-calculated pricing is a demo; placing an order does not collect payment. |
| Geocoding, delivery zones and street navigation | Not integrated. Requires provider, service area and credentials. Current-location pins/device GPS work independently; addresses are not automatically verified/geocoded. |
| Live recovery email | Configure SMTP and verify sender/domain/delivery. Tests use mocked mail. A durable delivery queue remains an operating enhancement. |
| Hosting, TLS and supervision | Application support is implemented; live deployment is not performed. Requires hosting target/domain and production credentials. Local Lighthouse cannot certify deployed TLS/HSTS. |
| Backups, restore drills and alerts | Health/metrics and an operations runbook are provided. No cloud backup schedule, production restore drill, alert destination or retention policy is configured without infrastructure choices. |
| Multiple API instances | Run one API process. Access/assignment coordination, rate budgets and connection counts are process-local. Transactions/shared coordination, shared limit storage and Socket.IO fanout/adapter are required before horizontal scaling or overlapping API deployments. Configure implemented TRUSTED_PROXY_IPS for the actual proxy topology. |
| Guaranteed event delivery and older browsers | Socket events are best effort; polling/reconnects reconcile persisted state. A durable outbox is needed for replay guarantees. Browsers without Web Locks have only in-tab cookie coordination; cross-tab race protection requires Web Locks. |
| Production capacity | Validate capacity against the target TLS/proxy/database topology with representative traffic before production rollout. |

The former seven gaps therefore have separate outcomes: privacy, atomic audit, assignment, account lifecycle and application hosting have implementation and automated checks; payment/geocoding and deployment operations still require the choices above. Lighthouse scores alone do not establish production readiness or zero security risk.

## Measured limitations

The earlier eight-case Lighthouse run reports 100 accessibility/best-practices throughout and 100 public-menu SEO. Performance is 90 on the mobile menu, 99–100 on tested desktop pages and 82–91 on private/account mobile pages. The saved-address/full-width courier follow-up reports 82 performance and 100 accessibility/best-practices on both changed mobile pages, with zero layout shift. The TypeScript/theme follow-up reports mobile performance 81 (menu) and 85 (registration), with accessibility/best-practices 100 and zero layout shift; public SEO remains 100. Mobile startup/unused JavaScript and some image/layout diagnostics remain; this is not a claim of perfect performance or zero security defects. Details and test conditions are in QUALITY.md. Lint has zero errors and nonblocking warnings, including deliberate sequential test steps, existing style/type suggestions and explicit serialization-boundary assertions in the typed tooling.
