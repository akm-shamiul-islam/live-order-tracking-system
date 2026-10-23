# KitchenToDoor notification source map

| Repository-relative source | Responsibility |
| --- | --- |
| `backend/src/database/schemas/profile-change.schema.ts` | Original/proposed snapshots, PENDING/APPLYING/final states, hidden hashes/versions, read/dismiss arrays, active-request unique index |
| `backend/src/profiles/profiles.service.ts` | Recipient scope, response allowlist, versioned read/dismiss, administrator validation, claim/apply/finalize, recovery worker |
| `backend/src/profiles/profiles.controller.ts` | `/api/profile`, `/api/notifications`, detail/read/dismiss/review endpoints with JWT and admin guards |
| `shared/src/schemas/profile.schema.ts` | Request, decision, query, read/dismiss and response contracts |
| `frontend/src/components/notifications/NotificationBell.tsx` | Count, bounded floating popover, polling/open/focus refresh and full-history link |
| `frontend/src/components/notifications/NotificationList.tsx` | Recipient-aware copy, status badges, bold unread text and icon actions |
| `frontend/src/components/notifications/ProfileChangeModal.tsx` | Old/new comparison, reviewer/time/feedback and decision confirmation |
| `frontend/src/pages/NotificationsPage.tsx` | Filter/search/pagination history view |
| `frontend/src/hooks/useNotificationActions.ts` | Version-aware cached read/dismiss updates and reconciliation |
| `frontend/src/components/auth/AuthSessionSync.tsx` | Cancels/removes private caches on identity changes |

The approval's resource update checks base profile version, current role and active access. `lastProfileChangeId` detects a write already applied before a crash; recovery finalizes without applying it twice. Public responses represent internal `APPLYING` as `PENDING`. This flow is a durable decision record, not cryptographic document signing.

Read/dismiss queries optionally match `expectedUpdatedAt` and use `{ timestamps: false }`. The current frontend supplies that timestamp; the API still accepts omitted timestamps for compatibility. A new API should require an event version when stale-click protection is part of its contract. Mark Unread removes that recipient from both `readBy` and `dismissedBy`. Final review preserves the reviewer as read, clears dismissal state and makes the decision unread for other recipients. Search escapes metacharacters and performs a literal-text match; the unread count is computed outside history filters.

The shared account coordinator is process-local. A target with multiple API instances needs database transactions or a shared coordination mechanism for cross-resource access/assignment decisions. Verify the host's database topology before copying the worker.

Existing verification: `backend/src/profiles/profiles.integration.ts`, `scripts/verify-profiles.ts`, `documentation/docs/QUALITY.md`. Registration-photo recovery, review contention, private photos, feedback, count/read/dismiss behavior and mobile dialogs are covered. Review this source map against current code when upgrading.
