---
name: responsive-admin-tables
description: Build responsive management pages with breadcrumbs, title and description, filter/settings and search toolbars, configurable tables, status badges, icon tooltips and pagination that match an existing design system.
---

# Responsive admin tables

Inspect the target page shell, design tokens, list contracts and router before implementing. Reuse its components for inputs, dropdowns, dialogs and buttons. Read [the KitchenToDoor source map](references/kitchentodoor.md) for the layout examples.

## Page hierarchy

```text
Breadcrumbs
Page title + short description

[Filter fields] [Filter] [Settings]      [Search label + icon/input] [Search]

Table: bold centered headers
Rows: identity / content / amounts / colored status / created date + time / icon actions

[Items per page] [from–to of total]                  [First / Previous / pages / Next / Last]
```

Use a consistent vertical rhythm (KitchenToDoor often uses 24 px section gaps, 16–20 px toolbar padding and 16 px table cell padding). Adapt to the host's spacing scale; inherit its colors, fonts, radius, shadows, focus rings and density. Teal/slate is source branding, not a portable requirement.

## Toolbar and list state

- Breadcrumbs use semantic navigation, linked ancestors and `aria-current="page"`. Wrap long paths without causing page overflow. Keep one page heading and a concise explanatory paragraph beneath it.
- Keep filters + explicit Filter button + Settings together on the left. Place the labelled search icon/input/clear action + explicit Search button at the right on wide layouts. Align control bottoms/heights.
- Maintain **draft filter/search inputs** separately from **applied URL state**. Filter/Search applies the selected input, preserves other parameters and resets page to 1. Clearing a draft and applying it should be predictable; document whether a clear action also submits.
- Validate supported filters, query bounds, positive page and permitted sizes at the router and API. Store applied state in the URL for reload and Back/Forward; synchronize input drafts when applied URL state changes.
- Cache queries by all filters, search, page, size and private identity/role where relevant. Support loading skeletons, initial errors, background refresh indicators, no-results reset and per-row pending/error states.
- Server lists return bounded, deterministic pages and total metadata. Clamp/refetch an invalid page after filtering/deletion and replace the URL with the resolved page. Do not calculate global totals from one fetched page.

## Table and extensible settings

Use semantic `table`, `thead`, `tbody`, column headers and an accessible caption. Bold centered headers provide the source look; center statuses, timestamps, amounts and action groups. Allow long text/details to align left and wrap for readability. Use tabular numbers for amounts/dates.

Show Created date and time on separate lines in a semantic `<time datetime="ISO timestamp">`. The dispatch reference uses `YYYY/MM/DD` then 24-hour `HH:mm:ss` in browser time; other pages use locale formatting. Choose the target's locale/timezone policy explicitly and render an understandable fallback for invalid data.

Represent statuses with text plus distinct semantic color families for pending, active/success, disabled/danger and neutral states. Reuse host badge tokens in both themes; avoid relying solely on hue.

Define columns with stable typed IDs and labels. A Table Settings modal edits a **draft**; Save applies/persists, Cancel discards and Restore Defaults resets the draft. Validate stored IDs against the current allowlist; version and scope storage by account + table. Keep Actions available. Add later controls such as density/sort/width as typed settings with compatible defaults and migration, rather than embedding assumptions into the checkbox UI.

Action cells contain icon buttons/links with full accessible labels, row context where needed, pending/disabled handling and custom tooltips on hover **and keyboard focus**. Tooltip positioning must avoid viewport clipping, support Escape and portal within a native dialog when necessary. KitchenToDoor's tooltip uses offset/flip/shift, about 280 ms hover delay and a 140 ms entrance; adapt to the host motion system.

If an unavailable action still needs a focusable explanatory tooltip, use the host's accessible wrapper or `aria-disabled` with a guarded handler; a native disabled button cannot receive keyboard focus. The reference pagination uses `aria-disabled` and checks the condition in every handler. Never rely on styling or `aria-disabled` alone to prevent an operation.

## Pagination and responsive behavior

- Desktop footer: item-size selector and result range left, page controls right. Mark the active page with `aria-current`; disable or guard boundary actions. Display ellipses for omitted ranges. Empty results show `0–0 of 0` without invalid navigation.
- Reference management sizes are `10/25/50/100`; the menu uses `8/16/32/60`. Use the target product's sizes within its server cap and reset to page 1 on size changes.
- Stack/wrap toolbar groups as available content width decreases. Account for an open desktop sidebar: viewport width alone does not equal table width. Inputs use `min-width: 0`, flexible widths and full-width small-screen labels/fields.
- Contain wide tables in an `overflow-x: auto` region; keep overflow local instead of extending the entire page. Set sensible column minimums and wrap long content. Keep floating filters/tooltips out of clipping wrappers.
- On small screens, stack footer rows, keep size/range information and Previous/Next + page summary, and collapse extra numeric/first/last controls if needed. Dialogs fit dynamic viewport height and scroll internally; footers wrap.
- Keep touch targets usable, focus visible and reduced-motion support. Responsive cards can be an alternative when the host already uses them; preserve the same information and actions.

## Configuration

The UI needs **no secrets or feature environment variables**. The original backend's list settings are server-only: `ORDER_LIST_DEFAULT_LIMIT=50`, `ORDER_LIST_MAX_LIMIT=100`, `USER_LIST_DEFAULT_LIMIT=10`, `USER_LIST_MAX_LIMIT=100`. Defaults must not exceed caps; caps must allow offered page sizes. `VITE_ORDER_LIST_REFRESH_MS=15000` is an optional public refresh interval for live lists. API access uses the host's existing database/auth/origin configuration.

## Acceptance criteria

Verify URL reload/Back/Forward, separate drafts/apply, clear/search, page-size changes, out-of-range pages and empty/error/loading views. Verify column Save/Cancel/Restore Defaults, invalid storage and account isolation. Check date/time/timezone, long values, badge meaning, icon labels, keyboard tooltips and boundary pagination. Measure the finished layout on phones, tablets and 1024/1280/1600 px desktop widths with the sidebar open; wait for sidebar animation to settle before asserting bounds.
