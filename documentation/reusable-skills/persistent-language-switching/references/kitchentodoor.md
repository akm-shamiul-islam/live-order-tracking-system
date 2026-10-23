# KitchenToDoor language source map

| Repository-relative source | Responsibility |
| --- | --- |
| `frontend/src/components/layout/LanguageSwitcher.tsx` | Compact EN/JA selector, busy status, failure panel and retry |
| `frontend/src/components/forms/ThemedSelect.tsx` | Keyboard/floating dropdown and shared visual treatment |
| `frontend/src/lib/i18n.ts` | Typed i18next selectors, English baseline, lazy Japanese bundle, request version, HTML language and storage |
| `frontend/src/lib/languagePreferences.ts` | Owner/epoch/choice checks, queued saves, pending intent, optional Web Locks, online/storage events |
| `frontend/src/lib/authSession.ts` | Monotonic languageVersion/profileVersion merge of delayed user snapshots |
| `frontend/src/locales/en.json`, `frontend/src/locales/ja.json` | UI, food and receipt copy with interpolation |
| `frontend/src/lib/dateTime.ts` | Reused locale-specific formatters |
| `shared/src/schemas/auth.schema.ts` | Language enum, strict preference body, versioned preference response and registration locale |
| `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts` | Authenticated preferences endpoint; account locale returned in session/profile flows |
| `scripts/check-locales.ts` | Key/interpolation/source-copy checks |

The source is a Vite SPA with i18next 26.5.5/react-i18next 17.1.2 and Zustand 5.0.16. The server saves language with an incrementing `languageVersion`; the local queue/intent logic prevents stale application of results. It is not a globally ordered collaboration protocol across every device.

The early initializer `frontend/src/theme.ts` sets HTML language and theme before React renders. `index.css` selects Japanese fonts via `:lang(ja)`. Existing users without language fields receive English/version 0 compatibility defaults.

Existing verification: `i18n.spec.ts`, `languagePreferences.spec.ts`, `authSession.spec.ts`, auth HTTP/integration tests and `scripts/verify-browser.ts`. Run `pnpm locales:check` when editing maintained copy. The portable skill is usable without the original scripts; reproduce their invariants in the receiving project.
