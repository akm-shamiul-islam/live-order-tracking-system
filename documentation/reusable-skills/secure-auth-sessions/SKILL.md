---
name: secure-auth-sessions
description: Implement type-safe password authentication, JWT access tokens, rotating refresh-cookie sessions and current server-side authorization with revocation, rate limits and recovery boundaries.
---

# Secure auth sessions

Inspect the target identity provider, session topology and threat model before adding password authentication. Reuse an established provider where available. This skill extracts mechanisms from a bcryptjs/JWT implementation; it does not promise immunity from attacks. [The source map](references/kitchentodoor.md) identifies verified behavior and limitations.

## Credentials and typed boundaries

- Define runtime request/response schemas and derive DTOs from them. Parse `unknown` HTTP bodies, storage snapshots, socket messages and decoded token claims. Type annotations and generic `JSON.parse<T>` helpers cannot validate external data.
- Normalize email, bound inputs and allowlist mutable fields. Registration creates the ordinary user role; roles/account IDs supplied by public registration cannot grant privileges. Validate identity from the session at every protected boundary.
- Hash passwords asynchronously with a maintained implementation and calibrated work factor. KitchenToDoor uses bcryptjs 3.0.3 with cost 12 (10–15 configurable). Its registration, reset and proposed profile-password schemas reject new passwords beyond bcrypt's **72 UTF-8 byte** input limit. Login and current-password comparison have different validation bounds; do not infer that the source enforces the same limit at every credential endpoint. Define bounded credential inputs and an explicit compatibility policy in the target. Do not silently truncate Unicode passwords when setting them. For a new password system, evaluate Argon2id under [OWASP's password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); retain bcrypt where compatibility requires it and document the choice. Match the receiving project's password policy.
- Verify account activation and disabled status. The source uses email verification and a device-bound email challenge for new devices; a remembered device ID is an application convenience, not hardware attestation or phishing-resistant MFA.

## Session lifecycle

1. Issue a short-lived signed access JWT containing account ID, session ID and security version. Verify signature and expiration, runtime-validate claim shape, then load the current active account/session/version. Establish an allowed algorithm and issuer/audience policy appropriate to the target; these are explicit hardening choices, not controls to assume the source already configured.
2. Issue a cryptographically random opaque refresh token (source: 32 random bytes plus session ID). Store only its SHA-256 hash and bounded used-token history in the database, with absolute expiry and revocation state. Keep it in an HttpOnly cookie with Secure in HTTPS, an intentional SameSite policy and a narrow path.
3. Refresh through an atomic compare-and-swap of the current token hash. Rotate on success. Reuse of a recognized previous hash revokes the session; an arbitrary bad secret must not let an attacker revoke a session merely by knowing its ID. Check absolute expiry in application queries; background TTL deletion is cleanup only.
4. Serialize refresh/login/logout/reset mutations that share a cookie. Use an in-flight promise within a tab and an optional Web Lock/coordination mechanism across tabs. Before applying a late result, verify the original session/account still owns the operation.
5. Invalidate server sessions and increment the security version after password/email/role/access changes and logout according to product policy. A durable version increment remains the access check even if ancillary session-cleanup writes fail. Clear local state promptly, show server-revocation failure and provide retry when needed.
6. A temporary refresh outage must not erase a still-valid refresh cookie. Distinguish unauthorized credentials from transport/503 errors. A bounded access retry may follow successful refresh; never loop indefinitely.

Treat signing-key rotation and stored-credential revocation as separate operations. In this source, `JWT_SECRET` also keys OTP/device hashes, while opaque refresh tokens and reset grants use unkeyed SHA-256 hashes. Replacing the secret rejects old access signatures/codes and changes device matching, but surviving refresh credentials can issue tokens signed by the new key and existing reset grants can remain usable. For incident revocation, also invalidate affected account/session versions and recovery records; test each credential family explicitly.

## Browser storage and request security

KitchenToDoor stores its access token and account summary in localStorage and uses a rotating HttpOnly refresh cookie. LocalStorage is readable by injected JavaScript. For a new app, explicitly choose memory-only access tokens or a server/BFF session where suitable; HttpOnly refresh cookies do not make a JavaScript-readable access token XSS-proof.

For SSR/BFF apps, derive identity from each request's validated server session and keep mutable account state/private query caches request-scoped on the server. Initialize the browser provider with only authorized display data; keep server-held credentials out of hydration payloads. Browser storage restoration must preserve hydration consistency and identity isolation. The source is a browser SPA, so its module singletons are not an SSR session pattern. Follow the host's supported server/client and private-cache conventions.

Apply CSP, safe rendering, dependency maintenance, no-store on private/auth responses and token redaction in logs/errors/URLs. The source uses `@fastify/helmet`, exact Origin allowlists with `@fastify/cors`, `@nestjs/throttler`, Passport/JWT guards and separate socket limits. Cookie-authenticated mutations need a CSRF policy: validate allowed origins and SameSite behavior, and add anti-CSRF tokens when the host topology requires them. Re-evaluate cookies/credentials for cross-site deployments rather than copying a same-origin setup.

Use deny-by-default server role checks **and** resource owner/assignment checks. Hidden buttons, client roles, a tracking ID and membership in a socket room do not grant access. Recheck passive socket recipients after role changes or reassignment. Keep private query data isolated by identity and clear it on session changes.

## Environment

All values below are server-only except explicitly marked browser settings. Use placeholders in examples and validate required production values before startup.

| Setting | KitchenToDoor default / requirement |
| --- | --- |
| `MONGODB_URI` | Private reachable session/account database URI |
| `JWT_SECRET` | Required generated high-entropy secret; example generation: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `15m`, validated into signing seconds |
| `AUTH_SESSION_TTL_MS`, `AUTH_REFRESH_HISTORY_MAX` | `604800000` ms absolute lifetime, `1000` hashes |
| `AUTH_COOKIE_SECURE` | `false` for local HTTP example; `true` for deployed HTTPS |
| `PASSWORD_HASH_ROUNDS` | `12`, accepted 10–15 |
| `PUBLIC_APP_URL`, `FRONTEND_URL` | Canonical application URL and exact allowed origins; production HTTPS |
| `TRUSTED_PROXY_IPS` | Empty direct-access default; explicitly trusted proxy peers only |
| `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX` | `60000` ms, `120` requests |
| `LOGIN_RATE_LIMIT_TTL_MS`, `LOGIN_RATE_LIMIT_MAX` | `60000` ms, `10` |
| `REGISTER_RATE_LIMIT_TTL_MS`, `REGISTER_RATE_LIMIT_MAX` | `60000` ms, `5` |
| `REFRESH_RATE_LIMIT_MAX`, `RESET_RATE_LIMIT_MAX` | `30`, `5` per shared window |
| `AUTH_OTP_TTL_SECONDS`, `AUTH_OTP_RESEND_SECONDS`, `AUTH_OTP_MAX_ATTEMPTS` | `600`, `60`, `5`; lifetime exceeds resend delay |
| `AUTH_TRUSTED_DEVICES_MAX`, `OTP_REQUEST_RATE_LIMIT_MAX`, `OTP_VERIFY_RATE_LIMIT_MAX` | `20`, `5`, `10` |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Required together for verification/recovery; private SMTP credentials |
| `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS` | `587`, `false`, `true` for STARTTLS; 465 normally uses secure true |
| `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_SOCKET_TIMEOUT_MS`, `SMTP_FROM_NAME` | `10000`, `15000`, host brand display name |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Optional one-time operator provisioning; remove password after use |
| Public browser: `VITE_SESSION_STALE_TIME_MS`, `VITE_REQUEST_TIMEOUT_MS` | `60000`, `15000` ms; public build settings, never credentials |

Keep development seed credentials out of production. KitchenToDoor's `ADMIN_DEFAULT_*`/`COURIER_DEFAULT_*` create missing development staff only. If another app uses a managed provider, replace the relevant variables with that provider's documented server settings instead of adding unused JWT/SMTP secrets. Signing-key rotation and multi-instance shared revocation/limits require an explicit deployment design.

## Acceptance criteria

Test expired/malformed/forged JWTs, invalid claim types, inactive/disabled users, role injection, ownership isolation and current session/version checks. Check multibyte passwords at the byte boundary for registration/reset/profile changes and verify the chosen login/current-password compatibility policy. Exercise concurrent refresh, known-token reuse, random invalid refresh, logout/account-switch races, 503 recovery and security-change revocation. Verify cookie flags/path, CSRF/origin behavior, logs, rate limits, database outage and independent socket authorization. For SSR/BFF, test concurrent account requests, private-cache isolation and hydration without server credential disclosure. Review the chosen browser token storage exposure as part of the implementation result.
