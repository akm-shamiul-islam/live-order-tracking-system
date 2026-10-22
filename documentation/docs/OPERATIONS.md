# Operations

## Build and start

Use Node 24 and pnpm 12.14.0. Install the lockfile and build all workspaces:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Configure the private environment: NODE_ENV=production, a reachable authenticated MONGODB_URI, a generated JWT_SECRET, SERVE_FRONTEND=true, HTTPS PUBLIC_APP_URL/FRONTEND_URL and AUTH_COOKIE_SECURE=true. The API serves the SPA, `/api` and `/socket.io` from one port. Preserve compiled shared/dist and frontend/dist alongside backend/dist.

On a fresh database, configure BOOTSTRAP_ADMIN_EMAIL/PASSWORD and run `pnpm auth:bootstrap-admin`. This explicit operator action refuses an existing administrator or occupied email. Remove the bootstrap password. Start with `pnpm --filter @kitchentodoor/backend start`; configure remaining customer/courier/admin roles through Users.

Production startup does not create public sample accounts. The development password-reset command refuses production. Do not run a Vite development server as the production host.

## TLS, proxy and supervision

Terminate TLS at the selected hosting service or reverse proxy. Forward `/socket.io` HTTP polling and WebSocket upgrades, preserve the browser Origin and use same-origin API paths. Serve all SPA routes through the application fallback; never rewrite unknown `/api` or asset responses into HTML.

Bind the API to an internal address when a trusted proxy fronts it. Do not trust arbitrary client-supplied forwarding headers. TRUSTED_PROXY_IPS defaults to empty, so client-supplied forwarding headers are ignored. Configure exact trusted proxy IPs (comma-separated, no broad trust-all rule). Both HTTP and sockets resolve client addresses through trusted forwarding hops; the socket resolver walks from the peer to the first untrusted hop. The edge must replace or correctly append X-Forwarded-For and the API should accept traffic only from that edge. Size connection budgets for the topology. The default per-IP socket connection cap is 20. Do not simply trust all forwarded IPs on a publicly reachable API.

Use the hosting platform's process supervisor/restart policy. Mark readiness only after MongoDB responds. Liveness should restart a dead/stuck process, not restart a healthy API repeatedly during a database outage. Enable graceful termination and route new traffic away before shutdown. No particular hosting account, TLS certificate or supervisor has been provisioned by this change.

## Health and monitoring

| Endpoint | Access | Meaning |
| --- | --- | --- |
| `/api/health/live` | Public | API process is responding. |
| `/api/health/ready` | Public | Bounded MongoDB ping succeeds; 503 during an outage. |
| `/api/ops/metrics` | Admin JWT | Handler counts/durations/failures, uptime and RSS; no tokens, addresses or customer lists. |

Monitor readiness, error ratios, latency, memory, disk and database connection/write health. Configure actual alert destinations with the selected platform. Socket packet/connection caps prevent bounded local abuse; they do not replace edge DDoS protection or shared budgets across instances.

## Backups and restore verification

Choose a database provider and retention policy before storing live customer information. Enable encrypted scheduled snapshots or MongoDB Database Tools backups with credentials kept in protected operator configuration. Backups contain addresses, password hashes and session data; restrict access and retention accordingly. Follow [MongoDB backup methods](https://www.mongodb.com/docs/manual/core/backups/).

A restore drill must target a separate database/instance, never the live URI. Verify order counts, canonical prices, embedded and legacy audit history, user roles/disabled state, and authenticated owner/assignment isolation. Review session invalidation after a restore and record the recovery time and data-loss window. Schedule periodic drills and alerts for failed backups.

The repository does not claim that a cloud backup schedule or production restore drill already exists. The isolated MongoDB integration test proves application outage recovery and durability of acknowledged test writes, not restoration of an actual production backup.

## Multiple instances

Run one API process with the current access/assignment coordinator. Before horizontal scaling or overlapping API processes during deployment, add a transaction-capable MongoDB topology and transactions, or an equivalent shared coordinator, for role/access edits and courier assignment. The process-local coordinator does not protect cross-process decisions. Also add shared HTTP/socket rate storage, a supported Socket.IO adapter/fanout and any polling-session affinity required by the chosen topology. Test reassignment, revocation and private broadcasts across instances. Current limits, connection counts and metrics are per process. See [MongoDB atomicity and transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/) and [Socket.IO deployment documentation](https://socket.io/docs/v4/using-multiple-nodes/).

## Incident checks

- Invalid development login: confirm quoted `#` credentials and database account identity; explicitly recover with `pnpm auth:reset-dev-admin` when intended.
- API unavailable: inspect readiness and MongoDB connectivity; queries fail with 503 instead of buffering indefinitely.
- Vite proxy warning: verify both development servers, PORT and API_PROXY_TARGET. Known restart failures are reported once until recovery; unexpected errors retain diagnostics.
- Refresh/sign-out failures: verify same Origin, cookie Secure/HTTPS settings and `/api/auth` proxy routing. Bodyless POST requests must not declare an empty JSON body.
- A refresh 503 preserves the browser cookie; retry after readiness recovers. A sign-out warning means this device is cleared but server revocation needs retry. Session cleanup warnings after a version increment do not make old credentials valid again.
- A live-notification warning means the persisted mutation succeeded; HTTP polling/reconnect refetches recover missed events. A durable outbox/notification queue would be needed for guaranteed event replay.
- Lost checkout response: retry with the original customer-scoped UUID key or check My Orders. Do not generate a new key for a transport retry. Production database permissions must allow creating the checkout unique index before traffic is accepted.
- Stale assignment or edit: refetch and retry the current record; do not overwrite another admin's changes.
- Lost device location: verify browser permission, HTTPS, assigned courier, OUT_FOR_DELIVERY stage and timestamp freshness.

Authenticated SMTP delivery must be configured before production startup; account verification, new-device sign-in and recovery depend on it. Gmail App Password setup is documented in [Configuration](CONFIGURATION.md#email-otp-and-gmail-smtp). For sustained production mail, use OAuth 2.0 or a transactional provider with delivery monitoring. Live payment, geocoding, deployment credentials/domain and operating-country choices still need configuration before those services can be validated.
