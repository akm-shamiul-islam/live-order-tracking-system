# KitchenToDoor transition source map

Reviewed 2026-10-23. Paths are relative to the original repository root; the portable skill does not depend on importing these modules.

| Source | What to inspect |
| --- | --- |
| `frontend/src/lib/pageTransition.ts` | Different-pathname guard, typed API detection, reduced motion, observed `ready` rejection and returned `updateCallbackDone` |
| `frontend/src/router.tsx` | Actual router commit hook, per-navigation disable flag, scroll restoration, lazy routes and pending/error components |
| `frontend/src/lib/appearanceTransition.ts` | Typed theme/language transition, synchronous React DOM flush and fallback update |
| `frontend/src/index.css` | `.route-page`, `page-content` snapshots, appearance/page keyframes, shell drawer motion, reduced-motion overrides |
| `frontend/src/App.tsx` | Persistent shell/provider placement and page wrapper |
| `frontend/src/hooks/useTheme.ts` | Requested theme and version guard prevent late toggles |
| `frontend/src/lib/i18n.ts` | Lazy Japanese bundle, language request version and appearance commit |
| `frontend/src/components/layout/Navbar.tsx` | Navigation preloads on intent; stable header and drawer |

The source uses React 19.3.1 and TanStack Router 1.170.45; these are not prerequisites for the behavior. Native snapshots implement navigation/appearance effects. The installed `motion/react` library is used for other UI motion and is not required to recreate these fades.

Existing verification: `frontend/src/lib/pageTransition.spec.ts`, `appearanceTransition.spec.ts`, `scripts/verify-browser.ts` and `documentation/docs/QUALITY.md`. Unit checks cover unsupported APIs, reduced motion, skipped snapshots and update failures; browser checks observe the animations and persistent shell.
