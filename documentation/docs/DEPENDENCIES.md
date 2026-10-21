# Dependency version audit

Registry metadata was checked on **2026-10-21 (Asia/Tokyo)** across all four workspace manifests. After removing the deprecated bcrypt types stub, there are **63 maintained packages across 74 declarations**. Of these, 62 use npm's latest stable release; `@types/node` uses the latest Node 24 release line to match the supported runtime.

The `^` prefix permits compatible newer versions; it does not mean the installed version equals the minimum shown in `package.json`. The lockfile and installed package metadata establish the version actually used. React 19.3.1 and Tailwind CSS 4.3.3 were already installed at their current stable versions; their README badges and lower dependency bounds were outdated.

## Installed package updates

| Package | Previous installed | Verified stable release |
| --- | --- | --- |
| `@tanstack/react-query` | 5.104.4 | 5.104.5 |
| `lucide-react` | 1.59.0 | 1.61.0 |
| `motion` | 12.43.0 | 14.5.0 |
| `oxfmt` | 0.73.0 | 0.74.0 |
| `oxlint` | 1.88.0 | 1.89.0 |
| `zod` | 3.25.76 | 4.6.7 |
| `vite` | 8.3.4 | 8.3.5 |

`@types/bcryptjs` 3.0.0 was removed because npm marks it as a deprecated stub and bcryptjs includes its own declarations. A current Vite development dependency was added at the root to provide the standalone Vitest runner with an explicit Vite peer.

## Complete current package list

Each release below was verified through the [npm registry](https://registry.npmjs.org/). Internal `workspace:*` links reference the shared local package. Indirect dependencies follow the versions supported by their owning packages.

| Package | Declared range | Installed target | Workspaces |
| --- | --- | --- | --- |
| [@fastify/cors](https://www.npmjs.com/package/@fastify/cors/v/11.3.1) | `^11.3.1` | 11.3.1 | backend |
| [@fastify/helmet](https://www.npmjs.com/package/@fastify/helmet/v/13.2.0) | `^13.2.0` | 13.2.0 | backend |
| [@fastify/static](https://www.npmjs.com/package/@fastify/static/v/10.1.6) | `^10.1.6` | 10.1.6 | backend |
| [@floating-ui/react](https://www.npmjs.com/package/@floating-ui/react/v/0.27.20) | `0.27.20` | 0.27.20 | frontend |
| [@nestjs/common](https://www.npmjs.com/package/@nestjs/common/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@nestjs/config](https://www.npmjs.com/package/@nestjs/config/v/12.0.1) | `^12.0.1` | 12.0.1 | backend |
| [@nestjs/core](https://www.npmjs.com/package/@nestjs/core/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@nestjs/jwt](https://www.npmjs.com/package/@nestjs/jwt/v/12.0.3) | `^12.0.3` | 12.0.3 | backend |
| [@nestjs/mongoose](https://www.npmjs.com/package/@nestjs/mongoose/v/12.0.0) | `^12.0.0` | 12.0.0 | backend |
| [@nestjs/passport](https://www.npmjs.com/package/@nestjs/passport/v/12.0.0) | `^12.0.0` | 12.0.0 | backend |
| [@nestjs/platform-express](https://www.npmjs.com/package/@nestjs/platform-express/v/12.2.0) | `12.2.0` | 12.2.0 | backend |
| [@nestjs/platform-fastify](https://www.npmjs.com/package/@nestjs/platform-fastify/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@nestjs/platform-socket.io](https://www.npmjs.com/package/@nestjs/platform-socket.io/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@nestjs/throttler](https://www.npmjs.com/package/@nestjs/throttler/v/6.7.1) | `^6.7.1` | 6.7.1 | backend |
| [@nestjs/websockets](https://www.npmjs.com/package/@nestjs/websockets/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite/v/4.3.3) | `^4.3.3` | 4.3.3 | frontend |
| [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query/v/5.104.5) | `^5.104.5` | 5.104.5 | frontend |
| [@tanstack/react-router](https://www.npmjs.com/package/@tanstack/react-router/v/1.170.45) | `^1.170.45` | 1.170.45 | frontend |
| [@types/autocannon](https://www.npmjs.com/package/@types/autocannon/v/7.12.7) | `^7.12.7` | 7.12.7 | root |
| [@types/node](https://www.npmjs.com/package/@types/node/v/24.19.2) | `^24.19.2` | 24.19.2 (Node 24) | root, backend |
| [@types/nodemailer](https://www.npmjs.com/package/@types/nodemailer/v/8.0.2) | `^8.0.2` | 8.0.2 | backend |
| [@types/passport-jwt](https://www.npmjs.com/package/@types/passport-jwt/v/4.0.1) | `^4.0.1` | 4.0.1 | backend |
| [@types/react](https://www.npmjs.com/package/@types/react/v/19.3.0) | `^19.3.0` | 19.3.0 | frontend |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom/v/19.3.0) | `^19.3.0` | 19.3.0 | frontend |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react/v/6.1.2) | `^6.1.2` | 6.1.2 | frontend |
| [autocannon](https://www.npmjs.com/package/autocannon/v/8.0.0) | `8.0.0` | 8.0.0 | backend |
| [bcryptjs](https://www.npmjs.com/package/bcryptjs/v/3.0.3) | `^3.0.3` | 3.0.3 | backend |
| [clsx](https://www.npmjs.com/package/clsx/v/2.1.1) | `^2.1.1` | 2.1.1 | frontend |
| [devtools-protocol](https://www.npmjs.com/package/devtools-protocol/v/0.0.1723477) | `0.0.1723477` | 0.0.1723477 | root |
| [dotenv](https://www.npmjs.com/package/dotenv/v/18.0.8) | `^18.0.8` | 18.0.8 | backend |
| [fastify](https://www.npmjs.com/package/fastify/v/5.12.7) | `^5.12.7` | 5.12.7 | backend |
| [helmet](https://www.npmjs.com/package/helmet/v/8.3.0) | `8.3.0` | 8.3.0 | backend |
| [husky](https://www.npmjs.com/package/husky/v/9.1.7) | `^9.1.7` | 9.1.7 | root |
| [i18next](https://www.npmjs.com/package/i18next/v/26.5.4) | `26.5.4` | 26.5.4 | frontend |
| [lighthouse](https://www.npmjs.com/package/lighthouse/v/13.5.0) | `^13.5.0` | 13.5.0 | root |
| [lint-staged](https://www.npmjs.com/package/lint-staged/v/17.6.0) | `^17.6.0` | 17.6.0 | root |
| [lucide-react](https://www.npmjs.com/package/lucide-react/v/1.61.0) | `^1.61.0` | 1.61.0 | frontend |
| [mongodb-memory-server](https://www.npmjs.com/package/mongodb-memory-server/v/11.3.0) | `11.3.0` | 11.3.0 | backend |
| [mongoose](https://www.npmjs.com/package/mongoose/v/9.11.2) | `^9.11.2` | 9.11.2 | backend |
| [motion](https://www.npmjs.com/package/motion/v/14.5.0) | `^14.5.0` | 14.5.0 | frontend |
| [nodemailer](https://www.npmjs.com/package/nodemailer/v/10.1.7) | `^10.1.7` | 10.1.7 | backend |
| [oxc-parser](https://www.npmjs.com/package/oxc-parser/v/0.155.0) | `0.155.0` | 0.155.0 | root |
| [oxfmt](https://www.npmjs.com/package/oxfmt/v/0.74.0) | `^0.74.0` | 0.74.0 | root |
| [oxlint](https://www.npmjs.com/package/oxlint/v/1.89.0) | `^1.89.0` | 1.89.0 | root |
| [oxlint-tsgolint](https://www.npmjs.com/package/oxlint-tsgolint/v/7.0.2004) | `^7.0.2004` | 7.0.2004 | root |
| [passport](https://www.npmjs.com/package/passport/v/0.7.0) | `^0.7.0` | 0.7.0 | backend |
| [passport-jwt](https://www.npmjs.com/package/passport-jwt/v/4.0.1) | `^4.0.1` | 4.0.1 | backend |
| [react](https://www.npmjs.com/package/react/v/19.3.1) | `^19.3.1` | 19.3.1 | frontend |
| [react-i18next](https://www.npmjs.com/package/react-i18next/v/17.1.0) | `17.1.0` | 17.1.0 | frontend |
| [react-dom](https://www.npmjs.com/package/react-dom/v/19.3.1) | `^19.3.1` | 19.3.1 | frontend |
| [reflect-metadata](https://www.npmjs.com/package/reflect-metadata/v/0.2.2) | `^0.2.2` | 0.2.2 | backend |
| [rxjs](https://www.npmjs.com/package/rxjs/v/7.8.2) | `^7.8.2` | 7.8.2 | backend |
| [socket.io](https://www.npmjs.com/package/socket.io/v/4.8.4) | `^4.8.4` | 4.8.4 | backend |
| [socket.io-client](https://www.npmjs.com/package/socket.io-client/v/4.8.4) | `^4.8.4` | 4.8.4 | backend, frontend |
| [tailwind-merge](https://www.npmjs.com/package/tailwind-merge/v/3.7.0) | `^3.7.0` | 3.7.0 | frontend |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss/v/4.3.3) | `^4.3.3` | 4.3.3 | frontend |
| [tsx](https://www.npmjs.com/package/tsx/v/4.23.15) | `^4.23.15` | 4.23.15 | backend |
| [typescript](https://www.npmjs.com/package/typescript/v/7.0.2) | `^7.0.2` | 7.0.2 | root, backend, frontend, shared |
| [vite](https://www.npmjs.com/package/vite/v/8.3.5) | `^8.3.5` | 8.3.5 | root, frontend |
| [vite-plus](https://www.npmjs.com/package/vite-plus/v/1.3.0) | `^1.3.0` | 1.3.0 | root |
| [vitest](https://www.npmjs.com/package/vitest/v/5.0.5) | `^5.0.5` | 5.0.5 | root, backend, frontend, shared |
| [zod](https://www.npmjs.com/package/zod/v/4.6.7) | `^4.6.7` | 4.6.7 | backend, frontend, shared |
| [zustand](https://www.npmjs.com/package/zustand/v/5.0.15) | `5.0.15` | 5.0.15 | frontend |

## Migration and compatibility notes

- **Zod 4.6.7:** Updated native enums to `z.enum`, email formats to `z.email` after trimming/normalization, removed the old `ZodSchema` alias, and read errors through `issues`. Numeric schemas retain finite-number validation because Zod 4 rejects infinity by default. Server field-error response paths and inline client validation are preserved. See the [Zod migration guide](https://zod.dev/v4/changelog).
- **Motion 14.5.0:** The follow-up npm check found 14.5.0 after the initial 14.4.0 update. Reviewed the [14.5.0 release](https://github.com/motiondivision/motion/releases/tag/v14.5.0), [upgrade guide](https://motion.dev/docs/react-upgrade-guide) and [LazyMotion API](https://motion.dev/docs/react-lazy-motion). Version 14 retains the public React APIs used here. Tracking uses native `m.div`, LazyMotion/domAnimation, reduced-motion handling and the documented motion/react-m entry point; no CSS-in-JS prop filtering integration is used.
- **Tooling:** Oxlint 1.89.0 and Oxfmt 0.74.0 are explicit root tools. The installed Vite+ release is 1.3.0 and bundles its own tool versions. Source scripts use the standalone tools described in the README.
- **Node:** The compatibility review corrected the initial Node 26 type upgrade to `@types/node` 24.19.2, the latest Node 24 types. The root `engines.node` declares `24.x`, matching the project runtime. DefinitelyTyped documents that declarations follow the corresponding library version. The dependency checker reports both the compatible target and the global npm latest version. See [DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped#versioning).
- **Known upstream peer warning:** `pnpm peers check` reports the Vite+ core alias version 1.3.0 against the Vite 6/7/8 peer ranges in its bundled Vitest 5.0.5 and `@vitest/mocker`. Vite+ documents the core alias in its [migration rules](https://viteplus.dev/guide/migrate-rules#vite-and-overrides), and the warning is tracked [upstream](https://github.com/voidzero-dev/vite-plus/issues/1101). The application and standalone runner resolve Vite 8.3.5.

## Localization and interface packages

| Package | Official documentation | Integration checked |
| --- | --- | --- |
| `i18next` 26.5.4 | [TypeScript selectors](https://www.i18next.com/overview/typescript), [configuration](https://www.i18next.com/overview/configuration-options) | Typed selector lookup, `ui`/`food` namespaces, matching interpolation, English fallback, JSON key separators disabled and on-demand Japanese resources. React escapes rendered values. |
| `react-i18next` 17.1.0 | [useTranslation](https://react.i18next.com/latest/usetranslation-hook) | Hook subscriptions update every translated component without remounting forms or resetting router/cart state. Initialization completes before mount. |
| `@floating-ui/react` 0.27.20 | [Tooltip](https://floating-ui.com/docs/tooltip), [ref merging](https://floating-ui.com/docs/react-utils#usemergerefs) | Hover/focus/Escape, ARIA descriptions, fixed positioning, offset/flip/shift, transition styles, mounted-only position updates and dialog-aware portals. Existing dropdown focus refs are merged through the documented hook. |
| `oxc-parser` 0.155.0 | [Parser API](https://oxc.rs/docs/guide/usage/parser.html) | `parseSync` parses TSX for the translation coverage gate; maintained tooling remains TypeScript and is checked separately. |

The follow-up registry check found [Vite 8.3.5](https://github.com/vitejs/vite/releases/tag/v8.3.5) and [Lucide 1.61.0](https://github.com/lucide-icons/lucide/releases/tag/1.61.0). Vite's build/HMR fixes preserve the documented `transformWithOxc`, proxy and plugin APIs used here. Lucide adds icons and retains the [named React component API](https://lucide.dev/guide/react). Both root/frontend Vite declarations and the frontend icon declaration were updated before browser verification.

A later check found i18next 26.5.4. Its [versioned maintainer changelog](https://github.com/i18next/i18next/blob/v26.5.4/CHANGELOG.md) fixes interpolation values containing placeholder syntax and non-string raw values; the typed selector/resource API remains supported. This patch was installed before the final type, source and browser checks.

## Repeat the check

```bash
pnpm deps:check
# Machine-readable output:
node scripts/check-dependencies.ts --json
```

The check reads the four maintained manifests, queries npm, and compares both installed versions and declared minimums. Node types follow the single-major runtime declared in the root `engines.node`; other packages follow npm latest. It returns a failing exit code for outdated, missing, or deprecated direct dependencies. Run it after installing dependencies. Latest-release checks need network access; the normal test and typecheck gates remain local.

Review migration notes before accepting a future major release. Regenerate the lockfile with pnpm, then run typecheck, tests, builds, formatting/lint, and relevant browser/runtime checks. See the [verification report](IMPLEMENTATION_AND_VERIFICATION_REPORT.md) for application verification.

## Upgrade verification

- `pnpm deps:check`: 63 packages across 74 declarations; all installed versions and declared minimums match their targets, with no deprecated direct packages. The Node 24 type target is reported explicitly.
- Typechecking, source/HTTP tests and production builds are recorded in the current verification report. The additional real MongoDB/Socket.IO and browser suites are separate commands.
- `pnpm lint`: zero errors, including the deprecated API rule; the existing warning backlog remains.
- `pnpm audit --json`: zero reported vulnerabilities across the resolved dependency tree.
- The expanded isolated production-browser suite drives customer registration/checkout/history, real HttpOnly refresh, admin user editing, courier requests/approval/status/GPS/cancellation, persistent navigation, loading/dark/responsive states, CSP/assets and Vite restart recovery. It creates and advances only synthetic test orders.

## Official documentation compatibility review

Reviewed the package APIs used by the application against current maintainer documentation and release notes on 2026-10-20. The installed-package upgrades and the packages whose minimum ranges were refreshed are covered below. Supported existing APIs remain valid; adopting optional new features is a product decision.

### Corrections from this review

- **Motion:** Added the documented global reduced-motion policy and disabled courier left/top interpolation when reduced motion is requested. CSS media rules alone did not control these JavaScript animations. Temporary browser fixtures confirm animated normal-mode movement, direct reduced-mode updates, and correct final positions in both modes.
- **Node types:** Replaced Node 26 declarations with the latest Node 24 declarations and declared the existing runtime target in `engines.node`. The version checker now reports compatible type targets alongside global npm latest versions.
- **Router/Zod:** Routes now accept Zod 4 schemas directly through Standard Schema. Explicit defaults preserve optional search inputs; `.catch()` still recovers from malformed URLs. Existing URL and history regressions pass without weakening their assertions.
- **Tooling:** Maintained code is TypeScript/TSX. The staged-file pattern is `*.{ts,tsx,mts,cts}`; workspace typechecking includes strict tool checks and a gate rejecting maintained JavaScript files. Formatter descriptions match the enabled configuration: import and Tailwind sorting require explicit options, which this configuration does not enable.

### Package evidence

| Packages | Official source | Usage and finding |
| --- | --- | --- |
| `motion` 14.5.0 | [Upgrade guide](https://motion.dev/docs/react-upgrade-guide), [MotionConfig](https://motion.dev/docs/react-motion-config), [accessibility](https://motion.dev/docs/react-accessibility) | Tracking now uses LazyMotion/domAnimation with motion/react-m, reduced-motion handling and spring interpolation. The menu does not load tracking animations. No CSS-in-JS prop filtering integration is used. |
| `zod` 4.6.7 | [Migration guide](https://zod.dev/v4/changelog), [schema API](https://zod.dev/api) | Checked issues, numeric bounds, defaults/transforms, coercion, enums, email normalization, refinements, and generic schema types. Existing field-error HTTP contracts and finite-value checks pass. |
| `@tanstack/react-query` 5.104.5 | [Patch release](https://github.com/TanStack/query/releases/tag/%40tanstack%2Freact-query%405.104.5), [QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient) | Uses object query options, immutable cache updates, invalidation/removal filters, and current `queryClient.query`. The patch's mutation-selector fix requires no migration in this app. |
| `lucide-react` 1.61.0 | [React guide](https://lucide.dev/guide/react), [release](https://github.com/lucide-icons/lucide/releases/tag/1.61.0) | Static named icon components and SVG props remain supported; imports compile and UI icons render. |
| `@types/node` 24.19.2 | [DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped#versioning), [Node releases](https://nodejs.org/en/about/previous-releases) | Corrected the type/runtime major mismatch. Node 24 LTS remains the supported runtime; the global Node 26 type release is reported separately. |
| `oxfmt` 0.74.0 | [Release](https://github.com/oxc-project/oxc/releases/tag/oxfmt_v0.74.0), [configuration](https://oxc.rs/docs/guide/usage/formatter/config.html), [sorting](https://oxc.rs/docs/guide/usage/formatter/sorting.html) | Current config keys and formatting commands work. Removed inaccurate claims that optional sorting was enabled. |
| `oxlint` 1.89.0, `oxlint-tsgolint` 7.0.2004 | [Release](https://github.com/oxc-project/oxc/releases/tag/oxlint_v1.89.0), [type-aware configuration](https://oxc.rs/docs/guide/usage/linter/type-aware.html) | Root `typeAware`/`typeCheck`, plugins, and the deprecated API rule match current configuration. Lint passes with zero errors; existing warnings remain. |
| `react`, `react-dom`, `@types/react`, `@types/react-dom` | [Current versions](https://react.dev/versions), [createRoot](https://react.dev/reference/react-dom/client/createRoot) | React/DOM 19.3.1 and React types 19.3.0 use a single client root, controlled forms, effect cleanup, and current submit event types. Browser checks show no runtime exceptions. |
| `tailwindcss`, `@tailwindcss/vite` | [Vite setup](https://tailwindcss.com/docs/installation/using-vite), [dark mode](https://tailwindcss.com/docs/dark-mode), [upgrade guide](https://tailwindcss.com/docs/upgrade-guide) | Matching 4.3.3 packages use the Vite plugin, CSS import, and selector-based dark variant. Production CSS builds successfully. |
| `@tanstack/react-router` | [Search parameter validation](https://tanstack.com/router/latest/docs/guide/search-params) | Native Zod 4 validation, typed links, defaults, URL state, lazy routes, and history pass regression checks. |
| `zustand` | [Official v5 migration](https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md) | Vanilla `createStore` plus `useStore` uses stable selectors for individual user/token values. No custom equality function, traditional entry point, or persist middleware migration is needed. |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-fastify`, `@nestjs/platform-socket.io`, `@nestjs/websockets` | [Nest 12 migration](https://docs.nestjs.com/migration-guide) | ESM builds, explicit injection, HTTP decorators, guards, gateway events, and supported Node runtime are compatible. Production bootstrap and HTTP/socket checks pass. |
| `@nestjs/config`, `dotenv` | [Custom environment validation](https://docs.nestjs.com/techniques/configuration), [dotenv parsing](https://github.com/motdotla/dotenv) | Custom validation remains supported in Config 12. Quoted secrets, root-file precedence, transformed defaults, and public pricing isolation are covered by tests. |
| `@nestjs/mongoose`, `mongoose` | [Mongoose 9 migration](https://mongoosejs.com/docs/migrating_to_9.html) | Reviewed current queries and schemas. Updates use `returnDocument`; no removed callback-style persistence or deprecated update options remain in application code. |
| `fastify`, `@fastify/cors`, `@fastify/helmet` | [Fastify 5 migration](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/), [CORS compatibility](https://github.com/fastify/fastify-cors#compatibility), [Helmet compatibility](https://github.com/fastify/fastify-helmet#compatibility) | Fastify 5.12.7 is supported by CORS 11 and Helmet 13. Native registration, configured origins, and Nest/Zod request handling are compatible. |
| `@nestjs/throttler` | [Maintainer guide](https://github.com/nestjs/throttler) | Uses named object options, millisecond windows, async settings, and an HTTP guard; configured login limits are exercised through HTTP tests. Socket limits remain a separate review issue. |
| `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@types/passport-jwt`, `bcryptjs` | [Nest authentication](https://docs.nestjs.com/security/authentication), [JWT strategy](https://github.com/mikenicholson/passport-jwt), [bcrypt API](https://github.com/dcodeIO/bcrypt.js) | Bearer extraction, expiration verification, signing options, async hash/compare, and bcrypt's 72-byte registration bound match current APIs. Built-in bcrypt declarations replace the deprecated stub. |
| `socket.io`, `socket.io-client` | [v4 migration](https://socket.io/docs/v4/migrating-from-3-x-to-4-0/), [listener lifecycle](https://socket.io/docs/v4/listening-to-events/) | Both ends use 4.8.4. Typed events, room broadcast chaining, authentication reconnects, timeouts, acknowledgments, and listener cleanup are supported. |
| `vite`, `@vitejs/plugin-react`, `vitest` | [Vite 8 migration](https://vite.dev/guide/migration), [React plugin](https://vite.dev/plugins/), [Vitest 5 migration](https://vitest.dev/guide/migration/) | No deprecated esbuild/Rollup options are configured. Standalone Vite 8 supplies Vitest's peer; source aliases, native TypeScript loading, and existing mock usage pass builds/tests. |
| `typescript`, `tsx` | [TypeScript 7 release](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [tsx TypeScript guide](https://tsx.hirok.io/typescript) | Uses the compiler CLI and modern module settings. Separate typechecking remains required; explicit Nest injection covers metadata omitted by the development runner. |
| `vite-plus` | [Migration rules](https://viteplus.dev/guide/migrate-rules) | Existing standalone scripts remain in use. Its bundled Vite-core alias produces the documented upstream peer warning; the app and root test runner build and run with Vite 8.3.5. |
| `husky`, `lint-staged` | [Husky setup](https://typicode.github.io/husky/get-started.html), [glob and task rules](https://github.com/lint-staged/lint-staged) | Prepare script and hooks use current commands. The TypeScript extension glob retains sequential lint/fix/format commands; pre-push includes the source-language and strict tooling gates. |
| `clsx`, `tailwind-merge` | [clsx usage](https://github.com/lukeed/clsx), [Tailwind compatibility](https://github.com/dcastil/tailwind-merge) | Installed utilities have no direct source imports. Tailwind merge 3.7 supports Tailwind 4.3; no application calls require migration. |
| `reflect-metadata`, `rxjs` | [Legacy decorator support](https://github.com/microsoft/reflect-metadata), [RxJS maintainer source](https://github.com/ReactiveX/rxjs/tree/7.8.2) | Metadata is imported before backend startup with compiler decorator options enabled. RxJS supplies the Nest peer; the application has no direct operator calls to migrate. |

The current verification results are recorded in [IMPLEMENTATION_AND_VERIFICATION_REPORT.md](IMPLEMENTATION_AND_VERIFICATION_REPORT.md). The upstream Vite+ peer warning remains. Live payment/geocoding/deployment choices are separate from package API compatibility.

## Packages added for verified runtime and measurement

| Package | Official documentation | Integration checked |
| --- | --- | --- |
| `@fastify/static` 10.1.6 | [Maintainer API](https://github.com/fastify/fastify-static) | Fastify 5 compatibility, setHeaders receives FastifyReply (`header`), preCompressed assets, safe SPA fallback and immutable hashed paths. |
| `nodemailer` 10.1.7 / `@types/nodemailer` 8.0.2 | [SMTP](https://nodemailer.com/smtp), [usage](https://nodemailer.com/usage) | SMTP transport, required STARTTLS/implicit TLS options, bounded timeouts, disabled file/URL access and awaited sendMail. Current maintained declarations compile; integration tests mock delivery. |
| `mongodb-memory-server` 11.3.0 | [API](https://typegoose.github.io/mongodb-memory-server/docs/api/classes/mongo-memory-server/) | Isolated fixtures, persistent stop/restart with start(true), cleanup and on-demand binary download. No development database mutations. |
| `lighthouse` 13.5.0 | [Maintainer API](https://github.com/GoogleChrome/lighthouse) | Compiled production app, isolated real browser/authentication, cold-cache mobile/desktop measurements and sanitized saved summaries. |
| Backend `socket.io-client` 4.8.4 | [TypeScript](https://socket.io/docs/v4/typescript/) | Public io/Socket imports replace ambient declarations; transports/on/once compile and real socket tests execute. |

### TypeScript tooling APIs

The root now declares `@types/node` 24.19.2 for its own scripts, `@types/autocannon` 7.12.7 for the maintained callback/result API and Chromium's `devtools-protocol` 0.0.1723477 for browser commands/events. These are development-only dependencies. [Native Node TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html) requires erasable syntax and explicit type imports; strict compiler checks run separately. Browser geolocation permission setup uses the current [Browser.setPermission command](https://chromedevtools.github.io/devtools-protocol/tot/Browser/#method-setPermission) instead of deprecated grantPermissions. The theme initializer uses [Vite transformWithOxc](https://vite.dev/guide/api-javascript.html#transformwithoxc), with no deprecated esbuild transform.

### Transitive dependency security fix

Autocannon 8 declares Hyperid 3, which included vulnerable UUID 8. The selective workspace override `autocannon>hyperid: 4.0.0` uses the latest upstream Hyperid release. Its [v4 release](https://github.com/mcollina/hyperid/releases/tag/v4.0.0) removes UUID while retaining the documented generator/decode API. This removes [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), instead of forcing an incompatible UUID export format. The override is separate from the 63 direct package inventory. The recorded `pnpm audit --json` check reports zero known advisories.

### CSP and current persistence options

[Zod maintainer guidance](https://github.com/colinhacks/zod/issues/4461) requires configuring jitless mode before constructing schemas. The shared browser Zod entry does so, preserving strict CSP without unsafe-eval. Refined status objects use [safeExtend](https://zod.dev/api#safeextend), preserving cancellation checks. MongoDB driver 7 uses the documented [journal write concern](https://mongodb.github.io/node-mongodb-native/7.0/interfaces/WriteConcernSettings.html); Mongoose 9 updates use returnDocument: after. Browser geolocation uses current [watchPosition/clearWatch](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition) with explicit consent and cleanup.
