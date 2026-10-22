# Environment configuration

Copy the root [.env.example](../../.env.example) to `.env`, configure MongoDB and generate a unique `JWT_SECRET`. Quote passwords containing `#`; an unquoted `#` starts a dotenv comment. Real secrets stay out of Git.

The API reads root `.env`, then `backend/.env` as fallback; process environment values take precedence. Zod validates settings before startup and reports setting names without echoing secrets. Restart the API after changes.

Vite reads root `.env`, `.env.local`, `.env.<mode>` and `.env.<mode>.local`; later files win, with process values first. Only the allowlisted `VITE_*` settings enter the browser bundle. Rebuild production assets when public settings change. See [Vite environment behavior](https://vite.dev/guide/env-and-mode).

## Ports and hosting

`PORT=5000` and `FRONTEND_PORT=5173` are development defaults. `API_PROXY_TARGET` optionally overrides the proxy target; otherwise Vite uses the configured API port. `FRONTEND_URL` is an exact comma-separated Origin allowlist for HTTP and WebSocket upgrades: include each real scheme/host/port, including localhost versus 127.0.0.1 when both are used.

`SERVE_FRONTEND=true` serves built `frontend/dist` from Fastify, including direct page URLs and `/socket.io`. Build first. `PUBLIC_APP_URL` controls the Content Security Policy's HTTPS upgrade behavior; use HTTPS in production, set the matching `FRONTEND_URL`, and set `AUTH_COOKIE_SECURE=true`. Hashed assets default to one-year immutable caching; HTML/theme initialization use no-store. Unknown API/assets remain 404 rather than receiving SPA HTML.

## Authentication and accounts

### Profile photos and review notifications

| Setting | Default | Purpose |
| --- | ---: | --- |
| `PROFILE_CHANGE_RATE_LIMIT_MAX` | `5` | Profile submissions per IP within `RATE_LIMIT_TTL_MS` |
| `PROFILE_PHOTO_MAX_BYTES` | `2000000` | Uploaded raster bytes; maximum supported protocol size is 3000000 bytes |
| `PROFILE_PHOTO_MAX_PIXELS` | `20000000` | Server image decode ceiling |
| `PROFILE_PHOTO_SIZE` | `256` | Square output size in pixels, at most 1024 |
| `HTTP_BODY_LIMIT_BYTES` | `4100000` | HTTP request limit; must accommodate the base64 photo plus JSON fields |
| `PROFILE_RECOVERY_INTERVAL_MS` | `15000` | Retry interrupted profile approvals and registration-photo review creation |
| `PROFILE_RECOVERY_BATCH_SIZE` | `50` | Maximum records recovered in each pass |
| `VITE_NOTIFICATIONS_POLL_MS` | `15000` | Browser notification refresh interval; also refreshes on open/focus |

`/api/config` exposes the photo byte limit alongside pricing. Photos are authenticated, private WebP responses; original filenames/metadata and raw uploaded files are not retained. JPEG/PNG/WebP inputs are normalized with Sharp 0.35.5. SVG, PDFs and animated uploads are rejected. A photo uploaded at registration remains pending until an administrator approves it.

Profile requests and notifications are durable MongoDB records. Rejection requires feedback. Password requests store only a bcrypt hash, never the current or proposed plaintext password; the pending hash is removed when a decision is finalized. Approved passwords invalidate existing sessions and recovery links.

### Sign-in, sessions and recovery

- `JWT_SECRET` is required. Generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- `JWT_EXPIRES_IN` defaults to `15m`. Accepts positive seconds or `s`, `m`, `h`, `d`, `w` suffixes; validated values become numeric seconds for JWT signing. Maximum: one year.
- `AUTH_SESSION_TTL_MS` defaults to seven days absolute lifetime. Refresh tokens are opaque, rotated and hashed. `AUTH_REFRESH_HISTORY_MAX` bounds remembered token hashes used to detect reuse.
- `AUTH_COOKIE_SECURE` defaults from the validated NODE_ENV when omitted. The example explicitly uses false for local HTTP; set true for deployed HTTPS. Cookies are HttpOnly, SameSite=Strict and scoped to `/api/auth`.
- `PASSWORD_HASH_ROUNDS` accepts 10–15, default 12. Registration accepts customer accounts only; admin role changes happen through Users.
- Development requires `ADMIN_DEFAULT_*` and `COURIER_DEFAULT_*` to create missing staff. Changes do not reset existing passwords. `pnpm auth:reset-dev-admin` explicitly restores only the configured existing administrator and invalidates its sessions.
- Production startup does not seed staff. After building, `pnpm auth:bootstrap-admin` creates an initial admin only with NODE_ENV=production, separate `BOOTSTRAP_ADMIN_EMAIL` and a 12+ character `BOOTSTRAP_ADMIN_PASSWORD` (maximum 72 bytes). It refuses an existing active admin or occupied email. Remove the bootstrap password afterward. Normal role/profile editing uses the admin Users page.

## Language and appearance

The interface supports `en` and `ja`; no environment secret or translation service is required. Maintain both JSON bundles under `frontend/src/locales/` and run `pnpm locales:check` after changing copy. The Japanese interface uses self-hosted Noto Sans JP Variable from Fontsource 5.3.1. The header dropdown writes `ktd_language` in localStorage. Registration includes the chosen language; an authenticated, strictly validated `PATCH /api/auth/preferences` saves only the caller's language to MongoDB and increments `languageVersion`. Existing accounts without these fields use `en`/0. No manual database migration is required.

Signing in restores the saved account language. An unsaved choice is retained locally under `ktd_language_pending`, scoped to its account, with a visible retry and automatic retry on reconnection. Theme remains a device preference in `ktd_theme`. Both appearance switches respect the operating system's reduced-motion setting. Locale changes translate interface/catalog copy and date formatting; they do not convert USD prices or translate customer-entered content.

## Email OTP and Gmail SMTP

Authenticated SMTP is required for public registration, sign-in verification from a new device and password recovery. Development can start without SMTP, but these flows return a configuration error; production startup requires authenticated SMTP. Existing accounts are treated as verified for migration, while new registrations remain inactive until their code is accepted.

The default code lifetime is `AUTH_OTP_TTL_SECONDS=600` (10 minutes), the resend delay is `AUTH_OTP_RESEND_SECONDS=60` (one minute), and `AUTH_OTP_MAX_ATTEMPTS=5` limits guesses per code. The lifetime must exceed the resend delay and cannot exceed one hour. `AUTH_TRUSTED_DEVICES_MAX=20` bounds remembered devices per account. `OTP_REQUEST_RATE_LIMIT_MAX` and `OTP_VERIFY_RATE_LIMIT_MAX` configure per-IP request and verification limits; both use `RATE_LIMIT_TTL_MS`. Codes are generated cryptographically, stored as keyed hashes and consumed once. Password-reset grants are hashed, single-use and invalidated by account security changes. Known and unknown reset addresses receive the same response structure. Reset email delivery is asynchronous and is not backed by a durable job queue.

### Gmail App Password setup

For local development and low-volume testing, Nodemailer supports Gmail SMTP with an App Password. Google requires 2-Step Verification before one can be created. This application currently supports SMTP username/password authentication; Nodemailer's OAuth 2.0 transport is not wired into the app configuration. If App Passwords are unavailable because of account policy or security settings, use an SMTP provider that supports username/password authentication or add OAuth 2.0 configuration before using Gmail. Gmail can rewrite a sender address that differs from the authenticated account and is not intended for production transactional volume. See [Google's App Password instructions](https://support.google.com/mail/answer/185833?hl=en) and [Nodemailer's Gmail guidance](https://nodemailer.com/guides/using-gmail).

1. Enable **2-Step Verification** on the Google account that will send mail.
2. Open the account's **App Passwords** page, create a password for Mail, and copy the generated 16-character value. It is separate from the normal Google password.
3. Keep the App Password private and set these values in the root `.env` file. Do not paste the password into chat, source code or a committed file:

   ```dotenv
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_REQUIRE_TLS=true
   SMTP_USER=your-address@gmail.com
   SMTP_PASSWORD=your-16-character-app-password
   SMTP_FROM=your-address@gmail.com
   SMTP_FROM_NAME=KitchenToDoor
   ```

4. Use the same Gmail address for `SMTP_USER` and `SMTP_FROM`, save `.env`, then restart the backend. Nodemailer uses `secure=false` on port 587 and upgrades with STARTTLS; port 465 uses `SMTP_SECURE=true`. See [Nodemailer's SMTP transport documentation](https://nodemailer.com/smtp).

Use mailbox addresses that you can access for any account that may need an OTP, including development admin and courier accounts. The sample `admin@kitchentodoor.io` and `courier@kitchentodoor.io` addresses are placeholders. Changing `ADMIN_DEFAULT_EMAIL` or `COURIER_DEFAULT_EMAIL` does not update an account that was already seeded; update existing staff emails while signed in, or configure the defaults before seeding a fresh database.

`SMTP_USER` and `SMTP_PASSWORD` must be set together. When SMTP is enabled, `SMTP_HOST`, `SMTP_FROM`, `SMTP_USER` and `SMTP_PASSWORD` are all required. The branded English/Japanese HTML and plain-text messages use `SMTP_FROM_NAME`. Never disable SMTP certificate checks. If delivery fails, check backend logs, Google account security activity, the App Password and outbound SMTP connectivity; logs do not include OTPs or mail credentials.

## Limits, lists and pricing

HTTP limits are per IP and handler, with stricter login/registration settings. Refresh, recovery and receipt downloads use their own maximums with RATE_LIMIT_TTL_MS. RECEIPT_RATE_LIMIT_MAX defaults to 10 requests per IP per rate window. UI retry messages use Retry-After. Socket settings bound packets per connection/IP, tracked IPs, handshake attempts, concurrent connections, rooms and payload bytes. IP packet budgets survive reconnects. TRUSTED_PROXY_IPS is empty by default; forwarded IPs are used only through exact explicitly trusted proxy addresses. State is process-local; deployment/proxy/scaling requirements are in [OPERATIONS.md](OPERATIONS.md).

ORDER_LIST_MAX_LIMIT and USER_LIST_MAX_LIMIT bound paginated APIs. UI sizes are 10/25/50/100; retain maximums of at least 100 to offer all four. Default limits cannot exceed their maximum. Delivery requests and user-management history have independent caps.

DELIVERY_FEE and TAX_RATE configure server pricing; `/api/config` exposes only public pricing. Totals are calculated in cents using canonical menu prices. Stored orders retain their original totals. Current prices use USD demonstration amounts; payment processing and jurisdiction-specific tax are not integrated.

PDF receipts are rendered by the API from the saved order prices. RECEIPT_TIME_ZONE accepts an IANA time zone and defaults to UTC; the chosen zone is printed with the timestamp. The build copies the canonical English/Japanese locale files and licensed Noto Sans JP font assets into the backend output. See [PDFCN/Forme](https://www.pdfcn.dev/docs/theming/forme), [Forme font registration](https://docs.formepdf.com/fonts), and [receipt font sources](../../backend/src/receipts/fonts/README.md).

KITCHEN_LATITUDE/LONGITUDE are fallback storage coordinates, not geocoding. The UI displays a delivery pin only when coordinates were actually supplied. Browser current-location attachment is optional and requires consent; real courier sharing is limited to their active assigned delivery. TELEMETRY_MAX_AGE_MS/FUTURE_MS reject stale samples. Device acquisition/send intervals are public VITE_GPS_* values. VITE_ENABLE_COURIER_SIMULATOR is an optional admin demonstration setting, disabled by default.

## Database and operations

MongoDB selection, socket, pool-wait and write timeouts are bounded. Queries do not buffer through outages; readiness fails and API reads return 503. Writes use majority plus journaling with MONGODB_WRITE_TIMEOUT_MS. RetryAttempts may be zero; other count/time settings are positive, except explicitly zero-capable query settings. DNS_SERVERS is empty by default, using system resolvers; configure only for a known resolver requirement.

HEALTHCHECK_TIMEOUT_MS bounds database readiness pings. `/api/health/live` is process liveness; `/api/health/ready` checks MongoDB. `/api/ops/metrics` requires an administrator. Monitor and supervise these as described in [OPERATIONS.md](OPERATIONS.md).

## Complete template inventory

The table below records template values, not deployed secrets. Optional commented SMTP/proxy entries are described above. Sources of truth are `.env.example`, `RuntimeSettingsSchema` and `ClientSettingsSchema`.

| Setting | Template value |
| --- | --- |
| `ADMIN_DEFAULT_EMAIL` | `admin@kitchentodoor.io` |
| `ADMIN_DEFAULT_PASSWORD` | Set privately |
| `API_HOST` | `0.0.0.0` |
| `API_PROXY_TARGET` | `http://127.0.0.1:5000` |
| `AUTH_COOKIE_SECURE` | `false` |
| `AUTH_OTP_MAX_ATTEMPTS` | `5` |
| `AUTH_OTP_RESEND_SECONDS` | `60` |
| `AUTH_OTP_TTL_SECONDS` | `600` |
| `AUTH_REFRESH_HISTORY_MAX` | `1000` |
| `AUTH_SESSION_TTL_MS` | `604800000` |
| `AUTH_TRUSTED_DEVICES_MAX` | `20` |
| `BOOTSTRAP_ADMIN_EMAIL` | Empty |
| `BOOTSTRAP_ADMIN_PASSWORD` | Set privately |
| `COURIER_DEFAULT_EMAIL` | `courier@kitchentodoor.io` |
| `COURIER_DEFAULT_PASSWORD` | Set privately |
| `DELIVERY_FEE` | `5` |
| `DELIVERY_REQUESTS_MAX` | `100` |
| `DNS_SERVERS` | Empty |
| `FRONTEND_PORT` | `5173` |
| `FRONTEND_URL` | `http://localhost:5173` |
| `HEALTHCHECK_TIMEOUT_MS` | `1000` |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_SECRET` | Set privately |
| `KITCHEN_LATITUDE` | `40.7128` |
| `KITCHEN_LONGITUDE` | `-74.006` |
| `LOGIN_RATE_LIMIT_MAX` | `10` |
| `LOGIN_RATE_LIMIT_TTL_MS` | `60000` |
| `MONGODB_HEARTBEAT_FREQUENCY_MS` | `10000` |
| `MONGODB_MAX_POOL_SIZE` | `100` |
| `MONGODB_RETRY_ATTEMPTS` | `1` |
| `MONGODB_RETRY_DELAY_MS` | `3000` |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `5000` |
| `MONGODB_SOCKET_TIMEOUT_MS` | `10000` |
| `MONGODB_URI` | `mongodb://localhost:27017/kitchentodoor_db` |
| `MONGODB_WAIT_QUEUE_TIMEOUT_MS` | `5000` |
| `MONGODB_WRITE_TIMEOUT_MS` | `5000` |
| `NODE_ENV` | `development` |
| `ORDER_ESTIMATE_MINUTES` | `35` |
| `ORDER_HISTORY_LIMIT` | `20` |
| `ORDER_LIST_DEFAULT_LIMIT` | `50` |
| `ORDER_LIST_MAX_LIMIT` | `100` |
| `ORDER_NUMBER_RETRY_ATTEMPTS` | `5` |
| `PASSWORD_HASH_ROUNDS` | Set privately |
| `PORT` | `5000` |
| `PUBLIC_APP_URL` | `http://localhost:5173` |
| `RATE_LIMIT_MAX` | `120` |
| `RATE_LIMIT_TTL_MS` | `60000` |
| `REFRESH_RATE_LIMIT_MAX` | `30` |
| `REGISTER_RATE_LIMIT_MAX` | `5` |
| `REGISTER_RATE_LIMIT_TTL_MS` | `60000` |
| `RECEIPT_RATE_LIMIT_MAX` | `10` |
| `RECEIPT_TIME_ZONE` | `UTC` |
| `RESET_RATE_LIMIT_MAX` | `5` |
| `OTP_REQUEST_RATE_LIMIT_MAX` | `5` |
| `OTP_VERIFY_RATE_LIMIT_MAX` | `10` |
| `SERVE_FRONTEND` | `false` |
| `SMTP_CONNECTION_TIMEOUT_MS` | `10000` |
| `SMTP_FROM` | Commented; use authenticated sender |
| `SMTP_FROM_NAME` | `KitchenToDoor` |
| `SMTP_HOST` | Commented; Gmail: `smtp.gmail.com` |
| `SMTP_PASSWORD` | Set privately in `.env` |
| `SMTP_PORT` | `587` |
| `SMTP_REQUIRE_TLS` | `true` |
| `SMTP_SECURE` | `false` |
| `SMTP_SOCKET_TIMEOUT_MS` | `15000` |
| `SMTP_USER` | Commented; Gmail account address |
| `SOCKET_CONNECT_MAX` | `30` |
| `SOCKET_CONNECT_WINDOW_MS` | `60000` |
| `SOCKET_CONNECTIONS_MAX` | `2000` |
| `SOCKET_CONNECTIONS_PER_IP_MAX` | `20` |
| `SOCKET_IP_RATE_LIMIT_MAX` | `200` |
| `SOCKET_MAX_PAYLOAD_BYTES` | `16384` |
| `SOCKET_ORDER_ROOMS_MAX` | `20` |
| `SOCKET_RATE_LIMIT_IPS_MAX` | `10000` |
| `SOCKET_RATE_LIMIT_MAX` | `50` |
| `SOCKET_RATE_LIMIT_WINDOW_MS` | `1000` |
| `STATIC_ASSET_MAX_AGE_SECONDS` | `3600` |
| `STATIC_HASHED_MAX_AGE_SECONDS` | `31536000` |
| `TAX_RATE` | `0.08` |
| `TELEMETRY_MAX_AGE_MS` | `15000` |
| `TELEMETRY_MAX_FUTURE_MS` | `5000` |
| `TRUSTED_PROXY_IPS` | Empty |
| `USER_LIST_DEFAULT_LIMIT` | `10` |
| `USER_LIST_MAX_LIMIT` | `100` |
| `USER_MANAGEMENT_AUDIT_MAX` | `100` |
| `VITE_ENABLE_COURIER_SIMULATOR` | `false` |
| `VITE_GPS_SEND_INTERVAL_MS` | `5000` |
| `VITE_GPS_TIMEOUT_MS` | `15000` |
| `VITE_HEARTBEAT_INTERVAL_MS` | `4000` |
| `VITE_HEARTBEAT_TIMEOUT_MS` | `3000` |
| `VITE_ORDER_LIST_REFRESH_MS` | `15000` |
| `VITE_QUERY_RETRY_COUNT` | `1` |
| `VITE_QUERY_STALE_TIME_MS` | `30000` |
| `VITE_REQUEST_TIMEOUT_MS` | `15000` |
| `VITE_SESSION_STALE_TIME_MS` | `60000` |
| `VITE_SIMULATION_INTERVAL_MS` | `600` |
| `VITE_SIMULATION_STEP_PERCENT` | `5` |
| `VITE_SOCKET_ACK_TIMEOUT_MS` | `5000` |
| `VITE_SOCKET_RECONNECT_ATTEMPTS` | `15` |
| `VITE_SOCKET_RECONNECT_DELAY_MS` | `1000` |
