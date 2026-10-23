# KitchenToDoor management-page source map

| Repository-relative source | What to reuse conceptually |
| --- | --- |
| `frontend/src/components/layout/Breadcrumbs.tsx` | Route/role-aware ancestors and accessible current page |
| `frontend/src/components/admin/AdminOrdersTable.tsx` | Dispatch columns, centered headings/cells, multiline Created timestamp, badges and icon actions |
| `frontend/src/components/admin/DispatchFilters.tsx` | Explicit applied filters/search and responsive toolbar |
| `frontend/src/pages/UsersPage.tsx` | Management heading/description, role filters, right-aligned labelled search, edit/history actions |
| `frontend/src/components/admin/DispatchColumnSettings.tsx`, `frontend/src/components/admin/UserColumnSettings.tsx` | Typed column IDs, account-scoped versioned storage and draft Save/Cancel/Restore Defaults |
| `frontend/src/components/layout/Pagination.tsx` | Size/range at left, numbered controls at right, responsive page summary |
| `frontend/src/components/ui/IconAction.tsx`, `frontend/src/components/ui/Tooltip.tsx` | Accessible icon actions and collision-aware, themed focus/hover tooltips |
| `frontend/src/lib/listSearch.ts`, `frontend/src/router.tsx` | Validated URL search state and omitted default params |
| `frontend/src/lib/dateTime.ts`, `frontend/src/lib/orderStatusBadge.ts` | Cached locale formatters and status color families |
| `shared/src/pagination.ts`, `shared/src/schemas/user.schema.ts` | Bounded list contracts |

The Users settings key is `ktd_users_columns_v1:<account-id>`. Unknown saved column IDs are filtered; Actions stay visible even with no optional columns selected. Settings are stored per administrator **on that browser**, not synchronized to an account database.

The original custom tooltip portals into the closest native `<dialog>` so it remains visible in that dialog's top layer. Treat the receiving component library's portal/focus strategy as authoritative when adapting.

Existing verification: `scripts/verify-profiles.ts` checks desktop filter bounds, saved Users columns, centered cells and dialog sizes; `scripts/verify-browser.ts` checks navigation, pagination and drawer behavior. The responsive filter correction was validated after the drawer animation completed, when the final available width was known.
