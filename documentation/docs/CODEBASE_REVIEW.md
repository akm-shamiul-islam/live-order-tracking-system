# Codebase review and task status

Updated 2026-10-21 (Asia/Tokyo). This document tracks implementation and verification; the README remains focused on project installation and use.

## Completed implementation

| Request or former gap | Current implementation and evidence |
| --- | --- |
| Default staff login | Quoted `#` passwords in the real template, normalized emails, explicit Nest injection for tsx, useful service errors and development admin recovery. Existing passwords are not reset silently. |
| Login state | Zustand 5.0.15 persistence/tab sync, rotating refresh cookies, server revocation, disabled-account/current-role checks and stale-response protection. |
| Registration and customer ownership | Registration forces CUSTOMER. Ordering/tracking require login; history uses account ownership, without phone-only or tracking-link bypass. Real HTTP/MongoDB/socket tests include unrelated users with the same phone. |
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
| Navigation/dispatch design | Shareable TanStack URLs, breadcrumbs, role-filtered animated drawer open by default with a saved preference, full-width history, dark category hovers, themed status filter, action icons, menu page sizes 8/16/32/60, other lists 10/25/50/100, date above time, centered requested headers/cells and equal-height Track/Advance. |
| Loading and food | Route/table skeletons and action spinners; 27 menu items across seven categories, local real photos, ingredient descriptions and realistic USD demo prices. |
| Packages and current APIs | Every direct package is checked against npm, with Node types matching Node 24. Current official APIs are reviewed. Benchmark-only Hyperid 4 removes the vulnerable UUID dependency; the security audit is clear. |
| Account lifecycle | Registration/sign-in/profile/recovery pages, one-time reset, rotating HttpOnly refresh and server revocation. SMTP is implemented and mocked in tests; actual delivery requires mail setup. |
| Production application | Built shared exports, Fastify SPA hosting, compressed assets, CSP, initial-admin CLI, health/readiness and admin metrics. Database stop/restart recovery is tested against isolated MongoDB. |

Commands, saved browser/Lighthouse summaries and limitations are in [IMPLEMENTATION_AND_VERIFICATION_REPORT.md](IMPLEMENTATION_AND_VERIFICATION_REPORT.md) and [QUALITY.md](QUALITY.md). HTTP measurements are described in [BENCHMARKS.md](BENCHMARKS.md).

## Remaining external integrations and operating requirements

| Work | Status and required input |
| --- | --- |
| Payments, refunds and jurisdictional tax | Not integrated. Requires country/currency and a payment provider. Current server-calculated pricing is a demo; placing an order does not collect payment. |
| Geocoding, delivery zones and street navigation | Not integrated. Requires provider, service area and credentials. Current-location pins/device GPS work independently; addresses are not automatically verified/geocoded. |
| Live recovery email | Configure SMTP and verify sender/domain/delivery. Tests use mocked mail. A durable delivery queue remains an operating enhancement. |
| Hosting, TLS and supervision | Application support is implemented; live deployment is not performed. Requires hosting target/domain and production credentials. Local Lighthouse cannot certify deployed TLS/HSTS. |
| Backups, restore drills and alerts | Health/metrics and an operations runbook are provided. No cloud backup schedule, production restore drill, alert destination or retention policy is configured without infrastructure choices. |
| Multiple API instances | Rate budgets are per-process. Shared limit storage and Socket.IO fanout/adapter are required before horizontal scaling. Configure implemented TRUSTED_PROXY_IPS for the actual proxy topology. |
| Production capacity | Local adapter measurements are reference results, not sustained production capacity or WebSocket/write-load certification. Repeat with target TLS/proxy/database topology. |

The former seven gaps therefore have separate outcomes: privacy, atomic audit, assignment, account lifecycle and application hosting have implementation and automated checks; payment/geocoding and deployment operations still require the choices above. Lighthouse scores alone do not establish production readiness or zero security risk.

## Measured limitations

The final eight-case Lighthouse run reports 100 accessibility/best-practices throughout and 100 public-menu SEO. Performance is 93 on the mobile menu, 99 on tested desktop pages and 80–85 on private mobile pages. Mobile startup/unused JavaScript and some image/layout diagnostics remain; this is not a claim of perfect performance or zero security defects. Details and test conditions are in QUALITY.md. Lint has zero errors and 103 warnings, including deliberate sequential test steps and existing style/type suggestions.
