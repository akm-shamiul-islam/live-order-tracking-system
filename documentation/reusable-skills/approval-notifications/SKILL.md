---
name: approval-notifications
description: Build durable in-app notifications for user requests and administrator approvals, including review feedback, per-recipient unread state, history and concurrency-safe decisions.
---

# Approval notifications

Use this for profile edits, access requests, document reviews or similar approval workflows. Inspect the host's identities, permissions, persistence and design system first. [KitchenToDoor's implementation map](references/kitchentodoor.md) provides evidence for the pattern.

## Lifecycle and verification

1. An authenticated requester submits validated proposed changes. Persist a request containing its owner, original/proposed snapshots, base resource version, creation/update timestamps and status. Preserve the active record until approval. Enforce one active request per resource when that is the product policy using a database constraint.
2. Administrators see authorized pending requests in their bell and full history page. The requester sees their own request and later decision. Server queries enforce this scope; clients cannot select an arbitrary recipient or reviewer.
3. The review dialog shows old/requested values, photo previews, status, timestamps, reviewer identity and feedback. Highlight changed old/new values with the host's danger/success tokens **and labels**, so color is not the sole indicator. Password changes display a boolean indicator, never a hash or plaintext.
4. Approval atomically claims the pending request and applies changes only against the expected resource version/current access. A successful decision records reviewer ID plus display identity, reviewed time and outcome. Rejection requires a trimmed, bounded explanation. A toast alone is insufficient evidence: fetch/show the persisted decision to both parties.
5. In a transactional database, commit the resource mutation, decision and notification together. KitchenToDoor uses durable `PENDING -> APPLYING -> APPROVED/REJECTED` recovery with an applied-request marker. If using that model, retry interrupted `APPLYING` work, detect a previously applied request and finalize once. Reject stale edits instead of overwriting newer data.
6. Finalizing a decision clears per-recipient read/dismiss state as appropriate so it reappears unread. Discard temporary password hashes after any final decision; approved security changes revoke affected sessions/recovery grants.

Here, “verification” means the server-authorized, durable reviewer decision and visible confirmation/history. Do not invent an additional admin OTP step unless the receiving project's policy requires step-up authentication.

## Bell, page and interaction design

- Place the bell in the existing header action group; KitchenToDoor puts it beside the appearance toggle. Use an accessible unread-count label and a capped visual badge such as `99+`.
- Show newest updates first with deterministic timestamp/ID ordering. Bold unread names/messages, add status badges, and keep notification text steady on hover. Give compact icon actions the shared hover/focus/tooltip treatment.
- Use a viewport-constrained popover, collision handling, focus management, Escape/outside dismissal, scrollable content and a “View all” footer. Respect host typography, spacing, radius, borders, shadows, colors and both appearance modes.
- Opening a notification marks that version read. Provide Mark Read/Unread and “Remove from Dropdown.” Dropdown removal marks it read/hides it for that recipient while retaining the full history. Model those as distinct operations, not global deletion.
- The full page has status filters, name/email/feedback search, pagination, loading/empty/error states and a review modal. Preserve keyboard access and readable mobile bounds.

## Durable read state and delivery

Use per-recipient read/dismiss records (or equivalent recipient arrays for bounded audiences). Send `expectedUpdatedAt` or an explicit event version with read/dismiss mutations. A stale click on the submitted request must not mark a newer decision read. Return a conflict and reconcile with durable state.

Keep the event version and sort timestamp unchanged by read/unread/dismiss actions. KitchenToDoor disables Mongoose timestamps for those writes; changing `updatedAt` for a read would reorder the event and invalidate other recipients' version checks. Store receipt timestamps separately if needed. Marking a dismissed item unread restores it to the dropdown. The bell's unread count covers all visible unread events for that account, independently of a history page's filters or pagination.

Refresh on open, focus and a configurable interval. Cancel older in-flight fetches before applying successful read-state changes to cached lists; invalidate counts, detail and other pages afterward. Scope cache keys by account and clear private queries on sign-out/account changes. Announce failures and permit retry.

KitchenToDoor delivers these notifications through authenticated HTTP polling; its order Socket.IO channel is separate. If adding push/SSE/WebSockets, persist before signaling, authorize recipients, deduplicate by ID/version and retain a refetch path. Guaranteed cross-service delivery needs a durable outbox/queue; setting a socket room does not provide it.

## Environment and infrastructure

KitchenToDoor names/defaults below are examples to map into the host's validated configuration. Server variables must not enter a public browser bundle.

| Scope | Setting | Default / requirement |
| --- | --- | --- |
| Server prerequisite | `MONGODB_URI`, `JWT_SECRET` | Private database URI and generated signing secret for its existing auth |
| Server origins | `FRONTEND_URL` | Exact allowed browser origins; local example `http://localhost:5173` |
| Server | `RATE_LIMIT_TTL_MS` | `60000` ms shared window |
| Server | `PROFILE_CHANGE_RATE_LIMIT_MAX` | `5` submissions per window |
| Server recovery | `PROFILE_RECOVERY_INTERVAL_MS`, `PROFILE_RECOVERY_BATCH_SIZE` | `15000` ms, `50` records per pass |
| Server photo review | `PROFILE_PHOTO_MAX_BYTES`, `PROFILE_PHOTO_MAX_PIXELS`, `PROFILE_PHOTO_SIZE` | `2000000`, `20000000`, `256` px |
| Server request bound | `HTTP_BODY_LIMIT_BYTES` | `4100000`, sufficient for permitted base64 photo + JSON |
| Browser public | `VITE_NOTIFICATIONS_POLL_MS` | `15000` ms; changing it needs a frontend rebuild |

No SMTP or push-provider credentials are required by the in-app notification feature. The original application's production startup separately requires SMTP for account verification. Preserve that distinction when extracting the feature. Another backend can use its existing SQL/document database, session mechanism and scheduler; rename public variables to the framework's convention only when genuinely needed.

## Acceptance criteria

Check requester/admin isolation, another user's ID, unauthorized reviews, required rejection feedback and public-response field allowlists. Test simultaneous approvals, approval/rejection contention, stale account edits and crash recovery between application/finalization. Verify read/unread counts across filters, unchanged event ordering after read/dismiss, stale-version actions, dismiss/reload/restore-unread/new decision, focus/open refresh, offline errors, account changes, keyboard use, themes and narrow screens.
