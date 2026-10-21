# Verification commands

Run commands from the workspace root with Node 24 and pnpm 12.14.0. Build before browser checks or measurements.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:browser
pnpm audit:lighthouse
pnpm benchmark:throughput
pnpm deps:check
pnpm audit
pnpm lint
```

Run integration, browser, Lighthouse and throughput commands sequentially. Concurrent compilers, lint workers and MongoDB fixtures can exhaust a development machine and distort timings or cause connection timeouts.

## Source and integration tests

The source suite covers contracts, authentication through Nest HTTP, sessions, recovery, configuration, request errors, navigation and permissions. It also exercises late sign-in/refresh/logout races, retry keys surviving a lost response/reload, stale live events/HTTP snapshots and stable polling references. Integration tests use a separate mongodb-memory-server instance, actual HTTP and Socket.IO clients. They cover customer ownership, same-phone isolation, assignment contention, concurrent role/access changes, current authorization during passive broadcasts, cancellation, GPS freshness, refresh rotation/reuse, reset invalidation after account changes, auxiliary session cleanup failures, concurrent checkout retries, notification adapter failures, socket Origin/payload/flood limits and database stop/restart recovery with refresh-cookie preservation.

These commands do not mutate the development database. The first integration run may download a MongoDB binary into the temporary cache. Current verification totals are maintained in [the implementation report](IMPLEMENTATION_AND_VERIFICATION_REPORT.md).

## Browser workflow checks

`pnpm test:browser` launches its own browser profile, isolated MongoDB and compiled API. It drives registration, login, expired-access refresh through the real HttpOnly cookie, cart/checkout, customer history, admin user editing, courier requests/approval, assigned status updates, cancellation and consent-based GPS. Navigation checks include role-specific menus, direct URLs, persistent open/closed drawers, breadcrumbs, menu page sizes, full-width history, responsive layouts, focus containment, dark mode and reduced-motion preferences.

It also drops a checkout response after the server commits, retries checkout and checks that only one order exists. A failed sign-out clears local access, displays a warning and successfully retries server revocation. SPA/API/asset responses, CSP, Brotli/caching and an isolated Vite proxy during API interruption/restart are verified. Browser exceptions fail the check. Summary JSON is saved under documentation/quality; screenshots and detailed diagnostics stay in a temporary directory printed by the command. No password, access token or private test URL is written into committed summaries. Cleanup recognizes both normal exit codes and signal termination so it does not await an already exited child indefinitely.

Set CHROME_PATH to an installed Chrome/Chromium executable if needed. The helper detects common Chrome locations and its temporary Chrome for Testing cache. If none is available, install a browser or populate that cache; it does not attach to an existing browser or development server.

## Lighthouse

`pnpm audit:lighthouse` measures the built production application with compressed local photos/fonts. It audits the public menu on mobile/desktop, registration, authenticated orders/tracking, dispatch, Users and courier availability. Each navigation starts with a cold HTTP cache; localStorage/cookies retain the synthetic login and the user's dismissed drawer preference. The default-open drawer is verified separately by the workflow checks.

Mobile uses Lighthouse's standard simulated mobile settings. Desktop uses 1350×940, 40 ms RTT, 10 Mbps and 1× CPU. Run without other heavy workloads. LIGHTHOUSE_PAGES optionally selects comma-separated case names for diagnosis; omit it for the complete recorded run. LIGHTHOUSE_OUTPUT changes the summary destination. Full HTML/JSON reports are saved in a temporary directory; committed summaries omit sensitive URLs.

Private/account pages deliberately use noindex,nofollow. Their crawlability warning is expected and must not be removed to inflate SEO scores. Lighthouse cannot establish production TLS, infrastructure security, field performance or complete accessibility. Browser keyboard checks supplement its automated checks; assistive-technology testing and deployed monitoring remain relevant.

## Recorded Lighthouse results

Measured 2026-10-21T01:57:31.910Z with Chrome/155.0.8059.84 / Lighthouse 13.5.0.

| Page scenario | Performance | Accessibility | Best practices | SEO | LCP (s) | TBT (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| menu-mobile | 90 | 100 | 100 | 100 | 3.13 | 152 |
| menu-desktop | 100 | 100 | 100 | 100 | 0.68 | 0 |
| account-mobile | 91 | 100 | 100 | 60 | 2.76 | 224 |
| orders-mobile | 88 | 100 | 100 | 60 | 3.11 | 238 |
| tracking-mobile | 86 | 100 | 100 | 60 | 3.17 | 289 |
| dispatch-desktop | 99 | 100 | 100 | 60 | 0.75 | 0 |
| users-desktop | 100 | 100 | 100 | 60 | 0.68 | 0 |
| courier-mobile | 82 | 100 | 100 | 60 | 2.91 | 492 |

[Full summary](../quality/lighthouse-2026-10-21.json). All eight scenarios scored 100 for automated accessibility and best practices. Public menu SEO is 100; private SEO 60 reflects intentional noindex. Mobile performance is 82–91 and desktop performance is 99–100 in this local run. Remaining diagnostics include startup/unused JavaScript, some image sizing/compression opportunities, small desktop table layout shifts and active-socket back/forward-cache restrictions. These are recorded rather than claimed to be absent; deployed field measurements and further startup optimization remain useful. Run-to-run laptop timing variation is not evidence that a particular code change caused the score difference.

## Performance and security implementation

- Menu images use responsive local WebP variants, fixed dimensions and lazy loading; the hero is prioritized. Offscreen cards use content-visibility: auto with intrinsic sizing, preserving accessibility and rendering on scroll. See [browser guidance](https://web.dev/articles/content-visibility).
- Identical session checks preserve Zustand references; [locale formatters are reused](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString) across list rows and live updates. Customer tracking loads staff controls only when needed.
- Self-hosted fonts have licenses. Tracking animation and Socket.IO load after the initial UI can paint; HTTP polling/reconnection reconciles missed events.
- The early theme script is embedded at build time to prevent a theme flash without an extra blocking request. The API derives its exact SHA-256 CSP hash from the built HTML; unsafe-eval is not allowed. Rebuild frontend and backend together.
- API responses use no-store. Hashed static assets use immutable caching; HTML is not cached permanently.
- Server guards enforce owner/role/assignment checks independently of hidden navigation. Shared validation, rate/connection/payload limits, secure recovery/session handling and journaled atomic order writes are covered by tests.

[Throughput methodology](BENCHMARKS.md) is separate from browser rendering measurements. Live deployment, provider configuration and operating requirements are listed in [OPERATIONS.md](OPERATIONS.md).
