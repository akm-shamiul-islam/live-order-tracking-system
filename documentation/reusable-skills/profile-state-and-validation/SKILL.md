---
name: profile-state-and-validation
description: Implement persistent account and avatar presentation, validated profile forms, protected photo uploads, approval status, accessible errors and unsaved-draft protection across routes and dialogs.
---

# Profile state and validation

Inspect the host's account store, server cache, form validation, upload policy and design components. Keep the shared account, server profile and editable draft as separate state responsibilities. [The source map](references/kitchentodoor.md) explains the Zustand/Zod reference.

## State ownership and consistency

- Put the authenticated account summary in a store outside route components. KitchenToDoor uses vanilla Zustand `createStore` with `useStore(store, selector)`, explicit browser persistence and storage-event synchronization. In another app, use its existing store/context/session provider. Do not add Zustand just to match the source.
- Validate persisted summaries before restoring them. Retain stable references for equal snapshots, and reject older `profileVersion`/`languageVersion` values so a delayed session response cannot replace an updated name/photo/preference.
- Keep authoritative profile data in an account-keyed server cache. Derive header/dropdown avatars from the same profile record used by the editor, with a validated summary fallback. A private photo query includes the viewing account and photo ID in its cache key.
- Start a fresh edit from a current server revision. While editing, do not let focus/reconnect refetch replace the draft. Explicitly reconcile newer server state after save, review or conflict. Preserve dirty fields independently when background fetching or explicit cache invalidation can replace the server snapshot. A changed server revision must not silently remount/reinitialize an unsaved editor; prompt for reconciliation or retain a separately owned draft. The source's narrower focus/reconnect protection is described in the reference map.
- Cancel/remove private queries and close account-specific dialogs on logout or account/role changes. Check captured account/session identity before applying delayed upload/save results.

The source stores access JWTs in localStorage; that is JavaScript-readable and carries an XSS exposure. Choose the target's established session model explicitly; prefer server/BFF or memory + secure refresh-cookie designs when appropriate. Persisting profile display state does not require copying access-token storage.

## Server rendering and hydration

KitchenToDoor mounts a browser-only SPA. For Next.js or another SSR host, create account stores and private server query caches per request. Keep the browser store/cache stable within its provider lifetime. An account ID in a query key does not make a shared server cache request-isolated. See the official [Zustand Next.js guide](https://zustand.docs.pmnd.rs/learn/guides/nextjs) and [TanStack Query SSR guide](https://tanstack.com/query/latest/docs/framework/react/guides/ssr).

Initialize the server and first client render from the same authorized, safe profile snapshot, or render the same neutral state until browser restoration finishes. Read localStorage and attach storage listeners only in browser code. Server Components obtain identity from the server session; they must not read or mutate a shared browser account store. Keep personalized HTML/data out of shared public caches, and dehydrate only data the current viewer may receive. Preserve the host's server/client boundaries and reset browser state when identity changes.

## Form and draft behavior

1. Derive a typed profile contract from a runtime schema; repeat validation on the server. Zod's inferred output handles trimmed/normalized values. Reject unknown sensitive fields and derive owner/role from the authenticated request.
2. Show Full Name, Email Address and Phone Number in order. Use three columns on wide screens, two on tablets and one on phones; address spans the row. Email is read-only for self-editing in the reference policy. Password fields form a visually distinct group.
3. Keep input values/errors locally for the editor lifetime. Validate on blur, revalidate a previously invalid field while typing, and validate the whole schema at submit. Associate errors through `aria-invalid`/`aria-describedby`, keep an invalid border while focused, and focus the first relevant error. Map server field errors only to fields the form owns; give other failures a form-level message.
4. Password changes require current password, new password and matching confirmation. Use per-field visibility toggles with accessible labels/tooltips. Clear sensitive draft values on completion/discard/unmount; never put them in localStorage, URLs, analytics or the shared account summary.
5. Track dirty state against the initial snapshot, including photo selection/removal. Show Unsaved Changes and guard Cancel, Back, route navigation and Sign Out with Keep Editing/Discard choices. Reuse one outstanding confirmation promise to avoid stacked prompts. Use `beforeunload` only while dirty/saving; browsers control whether a native warning appears.
6. Tab focus and nested upload/review dialogs preserve a mounted draft. If navigation unmounts the editor, protect it with a guard or deliberately scoped in-memory draft store. Do not claim that unsaved drafts survive a forced reload or discard.
7. Send the expected profile revision. On a conflict, retain the draft and offer refresh/reconciliation; avoid silently overwriting another administrator's edit. Disable duplicate submits and announce pending/success/failure.

## Photo and review flow

Offer browse and drag/drop with JPEG/PNG/WebP guidance, configured byte limit, local preview, filename/size and Clear/Use Photo actions. Model `undefined` as unchanged, `null` as removal and a selected source as replacement. Client checks improve feedback; the server validates actual decoded format, bytes, pixels and animation, strips metadata and emits normalized raster bytes.

Keep photos private behind an authenticated, authorized endpoint, with `private, no-store` and `nosniff`. Use credentialed fetch to obtain display data; do not expose raw storage paths. Fall back to a profile icon if loading fails. Protect other users' pending photos.

Customers/couriers in the reference submit pending changes; admins can apply their own changes immediately. Keep active values until review, show a pending badge/request view and permit only the owner to preview a pending photo in their header. Approval/rejection refreshes the profile and notification caches. Successful password approval invalidates sessions and returns the user to sign-in. Adapt this review policy to the receiving product explicitly.

## Account dropdown and theming

Use the host's brand/surface/text/border/focus/status tokens. The reference uses a round avatar trigger with border/ring hover, a bounded right-aligned rounded panel showing photo/name/email/role, then Profile and Sign Out. Add subtle opacity/translate/scale entrance and shared hover feedback; honor reduced motion. Escape returns focus, outside click dismisses, and hidden content is inert. If using ARIA `menu`, implement its keyboard model; a labelled region of ordinary buttons can use normal tab order instead.

## Environment

| Scope | KitchenToDoor variable | Default / requirement |
| --- | --- | --- |
| Existing server | `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL` | Private DB/signing secret; exact allowed origins |
| Server validation | `PASSWORD_HASH_ROUNDS` | `12` (accepted range 10–15); proposed new bcrypt passwords limited to 72 UTF-8 bytes |
| Server upload | `PROFILE_PHOTO_MAX_BYTES`, `PROFILE_PHOTO_MAX_PIXELS`, `PROFILE_PHOTO_SIZE` | `2000000` bytes, `20000000` pixels, `256` output pixels |
| Server body | `HTTP_BODY_LIMIT_BYTES` | `4100000`; allow base64 expansion plus bounded fields |
| Server submit limit | `PROFILE_CHANGE_RATE_LIMIT_MAX`, `RATE_LIMIT_TTL_MS` | `5`, `60000` ms |
| Server recovery | `PROFILE_RECOVERY_INTERVAL_MS`, `PROFILE_RECOVERY_BATCH_SIZE` | `15000` ms, `50` |
| Browser public | `VITE_SESSION_STALE_TIME_MS`, `VITE_NOTIFICATIONS_POLL_MS` | `60000` ms, `15000` ms |

No avatar service key is required. Keep limits validated on the backend and expose only the safe photo limit needed by the uploader. The original app requires SMTP separately for production account flows; a profile editor should reuse the host's existing authentication configuration.

For these source settings, `PROFILE_PHOTO_MAX_BYTES` cannot exceed `3000000` and `PROFILE_PHOTO_SIZE` cannot exceed `1024`. Startup also requires `HTTP_BODY_LIMIT_BYTES >= ceil(PROFILE_PHOTO_MAX_BYTES / 3) * 4 + 65536` for the base64 image and JSON fields. Adjust the upload and transport limits together; increasing the browser's allowed file size alone cannot enable a larger upload.

## Acceptance criteria

Check avatar/name consistency after route changes, reload and approval; private-photo isolation; blocked storage; logout/account switch during a delayed response. Test invalid/mismatched passwords, server errors/focus, invalid/oversized/animated images and removal versus unchanged state. Exercise pending/approved/rejected flows, revision conflicts, nested dialogs, focus/reconnect and explicit cache invalidation with a newer revision during editing, every leave action, password cleanup, reduced motion, themes and phone/tablet/desktop layouts. For SSR, render concurrent requests for different accounts and verify isolated stores/caches, safe hydration and no other account's profile/avatar in serialized data or initial markup.
