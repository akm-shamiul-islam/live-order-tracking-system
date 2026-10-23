---
name: persistent-language-switching
description: Implement an accessible language selector with translated UI, locale-aware formatting, guest and account preferences, offline retry and preservation of route and form state in React, Next.js or other frameworks.
---

# Persistent language switching

Build the same language behavior using the receiving project's rendering and routing model. Inspect supported locales, existing translation tooling, authentication and design tokens. Read [the reference map](references/kitchentodoor.md) for the original implementation.

## Locale contract

- Define a finite supported locale union and validate values from browser storage, routes, cookies, APIs and accounts. KitchenToDoor uses `en | ja`, fallback `en`, and UI/catalog/receipt namespaces. Locale is distinct from currency and timezone.
- Maintain matching translation keys and interpolation variables across bundles. Include forms, errors, tooltips, accessible labels, statuses, empty/loading states, document titles and date/time copy. Keep identity fields, enum comparisons, form values and user-authored content independent of translated display text.
- Use locale-aware `Intl` formatters, cached by locale/options where lists render often. Choose currency/timezone explicitly from product policy. Japanese copy does not automatically convert USD prices or translate a delivery address.
- Set `<html lang>` at initialization and every change. Add `dir` only for locales that require it. Supply licensed fonts covering the actual scripts; account for longer labels and changed line wrapping.

## Preference and update workflow

1. Guests use a validated device preference with a safe in-memory fallback when storage is blocked. Initialize early enough to avoid the wrong-language flash. KitchenToDoor defaults to English rather than automatically using the browser locale; choose and document the host's policy.
2. Registration includes the selected locale. Signing in restores the account preference. An authenticated preferences endpoint derives the account from the session and accepts only the language field; reject role/account-ID injection.
3. Load the chosen bundle before committing copy. Reuse an in-flight import, clear a failed import promise for retry, and keep a coherent prior/fallback locale when loading fails.
4. Update the local interface immediately, preserve pathname/query/hash, cart, focused input and draft values, then save the account preference. Show loading/saving status and a visible retry if persistence fails. Preserve the local choice on a network failure.
5. Coalesce rapid saves and serialize writes where appropriate. Track account identity, session epoch and latest choice; discard stale responses after logout/account changes. Use a monotonic account preference version to prevent older profile/session responses from reverting the locale. Browser locks can coordinate tabs when available, with a functional fallback.
6. Store a pending save intent scoped to the account, with a unique intent ID. Retry on reconnection and synchronize tabs through storage events or the host's existing channel. Never replay account A's choice into account B. Do not promise a global last-writer ordering without server-side revision/conditional-write support.
7. Crossfade the interface through a central appearance helper only when supported and motion is allowed. Keep providers and forms mounted; do not key the application by locale to force a refresh.

## Selector design

Use the host's dropdown/popover component, semantic accent/surface/focus tokens, typography and spacing. A compact `EN / JA` option label is acceptable with a full accessible “Language” label and translated tooltip. Keep a stable header position and touch target, show a busy state, and announce saving/errors. Support keyboard navigation, selection, Escape, outside click and collision handling. Avoid flags as the sole language identifier.

## Framework adaptation

| Target | Implementation choice |
| --- | --- |
| React SPA | Keep i18n and preference state outside the route outlet. A singleton vanilla Zustand store and i18next are source examples; existing Context/store/i18n libraries can serve the same roles. |
| Next.js App Router | Decide between locale-prefixed routes and preference-only locale before coding. Resolve the server locale from validated route/cookie/account data, pass that same locale/messages into client providers, and avoid server reads of localStorage. A client dropdown updates the host's route or cookie/session mechanism. Preserve page identity, query/hash and drafts when replacing a locale segment; use explicit draft ownership if navigation remounts forms. Cache rendered data by locale and avoid sharing personal preferences through public caches. |
| Vue/Nuxt or SvelteKit | Use native locale providers, request-scoped server state and client hydration. Retain the preference/version/owner semantics with that framework's store. |

Declare locale precedence explicitly when introducing SSR or locale routes. A locale-prefixed URL must drive the locale of that response and its cache key; reconcile account/cookie preferences through the selected routing policy rather than rendering a different account locale at that URL. For preference-only routing, preserve the source's account-on-sign-in policy and account-scoped pending choices. Keep server and hydrated client locale consistent for the same request.

For Next.js routing choices, verify the installed version against the [official internationalization guide](https://nextjs.org/docs/app/guides/internationalization). API names and request interception conventions change; do not paste a middleware recipe from an unrelated version.

## Configuration

**No translation API key or feature environment variable is required.** Supported locales, fallback, bundles and storage key namespace belong in application configuration. KitchenToDoor uses `ktd_language` and account-scoped pending intent `ktd_language_pending`.

Account persistence uses its existing authenticated API (`PATCH /api/auth/preferences`) and server database/auth configuration (`MONGODB_URI`, private `JWT_SECRET`, allowed `FRONTEND_URL`). Do not add a second auth system to enable a locale selector. Vite's public prefix or Next.js `NEXT_PUBLIC_*` exposes values to clients; secrets never belong there. Translate a server-rendered host through its cookie/request configuration rather than inventing public locale secrets.

## Acceptance criteria

Verify guest reload, registration, account preference restoration, two tabs, blocked storage, offline retry and failed bundle loading. Exercise rapid selections and delayed responses after logout/account switching. Change language during an unsaved form and on a filtered paginated URL. Check all labels/errors, formatter locale, `html.lang`, long text, keyboard operation, mobile bounds, both themes and reduced motion. Include SSR/hydration and locale-specific cache tests when using Next.js or another server-rendered framework.
