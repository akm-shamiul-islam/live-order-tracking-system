---
name: typed-socketio-realtime
description: Implement secure type-safe Socket.IO tracking or chat with runtime-validated events, current room authorization, bounded connections, acknowledgments, ordered cache updates and reconnect reconciliation.
---

# Typed Socket.IO realtime

Inspect the host's identity, persistence, event contracts, transport support and deployment topology first. Use [the reference map](references/kitchentodoor.md) to compare with the tracking implementation.

## Contracts and authorization

- Define separate client-to-server and server-to-client event interfaces, typed acknowledgment shapes and typed socket context. Socket.IO server generics use inbound then outbound interfaces; the browser client uses server events then client events. Derive payload types from runtime schemas where feasible.
- Treat every incoming payload as untrusted and parse it at runtime. Types provide developer checks; they cannot authenticate a remote sender. Validate IDs, enum values, lengths, coordinates, timestamps and maximum payload size.
- Send browser credentials through the authenticated handshake rather than URL query tokens. Verify signature/session/current account access at connection and on sensitive packets. The source permits a transport connection without a token but protects private joins/mutations and broadcasts; a private chat app can require auth for the whole namespace.
- Apply the exact allowed-origin policy at handshake admission for both polling and direct WebSocket connections. Socket.IO CORS controls browser HTTP polling; WebSocket connections need the corresponding admission check (`allowRequest` in the source). Choose an explicit missing-Origin policy for native/non-browser clients and keep authentication/resource checks independent: Origin can be supplied by a non-browser caller. See [Socket.IO's CORS and admission guidance](https://socket.io/docs/v4/handling-cors/).
- Join resource rooms only after a persisted membership/ownership/assignment check. Canonicalize room IDs on the server, cap subscriptions, and prevent clients from joining administrative rooms by naming them.
- Recheck passive recipients when permissions can change after joining. Remove stale memberships or disconnect revoked accounts. Current authorization matters for broadcasts even when a client sends no further messages.

## Writes, events and client state

1. Apply an authorized mutation through the same business service used by HTTP, with conditional atomic persistence and audit/history. Emit after successful persistence. A failed live broadcast must not convert a committed write into a failed operation.
2. Return a bounded acknowledgment `{ ok, error?, ...result }`; set a client ack timeout and a retry policy. A timeout leaves the persisted outcome unknown: refetch it or retry the same payload/operation ID through an idempotent server path. Do not advance to a new status or generate a new message ID solely because an acknowledgment was lost. An acknowledgment confirms the operation's defined outcome; it is not automatically a read receipt or delivery to every recipient.
3. Include stable resource ID and monotonic revision/event ID for state changes. Update the client cache in memory; discard older/equal events according to the event contract and deduplicate audit entries. Merge HTTP snapshots without overwriting a newer socket revision.
4. Rejoin authorized rooms after reconnect and refetch a durable snapshot/history. Retain polling/focus reconciliation where useful. Bound reconnect attempts/delay and show Connecting/Live/Offline states using host status colors and accessible labels.
5. Own one socket per browser session/provider where appropriate. Reconnect with updated credentials, clean listeners/rooms on unmount, dispose development HMR connections and clear private caches on account changes.

## Tracking-specific rules

Browser GPS requires consent and a secure context. Publish only for the assigned courier while the delivery is active. Stop sharing on unmount, reassignment, terminal status or revoked permission. Reject stale/future samples and invalid ranges, and ignore out-of-order timestamps. Interpolate map visuals using the host's motion/accessibility policy; display actual location age/connection state. Keep a demonstration simulator explicitly opt-in and separate from real location authority.

## Adapting to chat

Replace orders with persisted conversations and membership checks. Add typed `message:send`/`message:created` events with conversation ID, client-generated retry ID, canonical message ID and sequence/time. Enforce an actor/conversation retry constraint in storage, reject reuse of a retry ID with different content, write once, then acknowledge/broadcast. Fetch missed messages by cursor after reconnect. Add persisted read cursors for read receipts and bounded ephemeral typing/presence TTLs if the product needs them.

Authorize attachment access independently, escape/safely render message content, and bound message length/attachments/typing rate. A room name and online presence do not prove permission. Chat, typing and read receipts are adaptations; they are not features implemented in KitchenToDoor. Use the target's existing chat bubble, avatar, badge and theme tokens rather than copying tracking UI colors.

## Environment and deployment

Server settings stay private; `VITE_*` values are public build settings. These are source names/defaults to translate into the target configuration.

| Scope | Variables and defaults |
| --- | --- |
| Existing auth/storage | `JWT_SECRET`, `MONGODB_URI`, exact `FRONTEND_URL`; same session checks as HTTP |
| Trusted proxies | `TRUSTED_PROXY_IPS=` empty direct-access default |
| Packet budgets | `SOCKET_RATE_LIMIT_WINDOW_MS=1000`, `SOCKET_RATE_LIMIT_MAX=50`, `SOCKET_IP_RATE_LIMIT_MAX=200`, `SOCKET_RATE_LIMIT_IPS_MAX=10000` |
| Room/payload caps | `SOCKET_ORDER_ROOMS_MAX=20`, `SOCKET_MAX_PAYLOAD_BYTES=16384` |
| Handshake budgets | `SOCKET_CONNECT_WINDOW_MS=60000`, `SOCKET_CONNECT_MAX=30` |
| Concurrent sockets | `SOCKET_CONNECTIONS_MAX=2000`, `SOCKET_CONNECTIONS_PER_IP_MAX=20` |
| Tracking freshness | `TELEMETRY_MAX_AGE_MS=15000`, `TELEMETRY_MAX_FUTURE_MS=5000` |
| Browser acknowledgments | `VITE_SOCKET_ACK_TIMEOUT_MS=5000` |
| Browser reconnect | `VITE_SOCKET_RECONNECT_ATTEMPTS=15`, `VITE_SOCKET_RECONNECT_DELAY_MS=1000` |
| Browser heartbeat | `VITE_HEARTBEAT_INTERVAL_MS=4000`, `VITE_HEARTBEAT_TIMEOUT_MS=3000` |
| Browser reconciliation | `VITE_ORDER_LIST_REFRESH_MS=15000` |
| Browser GPS | `VITE_GPS_SEND_INTERVAL_MS=5000`, `VITE_GPS_TIMEOUT_MS=15000` |
| Optional demo only | `VITE_ENABLE_COURIER_SIMULATOR=false`, `VITE_SIMULATION_INTERVAL_MS=600`, `VITE_SIMULATION_STEP_PERCENT=5` |

The source browser connects to the same origin at `/socket.io`, with polling/websocket fallback; no extra socket URL secret is needed. Preserve proxy support for both transport paths and HTTPS/WSS. The limiter's IP packet budgets survive reconnects but are process-local. Before multiple instances, add a compatible shared adapter/budgets and the session affinity needed by the chosen polling topology; verify current [Socket.IO multi-node guidance](https://socket.io/docs/v4/using-multiple-nodes/).

Do not invent `REDIS_URL` or a provider token as an existing source variable. A distributed adapter is an extension whose configuration, credentials and failure behavior must be added explicitly. A durable event outbox is needed for guaranteed replay; room broadcasts alone do not provide it.

## Acceptance criteria

Test anonymous/invalid/expired credentials, unauthorized joins, stale memberships after reassignment/revocation and protected passive broadcasts. Test allowed/blocked origins for polling and direct WebSocket handshakes, the chosen missing-Origin policy and credential rejection even with an allowed Origin. Check malformed/oversized packets, floods, reconnect-based budget evasion, room/connection caps and timeouts. Exercise duplicate/out-of-order events, stale HTTP snapshots, lost acknowledgments, reconnect/refetch and post-commit broadcast failure. For chat, test retry deduplication and cross-conversation isolation; for tracking, test consent, timestamps, assignment and cleanup.
