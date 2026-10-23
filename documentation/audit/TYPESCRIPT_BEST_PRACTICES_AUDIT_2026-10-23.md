# TypeScript best-practices and implementation audit

Date: 2026-10-23, Asia/Tokyo. Reviewed baseline: `1f6b235`, followed by the fixes described below. Installed compiler: TypeScript 7.0.2. Runtime: Node 24. Scope: backend, frontend, shared contracts, maintained scripts, compiler/lint configuration and the requested account/order workflows.

## Summary

The project already uses strict checking, shared Zod contracts, typed routes and TypeScript tooling. The review found concrete weaknesses in WebSocket actor handling, error-response decoding and legacy test mocks. They have been corrected. Additional compiler/lint checks now prevent several regressions.

The subsequent review of `f1a963c` also fixed storage-related OTP/session failures and completed successful JSON response validation. Invalid checkout responses now retain the retry key. The follow-up findings and verification are recorded below; the original verification table remains a historical record.

The password-control implementation was committed and pushed as `1f6b235` before this audit started, following the requested task order. It covers customer/staff sign-in, registration, password reset and the Profile modal, including independent visibility, translated tooltips, keyboard operation and value/error preservation.

This is a source review and local verification report. It does not establish that every possible logical, security or accessibility defect is absent.

## Reference review

The requested [W3Schools guide](https://www.w3schools.com/typescript/typescript_best_practices.php) was reviewed for strict configuration, inference, precise contracts, avoidance of `any`, focused modules, async/error handling and manageable type complexity. Compiler behavior and framework APIs were checked against the primary sources below.

Its example CommonJS/Node configuration was not copied into the ESM/Vite workspace. Existing React component filenames and framework conventions were retained. Sequential database decisions and browser actions were not converted to parallel operations merely to suppress loop warnings.

| Area | Project application |
| --- | --- |
| Strict configuration | All compiler projects inherit the strict base; additional compatible checks were tested before enabling them. |
| Inference and explicit contracts | Local mock factories use inference; parameters, event payloads and service boundaries carry concrete types. |
| Untrusted values | Socket credentials and decoded JSON enter as `unknown`; validation/narrowing precedes field access. |
| Modules and composition | Existing domain modules and shared contracts remain authoritative. A small shared authentication-context module replaces ad-hoc socket fields. |
| Async/error handling | Dependent writes remain ordered. Malformed server error entries no longer break the error path. |

## Findings and corrections

### F1. Missing socket actor could fall back to an administrator

**Priority: medium, defense in depth. Fixed.**

`orders.gateway.ts` read an ad-hoc user property through `any` and used an admin fallback in the status handler. The normal Nest guards prevented an unauthenticated external call; this review did not demonstrate an existing remote authentication bypass. The handler itself nevertheless could invoke its service with a fabricated privileged actor if guard attachment was omitted or the context changed.

Status, cancellation and location handlers now require `client.data.user` before invoking any service. They retain their current authentication/role decorators and service authorization. Three regressions deliberately call handlers without guards and assert that no mutation service is called.

### F2. Socket events and authentication contexts bypassed static checks

**Priority: medium, type safety. Fixed.**

The gateway used four explicit `any` assertions; RolesGuard used another explicit `any`, and generic Nest context access silently admitted additional implicit `any` values. Socket server types did not bind the shared events or per-socket actor.

`authenticated-context.ts` now supplies typed HTTP requests, `OrderSocket`, `OrderSocketServer`, optional actor data and an unknown-credential reader. WsJwtGuard, RolesGuard, CurrentUser and the gateway use the same context. Broadcast signatures preserve each event's argument tuple. Incoming network payloads still receive runtime validation; TypeScript is not treated as a network security boundary.

Role tests cover HTTP/WebSocket admins, customers, absent actors and rejection of the old top-level socket user property. Credential tests include malformed auth values. Existing integration checks exercise current session/role/assignment authorization and passive broadcasts.

### F3. Malformed API errors could throw while being displayed

**Priority: medium, reliability. Fixed.**

The API client inferred JSON as `any`. An error response containing `errors: [null]` reached a callback that read `error.message` without checking the entry. Object-valued messages could also become unreadable error text.

JSON now starts as `unknown`. The decoder narrows object envelopes and issue entries, accepts string messages, preserves valid inline errors and uses the existing fallback for unrecognized envelopes. Successful responses must have object envelopes. Four new regressions cover malformed entries, valid sibling errors, null bodies and unsupported message shapes.

At the initial audit, endpoint-specific success validation remained incomplete. The follow-up described in R1 now validates successful JSON responses against shared schemas.

### F4. Leave-room payload relied on an annotation

**Priority: low, runtime consistency. Fixed.**

The leave handler declared a string order ID but did not validate received JSON. It now accepts `unknown`, applies the shared lookup schema and ignores malformed payloads. A regression checks that object-valued IDs cannot cause a leave call and that valid IDs still work.

### F5. Legacy service mocks used explicit `any`

**Priority: low, regression detection. Fixed.**

Auth/order unit tests declared model variables, mock callbacks and fixtures as `any`. They now use inferred mock factories, typed function signatures and partial domain fixtures. Unused `save()` stubs were removed. An unchecked array access in the order-create assertion now handles an absent recorded call.

Partial model/framework doubles still require assertions at their construction boundaries. They are deliberate test seams, not evidence that a full Mongoose model was constructed. Real MongoDB/HTTP/Socket.IO integration coverage remains in place.

### F6. Compiler and lint policy could permit avoidable regressions

**Priority: low, maintainability. Fixed.**

Added `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedSideEffectImports` and `noEmitOnError` to the shared compiler base. The first three were individually tested across all four compiler projects before activation. Final workspace checks also cover the side-effect import and emit policy.

Existing `strict`, indexed-access, override, switch-fallthrough and casing checks remain. Both staged and full Oxlint configurations now reject explicit `any` and enforce the TypeScript suppression-comment policy. The maintained-code scan contains no `@ts-ignore`/`@ts-nocheck` directives or explicit `any` types after the fixes.

### F7. Adapter factory returned an untyped server

**Priority: low, library boundary. Fixed with a documented compatibility assertion.**

Nest's factory return type propagated `any` into admission/connection handling. The adapter now narrows the factory result from `unknown` using Socket.IO's Server class and returns the application's typed server. Its configuration is modeled as partial options.

One options assertion remains because the installed Nest adapter declares complete `ServerOptions` while Socket.IO accepts partial configuration and supplies defaults. Replacing it with hardcoded copies of library defaults would create a maintenance problem. This bridge is confined to the adapter and covered by real socket integration tests.

## Initial verification

| Check | Result |
| --- | --- |
| Installed compiler | `tsc --version`: 7.0.2 |
| Source/workspace/tooling types | Passed with the additional compiler checks |
| Localization/source policy | 714 EN/JA UI keys and 54 food names/descriptions; no maintained JavaScript |
| Focused regressions | 74 passed across 6 files |
| Full source tests | 269 passed across 29 files; 20 regressions added during this audit |
| MongoDB/HTTP/SMTP/Socket.IO integration | 39 passed across 2 files after the context/adapter changes |
| Production build and general Chrome workflows | Passed; 20 scenarios on the final compiled app |
| Profile/notification/receipt Chrome workflows | 16 passed during the password-control phase, including all three modal password fields |
| Lint and formatting | 0 errors, 190 nonblocking warnings across 218 linted files; formatting passed across 249 files |

Browser/integration commands use isolated synthetic databases and local SMTP capture. Existing development accounts/orders and Gmail delivery are not used for these tests. Lighthouse was not rerun, consistent with the user's instruction.

Reviewed implementation: [gateway](../../backend/src/orders/orders.gateway.ts), [authentication context](../../backend/src/auth/authenticated-context.ts), [HTTP response decoding](../../frontend/src/lib/api.ts), [socket adapter](../../backend/src/common/socket-adapter.ts) and [compiler policy](../../tsconfig.base.json).

## Recommendations

### R1. Successful-response validation — implemented during the follow-up

**Priority: medium. Fixed.** The review of baseline `f1a963c` reproduced a checkout reliability issue: an HTTP 200 response containing an invalid order completed the retry attempt before the UI could use it. Retrying could then submit a different idempotency key. The API client now requires a schema for every successful JSON response, validates nested order/user/profile/notification data and pagination, and accepts action acknowledgements only when success is true. An invalid checkout response retains the retry key until a valid order is returned. Malformed successful responses consistently produce the existing readable ApiError rather than a raw schema error or an undefined field.

Shared schemas now define response envelopes, pagination, available deliveries, user pages and notification pages; their TypeScript types are inferred. Existing order/profile field contracts remain authoritative. Regression tests cover malformed successes across 14 response paths and checkout-key reuse after a malformed response, a temporary outage and a successful retry. API fixtures use complete typed orders and authentication responses; unnecessary fixture assertions were removed. Query-library callback assertions remain confined to the typed cache boundary.

### Browser-storage follow-up

Two related authentication failures were also reproduced and fixed. When storage access or writes failed, each call generated a different device ID, causing new-device OTP verification to target another device. The client now keeps one in-memory device ID for the page while still preferring valid persisted IDs.

When storage was readable but could not be updated, routine synchronization replaced a valid in-memory login with an older saved snapshot, interrupting token refresh. Failed removals could similarly restore credentials after local sign-out. The session store now tracks a failed persistence operation and preserves its active state during routine reconciliation. Actual account storage events from another tab still reconcile sign-out, and successful later writes restore normal persistence. Six storage regressions cover the OTP read/write cases, refresh, local reconciliation, sign-out and cross-tab behavior; the cross-tab regression preserves an existing guarantee.

### R2. Evaluate further compiler policies in small migrations

**Priority: low.** `exactOptionalPropertyTypes` and broader `verbatimModuleSyntax` can make optional-value and type-only import intent more explicit. They require review of omitted versus explicitly undefined fields, shared exports and decorator metadata; they are not automatic correctness fixes. Tooling already uses verbatim module syntax. Nest/Mongoose property initialization remains a documented framework exception.

### R3. Review remaining warnings by behavior

**Priority: low.** Remaining warnings include sequential test/coordination loops, partial test doubles, serialization boundaries and React dependency/key suggestions. Do not hide them by lowering existing rules or parallelize dependent operations. Change a warning-producing site only with a clear invariant and focused verification. Raw before/after lint output is retained locally beside this report.

### R4. Retain deployment constraints as operational work

**Priority: before scaling.** Per-process socket/rate/account coordination still needs shared storage/coordination for multiple API instances. Live Gmail/SMTP deliverability, production TLS, backups and provider configuration require the deployment environment. Type correctness does not resolve those infrastructure requirements.

## Implementation guide

[TYPESCRIPT_GUIDE.md](../docs/TYPESCRIPT_GUIDE.md) records the resulting project conventions. No additional third-party skill package was installed; the existing project skills and current official package documentation were sufficient.

## Final publication review (2026-10-23)

**Priority: low, defense in depth. Fixed.** Two HTTP order mutation handlers still supplied fallback identities when the authenticated user was missing. Existing JWT and role guards already reject unauthorized HTTP requests; this review did not demonstrate a route authorization bypass. The handlers now independently reject a missing actor with UnauthorizedException before calling persistence and use the actual actor's ID, role and name. Two controller regressions first reproduced the fallback behavior, then verified rejection without a status or cancellation write. This follows [Nest's authenticated-request and UnauthorizedException pattern](https://docs.nestjs.com/security/authentication).

- The combined staged changes were reviewed against the recorded requirements, shared response contracts and existing ownership/role checks. All confirmed findings from these reviews are corrected; advisory maintenance and deployment requirements remain documented below.
- Updated the backend skill's gateway example to use the project's typed socket aliases, narrow handshake credentials and reject missing actors without an assertion. The example now matches the implemented authentication context and TypeScript guide.
- 297 source tests across 30 files and all 44 integration checks passed. Workspace/tooling types, source-language and locale policies, and the complete production build passed.
- The earlier Chrome runs passed 20 general and 16 profile/notification/receipt scenarios after the client/recovery changes. The final HTTP-only hardening was verified by the new controller tests and the full integration suite; no new UI or Lighthouse run was needed.
- Formatting passes across 251 files. Full lint reports zero errors and 183 advisory warnings across 220 files. The four additional warnings are the new controller test's deliberate partial-double assertions at its constructor boundary; application code has no new assertion or relaxed rule.
- All reviewed code, regressions and documentation are prepared for the user's explicitly requested staging, detailed commit and push to main. Local checks use synthetic accounts, isolated MongoDB and local SMTP.

## Review of the staged baseline (2026-10-23)

The next review preserved the user's staged baseline and reproduced additional failures at asynchronous account boundaries. The fixes below are included in the combined publication review above.

### OTP identity during changes from another tab

**Priority: low, reliability. Fixed.** A page reread the persisted device ID for every OTP submission. If another tab replaced that ID after sign-in requested a challenge, verification submitted a different identity and the server correctly rejected it. The page now caches its first validated/generated device ID. Two regressions cover removal and replacement of the persisted value during OTP entry.

### Reset-grant exchange after another verification

**Priority: medium, recovery integrity. Fixed.** Grant creation matched the challenge ID and any verified state. A delayed request could therefore use an older verified snapshot after a newer code was verified. Concurrent exchanges of one verified code could also return two grants, with the second replacing the first in storage.

The atomic exchange now matches the supplied code's hash, password-reset purpose, account/version, verification and send timestamps, unexpired state and absence of an existing grant. The service passes the already verified code to this internal exchange; plaintext codes are not stored. Real MongoDB regressions first reproduced both failures, then verified that the older exchange rejects, the current code still produces a usable grant and only one concurrent exchange succeeds. These failures require a verified recovery flow; the review did not demonstrate an unauthenticated account takeover.

### Registration cleanup after late SMTP failure

**Priority: medium, account availability. Fixed.** SMTP can deliver an email before its acknowledgement fails. Another verification request could activate the account while registration still waited. The error path then deleted that activated account. An isolated HTTP/MongoDB regression reproduced the deletion after a successful verification response.

Cleanup now deletes only an account that remains unverified. Its registration photo is discarded only when the account deletion actually succeeds, preserving media if the account was activated or storage cleanup failed. The HTTP regression confirms that the activated account and its issued session remain usable after the original registration reports the delivery error. Three unit cases cover pending, already activated and unavailable-cleanup paths.

### Registration photos before account activation

**Priority: low, moderation consistency. Fixed.** Background recovery queued photo reviews for unverified and disabled users and removed their registration-photo marker. A failed pending registration could consequently leave an orphaned review. The photo hook and recovery query now require an eligible account; the query also excludes ineligible records before applying its batch limit. Two integration cases observe real recovery intervals, confirm that inactive accounts retain their photo without a review, then verify that activation/enabling creates exactly one review.

### Verification of the staged-baseline review

- 295 source tests across 29 files passed. The final focused authentication/client run passed 64 cases after mock-factory cleanup. Five source cases were added in this review.
- 44 real MongoDB/HTTP/SMTP/Socket.IO/profile integration checks passed across two files, including five new concurrency/lifecycle cases. Each newly identified failure was reproduced before its implementation fix.
- The compiled app passed 20 general Chrome scenarios after the authentication fixes. All 16 profile/notification/receipt Chrome scenarios then passed after the photo-recovery guard, including the actual upload, approval and private-photo display flows.
- Workspace/tooling typechecks, the full production build, the final backend rebuild/typecheck, formatting across 250 files and Git whitespace checks passed. Full lint has zero errors and 179 advisory warnings across 219 files; no lint rule was weakened.
- Existing staged content was preserved. Review fixes and updated evidence were prepared in the working tree without creating a commit. Tests used isolated synthetic accounts, MongoDB and local SMTP; live Gmail delivery and deployment requirements remain outside this local verification. Lighthouse was not rerun.

## Earlier follow-up verification

- 290 source tests across 29 files passed, including 21 new regressions; 66 focused API/session/cart/language checks passed before the full suite.
- 39 isolated MongoDB/HTTP/SMTP/Socket.IO integration checks passed. They include order ownership, courier assignment, receipt authorization, profile approval and notification permissions.
- Workspace/tooling types, source and locale policies, the full production build and a subsequent frontend rebuild passed. Formatting passed across 250 files; Git whitespace checks passed.
- Full lint passed with zero errors and 178 advisory warnings across 219 files. The warnings remain documented maintenance work; no rule was lowered or disabled for these fixes.
- Both Chrome suites passed after response validation: 20 general scenarios and 16 profile/notification/receipt scenarios. All 20 general scenarios passed again after the final session-store change, including refresh cookies, sign-out recovery, OTP/password reset, checkout retry safety and courier/admin access. Chrome for Testing was restored into an ignored local cache after its temporary executable was removed; no application dependency changed.
- That follow-up prepared changes for inspection and did not create a commit. Live SMTP delivery, hosting and multiple-instance coordination remain operational requirements described above.

## Primary sources checked

- [TypeScript compiler options](https://www.typescriptlang.org/tsconfig/), including noEmitOnError, noImplicitReturns and noUncheckedSideEffectImports.
- [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) and [assertion limits](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions).
- [Socket.IO typed events/data](https://socket.io/docs/v4/typescript/) and [Server/socket APIs](https://socket.io/docs/v4/server-api/).
- [Nest execution contexts](https://docs.nestjs.com/fundamentals/execution-context).
- [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html) and [TypeScript directive policy](https://oxc.rs/docs/guide/usage/linter/rules/typescript/ban-ts-comment.html).
- [Node 24 TypeScript support](https://nodejs.org/docs/latest-v24.x/api/typescript.html) and [Zod runtime validation](https://zod.dev/basics).
- [Browser storage access and persistence failures](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
- [Mongoose atomic conditional updates](https://mongoosejs.com/docs/tutorials/findoneandupdate.html) and [OWASP recovery token requirements](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
