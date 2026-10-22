# Codebase review and task status

Updated 2026-10-23 (Asia/Tokyo). This document tracks implementation and verification; the README remains focused on project installation and use.

## Account menu and OTP review (2026-10-23)

- Replaced the account dropdown's green gradient with the application's slate surfaces, standard light/dark text and restrained teal avatar/role accents. Profile opens from the top-right avatar menu, with Sign Out below it; the drawer retains its KitchenToDoor/Explore heading.
- Widened the Profile modal. Full Name, Email Address and Phone Number appear in that order, using the same one/two/three-column behavior as password fields. Fixed a small-tablet gap where the address occupied only one grid cell; it now spans the full row.
- Both observers of the shared profile cache now disable focus/reconnect refetches. Previously the header's observer could refresh the editor's cache and silently replace an unsaved draft after an administrator updated the account. Opening the editor fetches a current revision before showing editable fields, preventing a stale cached version from failing the next submission. Cancel and confirmed route navigation close the modal; cancelled Back navigation and Keep Editing retain it. Clean and pending-review profiles can also be closed with Cancel. Account changes dismiss open account/checkout dialogs.
- Pending photos are visible to their owner in the uploader/account menu, and saved photos load through the protected image endpoint. Image failures show the profile icon. The approval requirement and owner/admin photo/receipt permissions remain enforced.
- Fixed OTP verification races: wrong attempts increment the configured budget atomically; an older wrong attempt cannot consume a freshly resent code, and a correct code can succeed after a concurrent wrong attempt while still below the limit. SMTP-failure retry updates now execute explicitly and handle storage failures. Four focused regressions cover these paths.
- Corrected the remaining documentation references to the cart's state owner, checkout confirmation label and profile entry point. The forgot-password email → OTP → password flow remains covered by the browser workflow.

Implementation follows [TanStack focus refetch guidance](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching), [Mongoose query execution](https://mongoosejs.com/docs/queries.html) and [atomic updates](https://mongoosejs.com/docs/tutorials/findoneandupdate.html), plus [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Local verification and external operating requirements are recorded below and in the implementation report.

## Completed implementation

| Request or former gap | Current implementation and evidence |
| --- | --- |
| Default staff login | Quoted `#` passwords in the real template, normalized emails, explicit Nest injection for tsx, useful service errors and development admin recovery. Existing passwords are not reset silently. |
| Login state | Zustand 5.0.16 persistence/tab sync, rotating refresh cookies, server revocation, disabled-account/current-role checks and stale-response protection. |
| Registration and customer ownership | Registration forces CUSTOMER. Ordering/tracking require login; history uses account ownership, without phone-only or tracking-link bypass. Real HTTP/MongoDB/socket tests include unrelated users with the same phone. |
| Saved registration address | Optional multiline address persists with the authenticated profile and prefills checkout with name/phone. Customers edit details for the current delivery and click Confirm Order; registered defaults stay intact. Shared validation, session synchronization, real MongoDB and browser checks cover persistence, edits and stale location pins. |
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
| Account lifecycle | Registration/sign-in/profile/recovery pages, email OTP activation and new-device checks, one-time password reset grants, rotating HttpOnly refresh and server revocation. A local SMTP test server captures OTPs; actual delivery requires Gmail or another SMTP setup. |
| Production application | Built shared exports, Fastify SPA hosting, compressed assets, CSP, initial-admin CLI, health/readiness and admin metrics. Database stop/restart recovery is tested against isolated MongoDB. |

Commands, saved browser/Lighthouse summaries and limitations are in [IMPLEMENTATION_AND_VERIFICATION_REPORT.md](IMPLEMENTATION_AND_VERIFICATION_REPORT.md) and [QUALITY.md](QUALITY.md).

## Review of staged and unstaged changes: request 42

The combined working tree was checked against the instructions, with the latest corrections taking priority. The review preserved the user's staging choices and did not stage files or create a commit.

| Requirement group | Implementation checked |
| --- | --- |
| Persistent cart and checkout | Account-scoped Zustand/localStorage carts survive route changes and reloads. Authenticated menu cards show quantity controls. Checkout uses Confirm Order and retains saved registration details while allowing order-specific edits. |
| Dispatch filters, table and settings | Separate Order Status/Delivery Assignment labels and compact dropdowns; compact Filter/Settings controls; separate name/contact cells; no-wrap identifiers/totals/status; centered requested columns; date above time; persistent account-scoped column settings. |
| Search, pagination and empty states | Custom clear buttons with pointer cursors, suppressed native clear controls, 360 px desktop search fields, right-aligned search actions, courier status filters, pagination tooltips and the centered Dispatch empty state. |
| Available Deliveries | Full content width, shared status badge colors and right-aligned Request Delivery/Review in Dispatch labels with icons. The introduction uses one line when it fits and wraps when space is reduced by the drawer. |
| Receipts | Owner/admin authorization, read-only canvas preview, Cancel/X/Download Receipt controls, centered branding/title, numbered item rows, centered headers/numeric cells, clipped rounded table/photos, a pale teal-green header and white item rows. A badge-colored Current Status card sits beside Customer details, totals stay right-aligned, and Order History starts on a separate page. Page-number footers omit the payment notice; preview controls wrap on narrow screens. |
| Accounts and profiles | Registration photo uploader, read-only self-service email, name/phone/address/photo/password editing, current-password verification, customer/courier approval and immediate audited admin self-edits. Profile contacts align in a desktop row; password fields use a rounded fieldset. |
| Unsaved profile changes | Visible dirty indicator, shared confirmation for Cancel/Back/navigation/Sign Out, draft preservation on Keep Editing, clearing on Discard and native reload/close warnings. Password drafts are not persisted. |
| Users administration | Admin-only roles/access editing, Delivery Address, column settings, profile request history and administrative edit history. Profile queries are invalidated after an administrator edits their own account. |
| Notifications for every role | Private owner/admin scope, role-appropriate messages, aligned name/badge/date/message/actions, bold unread state, persisted read/unread, dropdown-only dismissal and full history. Latest events appear first; themed scrollbars appear only on overflow. |
| Notification filters and review | Labeled Review Status Filter and Search, URL state, empty-state dropdown layering, steady hover text, timestamps, reviewer name/email, centered comparison headers and red/green changes. Completed requests no longer display the pending-approval explanation. |
| Navigation and appearance | Saved responsive drawer, copyable TanStack URLs, breadcrumbs, smooth page/theme/language changes, EN/JA resources, local Noto Sans JP, accessible icons/tooltips and branded startup/auth loading. Production direct loads of Profile/Notifications now return HTTP 200. |
| Documentation, packages and skills | npm version recheck, official API review, synchronized README/dependency/skill versions, AI development credits and no throughput benchmark results in the README/docs. Historical measurement versions remain labeled as historical. |

This review found and corrected missing HTTP 200 handling for the new Profile/Notifications routes, an overflowing courier introduction, stale Profile data after admin self-edits, outdated pending-state review copy and receipt footer wrapping. The dependency recheck also found eight newer releases; their API evidence and exact versions are recorded in DEPENDENCIES.md. Current check results are recorded in the implementation report. Infrastructure/provider requirements below remain separate from these application changes.

## Final staged and unstaged review (2026-10-22)

Rechecked the combined changes against the latest requirements, including receipt requests 44–46. This review found and fixed five additional gaps:

- The cart selector created a fresh empty array while its account changed. It now uses a stable fallback, as required by Zustand 5, while retaining account-scoped storage.
- A delayed checkout success could clear the cart and navigate after the user switched accounts or started a new sign-in. The API now rejects that stale result before the success callback runs. Two regressions reproduced the previous behavior and pass with the fix; lost-response retries still reuse the order's checkout key.
- Checkout notes had no maximum length and no inline field error. The client/server share a 500-unit Zod limit matching HTML maxlength, including emoji. The field now shows the linked red error and receives focus when invalid.
- The Dispatch Settings button extended outside its filter panel at 1024 px after the drawer animation settled. Its dropdown grid now responds to the panel's container width, and filter/search groups can wrap without changing compact button sizes. Desktop browser checks compare actual control bounds to their panel after the drawer settles.
- The receipt preview added a second `<main>` landmark inside the page's existing main content. It is now a keyboard-focusable, named region; the browser check confirms the preview opens with one visible main landmark. This follows the [HTML Standard's main element constraints](https://html.spec.whatwg.org/multipage/grouping-content.html#the-main-element).

The fresh npm check found Nodemailer 10.2.1 and react-i18next 17.1.2. Both patches were updated after reviewing their installed maintainer changelogs. Nodemailer's official documentation confirms its bundled TypeScript declarations; the obsolete community declarations were removed. Current version references and the frontend skill were synchronized. The current inventory is 67 direct packages across 80 declarations; supported Node 24 declarations remain on the compatible release line.

The final checks and remaining external requirements are recorded in the implementation report. Existing staging choices were preserved.

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
| Live recovery email | Configure SMTP and verify sender/domain/delivery. Tests deliver to an isolated local SMTP server; delivery to external mailboxes requires the operator's configuration. A durable delivery queue remains an operating enhancement. |
| Hosting, TLS and supervision | Application support is implemented; live deployment is not performed. Requires hosting target/domain and production credentials. Local Lighthouse cannot certify deployed TLS/HSTS. |
| Backups, restore drills and alerts | Health/metrics and an operations runbook are provided. No cloud backup schedule, production restore drill, alert destination or retention policy is configured without infrastructure choices. |
| Multiple API instances | Run one API process. Access/assignment coordination, rate budgets and connection counts are process-local. Transactions/shared coordination, shared limit storage and Socket.IO fanout/adapter are required before horizontal scaling or overlapping API deployments. Configure implemented TRUSTED_PROXY_IPS for the actual proxy topology. |
| Guaranteed event delivery and older browsers | Socket events are best effort; polling/reconnects reconcile persisted state. A durable outbox is needed for replay guarantees. Browsers without Web Locks have only in-tab cookie coordination; cross-tab race protection requires Web Locks. |
| Production capacity | Validate capacity against the target TLS/proxy/database topology with representative traffic before production rollout. |

The former seven gaps therefore have separate outcomes: privacy, atomic audit, assignment, account lifecycle and application hosting have implementation and automated checks; payment/geocoding and deployment operations still require the choices above. Lighthouse scores alone do not establish production readiness or zero security risk.

## Measured limitations

The earlier eight-case Lighthouse run reports 100 accessibility/best-practices throughout and 100 public-menu SEO. Performance is 90 on the mobile menu, 99–100 on tested desktop pages and 82–91 on private/account mobile pages. The saved-address/full-width courier follow-up reports 82 performance and 100 accessibility/best-practices on both changed mobile pages, with zero layout shift. The TypeScript/theme follow-up reports mobile performance 81 (menu) and 85 (registration), with accessibility/best-practices 100 and zero layout shift; public SEO remains 100. Mobile startup/unused JavaScript and some image/layout diagnostics remain; this is not a claim of perfect performance or zero security defects. Details and test conditions are in QUALITY.md. Lint has zero errors and nonblocking warnings, including deliberate sequential test steps, existing style/type suggestions and explicit serialization-boundary assertions in the typed tooling.
