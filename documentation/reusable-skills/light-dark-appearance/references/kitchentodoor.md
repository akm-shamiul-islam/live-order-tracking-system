# KitchenToDoor theme source map

| Repository-relative source | Responsibility |
| --- | --- |
| `frontend/src/hooks/useTheme.ts` | Saved/default state, requested/version guard, root class/meta update and cross-tab events |
| `frontend/src/theme.ts` | Early saved language/theme initialization with blocked-storage fallback |
| `frontend/index.html`, `frontend/vite.config.ts` | Initializer inclusion and compiled build integration |
| `frontend/src/components/layout/Navbar.tsx` | Sun/Moon button, action label, rounded-square shared styling and header placement |
| `frontend/src/components/ui/Tooltip.tsx` | Hover/focus/dismiss, offset/flip/shift, theme colors and dialog-aware portal |
| `frontend/src/lib/appearanceTransition.ts` | View-transition update and immediate/reduced-motion fallback |
| `frontend/src/index.css` | Root color-scheme, dark variant, root snapshot fades and reduced-motion overrides |
| `backend/src/common/frontend-hosting.ts`, `backend/src/bootstrap.ts` | Exact initializer CSP hash and built-page delivery |

Source palette examples include light `#f8fafc`, dark `#020617` for browser chrome and slate/teal controls. These are reference colors; map to the target design tokens. The theme remains a device preference; account-synced theme preferences are not implemented here.

Existing verification: `frontend/src/lib/appearanceTransition.spec.ts`, `scripts/verify-browser.ts`, `scripts/verify-profiles.ts` and `documentation/docs/QUALITY.md`. The browser checks inspect real root fades and pre-render restoration, in addition to reduced-motion/fallback paths.
