---
name: light-dark-appearance
description: Add a persistent light/dark appearance control with Sun/Moon icons, themed custom tooltip, early initialization, smooth whole-interface switching and accessible responsive placement.
---

# Light/dark appearance

Inspect the host's theme mechanism and design tokens before adding a control. Reuse existing surface, text, border, brand and focus colors in both modes. [The source map](references/kitchentodoor.md) shows the original behavior.

## Control and placement

- Place the button in a stable, visible header action group, following the target's navigation hierarchy. KitchenToDoor uses the top-right group: language, cart, theme, notifications, account. On narrow layouts retain the appearance action and usable spacing as other header copy collapses.
- Show **Moon while light** with “Switch to Dark Mode”; show **Sun while dark** with “Switch to Light Mode.” The icon and accessible name communicate the action. Use the project's icon family; Lucide `Sun`/`Moon` are the source examples. Mark decorative SVGs hidden from accessibility APIs.
- Use a rounded square button with a border, centered icon, consistent action dimensions, visible keyboard focus and hover background/border/text changes. The source is 40 px with a 20 px icon; adapt to the host's minimum touch-target policy.
- Add the host's custom tooltip on hover and keyboard focus, with collision handling, brief delay, Escape dismissal and theme-aware surface/contrast. The tooltip supplements the button's accessible name. If an icon tooltip is inside a native dialog, account for top-layer portal placement.

## Theme state and transition

1. Define supported choices and default. KitchenToDoor has `light | dark`, default light, device persistence under `ktd_theme`, and cross-tab storage synchronization. A system option is an optional host policy; if added, observe system changes only while that choice is active.
2. Apply a validated saved choice before the first visible render. Synchronize the root theme attribute/class, `color-scheme` and browser `theme-color` metadata. Catch unavailable storage and keep an in-memory functional control.
3. Keep theme state above route outlets. Update class/tokens and button state in one controlled commit. Capture the requested theme separately from the currently rendered theme and use an intent/version guard so rapid toggles cannot apply out of order.
4. Prefer a supported whole-interface browser view transition: feature-detect the API and typed selectors when used, then perform the update in its callback. KitchenToDoor fades old/new root snapshots over 220/260 ms and disables per-component color transitions during the snapshot to avoid uneven repainting.
5. Exclude named route-content snapshots during the appearance crossfade. Observe skipped `ready` errors, preserve actual update failures and use immediate updates when unsupported or reduced motion is requested. Do not delay state changes for a decorative timeout.
6. Listen for changes from other tabs and invalidate older pending local callbacks. Keep drafts, route, modal, cart and auth untouched by a theme commit.

## Framework/CSP adaptation

Tailwind v4 can map `.dark` via `@custom-variant`; KitchenToDoor configures it in CSS without a Tailwind config file. Preserve the receiving project's installed Tailwind version and existing configuration conventions. CSS variables, data attributes or another framework's theme provider can achieve the same outcome. Reuse the target's styling stack and theme mechanism.

For Next.js/server-rendered apps, choose a cookie-derived theme or a CSP-approved early initializer so server HTML and hydration agree. Access localStorage only in the browser. A narrow hydration suppression may be justified for a documented root attribute difference; it should not mask arbitrary mismatches. Keep the theme provider and action interactive client code, with the persistent shell in its existing layout.

## Configuration

**No feature environment variables, credentials or backend are required.** The default, palette, storage namespace and motion durations are code/design configuration. Existing CSP settings must allow the actual early initializer through a nonce/hash or external script policy; never add `unsafe-eval` for a theme toggle. KitchenToDoor compiles its TypeScript initializer and derives an exact CSP hash from the built HTML. Its `PUBLIC_APP_URL`/`SERVE_FRONTEND` settings belong to hosting, not to theme selection.

## Acceptance criteria

Verify direct reload before hydration, repeated toggles, route navigation, two tabs and denied localStorage. Test reduced motion and missing transition support. Check icon/label/tooltip agreement, keyboard focus/Escape, contrast for every state, browser chrome metadata and phone header bounds. Confirm forms and menus retain their state while switching.
