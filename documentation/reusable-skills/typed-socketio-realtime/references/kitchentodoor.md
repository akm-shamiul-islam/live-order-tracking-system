# KitchenToDoor realtime source map

| Repository-relative source | Responsibility |
| --- | --- |
| `shared/src/socket-events.ts` | Client/server events and acknowledgments |
| `shared/src/schemas/telemetry.schema.ts`, `shared/src/schemas/order.schema.ts` | Runtime coordinate/status/lookup validation |
| `backend/src/auth/authenticated-context.ts` | Typed Socket.IO server/socket/auth context |
| `backend/src/auth/guards/ws-jwt.guard.ts` | Current session revalidation for protected packets |
| `backend/src/orders/orders.gateway.ts` | Authorized joins, ack handlers, private recipient rechecks, post-commit delivery handling |
| `backend/src/orders/orders.service.ts` | Persisted ownership/assignment/status/GPS rules |
| `backend/src/common/socket-adapter.ts`, `backend/src/common/socket-rate-limiter.ts`, `backend/src/common/client-address.ts`, `backend/src/common/cors.ts` | Handshake origin policy, bounded connections/payloads, socket/IP packet budgets and proxy trust |
| `frontend/src/lib/socket.ts`, `frontend/src/hooks/useDeferredSocket.ts` | Session-owned connection, credential reconnection, HMR cleanup and deferred loading |
| `frontend/src/hooks/useOrderSocket.ts`, `frontend/src/hooks/useOrderListUpdates.ts` | Cache mutation, join/leave lifecycle, reconnect and polling reconciliation |
| `frontend/src/lib/orderCache.ts` | Revision-aware status/snapshot and timestamp-aware location merges |
| `frontend/src/components/tracking/CourierLocationSharing.tsx` | Consented active-assignment device GPS |

Actual events include `order:join`, `order:leave`, `order:update_status`, `order:cancel`, `courier:update_location`, `order:status_updated`, `order:cancelled`, `courier:location_updated`, `order:created`, `orders:changed`, `authenticated`, `ping` and `error`. Profile review notifications are a separate HTTP polling feature. Server handlers parse untrusted payloads; browser listeners currently rely on shared event types and cache merge guards rather than runtime schemas for every server event. Add explicit client-boundary parsing when the target's trust model requires it.

Socket.IO 4.8.4 is the reference version. Events/rooms are not a durable message queue. The source's authorized recipient enumeration is suitable for its current deployment; evaluate the cost and consistency of permission checks under the receiving product's expected fanout.

The gateway configures CORS, and `BoundedSocketAdapter.allowRequest` separately checks the same Origin allowlist before accepting handshakes, including direct WebSocket connections. `isAllowedOrigin` permits absent Origin for non-browser compatibility. This admission policy supplements the JWT/resource checks; it is not proof of client identity.

Existing verification: `orders.gateway.spec.ts`, `socket-rate-limiter.spec.ts`, `orders.integration.ts`, `frontend/src/lib/orderCache.spec.ts` and isolated browser GPS checks. The integration suite exercises passive authorization, payload/origin/flood limits, outages and missed-event recovery.
