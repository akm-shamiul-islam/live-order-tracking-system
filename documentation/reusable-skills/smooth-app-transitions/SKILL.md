---
name: smooth-app-transitions
description: Implement smooth route, language and theme transitions while preserving application state, persistent navigation and reduced-motion accessibility across web frameworks.
---

# Smooth app transitions

Reproduce a calm page fade and whole-interface language/theme crossfade. Inspect the target router's actual DOM commit lifecycle, rendering mode and browser support before choosing an adapter. Read [the source map](references/kitchentodoor.md) when comparing with KitchenToDoor.

## Behavior and design

- Keep the header, navigation, auth, cart and other shared providers mounted during route changes. Animate the page content region rather than keying the entire application by URL, language or theme.
- A different pathname fades the outgoing/incoming page; query-only filters, same-page actions and initial hydration do not need a page animation. Browser Back/Forward follow the same route behavior.
- A locale or theme change crossfades the whole interface once. Disable the named page snapshot during those appearance transitions so header/body colors and copy change together.
- Load the required locale bundle before committing the language. Preserve input values, focus, scroll policy and modal/draft state. A snapshot is visual feedback, not a state store.
- Start with the host's motion tokens. KitchenToDoor uses page exit **140 ms**, entry **220 ms**, appearance exit **220 ms**, entry **260 ms** and a `cubic-bezier(0.22, 1, 0.36, 1)` page entry. Treat these as reference timings; inherit the target palette and component surfaces.

## Implementation

1. Centralize a transition helper accepting an update callback and a transition kind. Feature-detect `document.startViewTransition`, typed transition selector support when used, and `prefers-reduced-motion`. If unsupported, execute the update immediately and exactly once.
2. Use a unique `view-transition-name` on the page wrapper. Style `::view-transition-old(...)` and `::view-transition-new(...)` with opacity animations. Neutralize browser-default root/group animations during page navigation so the persistent shell stays steady. The source uses normal blending and `object-fit: none; object-position: top left` on page snapshots to avoid scaling pages of different heights. Persistent shell elements must not receive the page name. Set the snapshot overlay to avoid swallowing clicks.
3. Wrap the router's **DOM commit**, not merely a link click or an asynchronous navigation request. Return `updateCallbackDone` to a router hook that expects the update promise. `ready` can reject when a snapshot is skipped; observe that rejection without converting a successful navigation into an application error. Preserve genuine update errors. Do not wait for the decorative animation's `finished` before declaring the route committed.
4. Theme/language helpers commit the actual UI update inside the snapshot callback. React's `flushSync` is appropriate for a controlled local synchronous update; use the receiving framework's supported commit/flush mechanism. For async rendering, wait for actual DOM readiness using its official integration.
5. Guard rapid choices with an intent/version counter: an older scheduled theme/language callback must not overwrite the newest choice. Observe skipped transition errors and keep navigation usable during repeated clicks.
6. Preserve route loading/error boundaries. Prefetch destinations on hover/focus when supported, show correctly sized skeletons and give retry actions. Do not introduce artificial delays to exhibit the animation.
7. Disable both snapshot animations and CSS hover/drawer motion for reduced-motion users. Limit scale/brightness hover feedback to devices that support hover; keep focus feedback available everywhere.

## Framework adapters

| Target | Adaptation |
| --- | --- |
| React + TanStack Router | Use a supported commit hook; KitchenToDoor assigns `router.startViewTransition` and respects the router's per-navigation disable flag. Verify the installed router API before copying. |
| Next.js App Router | Keep the shell in layouts and interactive preferences in client components. Check the installed Next.js/React transition integration. `document.startViewTransition(() => router.push(...))` alone does not establish that streamed content has committed; use a supported integration or an entry CSS fade. Never introduce an undocumented TanStack option into Next.js. |
| Vue/Nuxt, Svelte/SvelteKit, Angular | Use native router transition/commit hooks and the framework's DOM flush boundary; keep shared stores outside the transitioning outlet. |
| Server-rendered multi-page site | Consider supported same-origin cross-document view transitions with a reduced-motion fallback; preserve browser navigation semantics. |

Native browser view transitions and React's framework-level transition features have distinct integration requirements. Verify current APIs in [MDN's View Transition guide](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) and the target framework docs before choosing one.

## Configuration

**No feature-specific environment variables or secrets are required.** Durations, transition names and easing belong in design tokens/CSS. Existing API/proxy variables apply only to loading page data. Next.js initialization must avoid reading `window`, `document` or localStorage on the server; respect the site's CSP when initializing appearance before hydration.

## Acceptance criteria

Verify different routes, Back/Forward, same-page filter changes, rapid navigation, an aborted snapshot and a genuine failed update. Test language/theme changes with a dirty form and persistent cart, unsupported APIs and reduced motion. Observe real browser animations: the shell should remain mounted, text should stay legible, and page layout should not jump. Check mobile as well as desktop.
