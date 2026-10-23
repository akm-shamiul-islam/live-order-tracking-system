# TypeScript best-practices and implementation audit

Date: 2026-10-23, Asia/Tokyo. Reviewed baseline: `1f6b235`, followed by the fixes described below. Installed compiler: TypeScript 7.0.2. Runtime: Node 24. Scope: backend, frontend, shared contracts, maintained scripts, compiler/lint configuration and the requested account/order workflows.

## Summary

The project already uses strict checking, shared Zod contracts, typed routes and TypeScript tooling. The review found concrete weaknesses in WebSocket actor handling, error-response decoding and legacy test mocks. They have been corrected. Additional compiler/lint checks now prevent several regressions.

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

Endpoint-specific success validation is still incomplete; see R1 below. The root envelope check is not presented as validation of every nested DTO field.

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

## Verification

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

### R1. Expand successful-response schemas when endpoint contracts change

**Priority: medium, incremental hardening.** Auth, preferences, profile and several other responses already have runtime schemas. Some order/user/history responses still rely on the generic HTTP decoder's declared type, and query-cache access includes assertions. Add shared response schemas and negative-payload tests while changing those contracts. Validate an endpoint at a time and keep browser/socket cache contracts synchronized.

### R2. Evaluate further compiler policies in small migrations

**Priority: low.** `exactOptionalPropertyTypes` and broader `verbatimModuleSyntax` can make optional-value and type-only import intent more explicit. They require review of omitted versus explicitly undefined fields, shared exports and decorator metadata; they are not automatic correctness fixes. Tooling already uses verbatim module syntax. Nest/Mongoose property initialization remains a documented framework exception.

### R3. Review remaining warnings by behavior

**Priority: low.** Remaining warnings include sequential test/coordination loops, partial test doubles, serialization boundaries and React dependency/key suggestions. Do not hide them by lowering existing rules or parallelize dependent operations. Change a warning-producing site only with a clear invariant and focused verification. Raw before/after lint output is retained locally beside this report.

### R4. Retain deployment constraints as operational work

**Priority: before scaling.** Per-process socket/rate/account coordination still needs shared storage/coordination for multiple API instances. Live Gmail/SMTP deliverability, production TLS, backups and provider configuration require the deployment environment. Type correctness does not resolve those infrastructure requirements.

## Implementation guide

[TYPESCRIPT_GUIDE.md](../docs/TYPESCRIPT_GUIDE.md) records the resulting project conventions. No additional third-party skill package was installed; the existing project skills and current official package documentation were sufficient.

## Primary sources checked

- [TypeScript compiler options](https://www.typescriptlang.org/tsconfig/), including noEmitOnError, noImplicitReturns and noUncheckedSideEffectImports.
- [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) and [assertion limits](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions).
- [Socket.IO typed events/data](https://socket.io/docs/v4/typescript/) and [Server/socket APIs](https://socket.io/docs/v4/server-api/).
- [Nest execution contexts](https://docs.nestjs.com/fundamentals/execution-context).
- [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html) and [TypeScript directive policy](https://oxc.rs/docs/guide/usage/linter/rules/typescript/ban-ts-comment.html).
- [Node 24 TypeScript support](https://nodejs.org/docs/latest-v24.x/api/typescript.html) and [Zod runtime validation](https://zod.dev/basics).
