# KitchenToDoor authentication source map

| Repository-relative source | Responsibility |
| --- | --- |
| `shared/src/schemas/auth.schema.ts` | Normalized email, customer-only registration, bcrypt byte bound, OTP and typed response schemas |
| `backend/src/auth/auth.service.ts` | Password compare/hash, issuing sessions/JWTs, refresh CAS/reuse, security-version checks and revocation |
| `backend/src/auth/auth.controller.ts` | HttpOnly/SameSite Strict cookie at `/api/auth`, origin checks, no-store and endpoint throttles |
| `backend/src/auth/strategies/jwt.strategy.ts`, `backend/src/auth/jwt.config.ts` | Passport JWT verification and required signing secret |
| `backend/src/auth/guards/`, `backend/src/auth/authenticated-context.ts` | HTTP/socket auth and role context |
| `backend/src/database/schemas/auth-session.schema.ts`, `backend/src/database/schemas/auth-challenge.schema.ts` | Hashed refresh/challenge material, expiry and hidden fields |
| `backend/src/common/account-access-coordinator.ts` | Process-local serialization of related account/assignment operations |
| `frontend/src/lib/api.ts` | Typed API parsing, cookie-operation serialization, in-flight refresh and captured-session checks |
| `frontend/src/lib/authSession.ts` | Explicit JavaScript-readable access-token persistence and cross-tab synchronization |
| `backend/src/bootstrap.ts`, `backend/src/common/cors.ts`, `backend/src/common/rate-limit.ts` | Helmet/CSP, exact origins and bounded local HTTP rate storage |

Current reference limitations: the access token is stored in localStorage; the JWT strategy shown does not explicitly configure issuer/audience/algorithm options; its typed claims are not a dedicated runtime claim schema. `validateSession` checks a persisted session when `sid` is present, retaining a compatibility path for signed claims without it. Newly issued tokens include `sid`; a new implementation should explicitly require and validate the intended claims. Absent Origin is permitted for non-browser clients, and the access coordinator/rate budgets are process-local. Evaluate storage, JWT policy and distributed controls for the receiving topology; do not infer that all attacks are prevented.

New passwords use the registration schema's minimum length and 72 UTF-8 byte maximum for registration, reset and profile changes. `LoginSchema.password` instead has a six-character minimum with no field-level maximum, while `UpdateProfileSchema.currentPassword` has a 200-character maximum. The HTTP body limit is a separate transport bound. The source therefore does not establish a uniform 72-byte credential-input policy; define and test that policy, including existing-account compatibility, in the receiving app.

The source supports email codes for account activation/new devices/password recovery. Password reset consumes a hashed single-use grant and clears trusted devices. The OTP and device hashes depend on `JWT_SECRET`; refresh/reset-grant hashes do not. Signing-key rotation alone therefore does not revoke all stored credentials. Delivery is asynchronous for reset requests and has no durable queue. The frontend places an OTP-issued reset grant in `/account/reset#token=...`; no email recovery link is sent. Email links require separate issuance, validation/exchange and replay controls; an existing reset form and token fragment do not establish that support.

Existing verification: `auth.service.spec.ts`, `auth-otp.service.spec.ts`, `auth.http.spec.ts`, `orders.integration.ts`, `profiles.integration.ts`, `api.spec.ts` and `authSession.spec.ts`. Tests cover session/race behavior; deployment infrastructure and an independent security assessment remain separate evidence.
