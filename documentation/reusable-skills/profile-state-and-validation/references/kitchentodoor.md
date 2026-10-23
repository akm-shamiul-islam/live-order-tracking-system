# KitchenToDoor profile source map

| Repository-relative source | Responsibility |
| --- | --- |
| `frontend/src/lib/authSession.ts`, `frontend/src/hooks/useAuth.ts` | Vanilla Zustand identity, explicit persistence, stable selectors and monotonic summary merge |
| `frontend/src/main.tsx`, `frontend/src/lib/queryClient.ts` | Browser-only React root and shared browser query-client lifetime; SSR needs request-scoped server instances |
| `frontend/src/components/auth/AuthSessionSync.tsx` | Session refresh and private cache removal on identity changes |
| `frontend/src/pages/ProfilePage.tsx` | Shared profile query, current revision on mount, local form/photo draft and responsive fields |
| `frontend/src/hooks/useZodForm.ts` | Blur/submit validation, linked errors, first-invalid focus and server error filtering |
| `frontend/src/hooks/useUnsavedProfileChanges.ts` | Router/blocker, shared leave guard, one confirmation promise and unload warning |
| `frontend/src/components/layout/AppActionsContext.tsx` | Navigation/sign-out coordination with leave guards |
| `frontend/src/components/profile/ProfilePhotoUploader.tsx`, `frontend/src/components/profile/ProfileAvatar.tsx` | Source/null/undefined semantics, upload preview, account-keyed protected image query and fallback icon |
| `frontend/src/components/layout/AccountDropdown.tsx` | Header and panel avatar, pending-photo derivation, outside/Escape dismissal and inert hidden region |
| `backend/src/profiles/profiles.service.ts` | Sharp normalization, authorization, expected version, pending review and apply recovery |
| `shared/src/schemas/profile.schema.ts`, `shared/src/schemas/profile-photo.schema.ts` | Shared request/response/upload bounds |

Zustand owns session summaries; TanStack Query owns fetched profile/photo data; `useZodForm`/React state own drafts. Form drafts are not globally persisted. The header and editor deliberately disable background focus/reconnect profile replacement; a new editor fetches the current profile first.

The source's module-level account store and query client belong to a browser SPA. They do not establish SSR request isolation or hydration support. A receiving server-rendered app must choose request-scoped server state and a stable browser provider explicitly.

The source keys `ProfileForm` by account ID, profile version and pending-request ID. An explicit query invalidation that returns a changed version/pending ID therefore remounts that form and resets its local draft. Review dialogs invalidate the profile cache. Disabling focus/reconnect refetch does not cover every external update, and navigation leave guards do not intercept a query-driven remount. A target requiring draft preservation through those updates must retain the dirty draft separately or reconcile it before changing the editor identity.

The source's new-password policy uses 8+ characters and at most 72 UTF-8 bytes for registration/reset/profile changes. Existing-password inputs use different bounds: login has a six-character minimum and no field maximum; the profile PATCH current password has a 200-character maximum. Evaluate credential bounds and compatibility explicitly for the receiving product. Client schemas do not provide server authorization.

Profile password confirmation is checked by the editor; its PATCH contract sends only `currentPassword` and the proposed password alongside `expectedProfileVersion`. The server verifies the current password and proposed-password policy. Reset-password requests separately include and validate confirmation on the server. If a target also sends confirmation for profile edits, add it deliberately to that shared contract instead of assuming this endpoint already accepts it.

Existing verification: `authSession.spec.ts`, `backend/src/profiles/profiles.integration.ts` and `scripts/verify-profiles.ts` cover photo review, sensitive-field protection, draft preservation, Back/Cancel/Sign Out and tablet/mobile bounds.
