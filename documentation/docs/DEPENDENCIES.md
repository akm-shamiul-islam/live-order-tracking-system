# Dependency version audit

Registry metadata was checked on **2026-10-20** across all four workspace manifests. After removing the deprecated bcrypt types stub, there are **49 maintained packages across 58 declarations**. Of these, 48 use npm's latest stable release; `@types/node` uses the latest Node 24 release line to match the supported runtime.

The `^` prefix permits compatible newer versions; it does not mean the installed version equals the minimum shown in `package.json`. The lockfile and installed package metadata establish the version actually used. React 19.3.1 and Tailwind CSS 4.3.3 were already installed at their current stable versions; their README badges and lower dependency bounds were outdated.

## Installed package updates

| Package | Previous installed | Verified stable release |
| --- | --- | --- |
| `@tanstack/react-query` | 5.104.4 | 5.104.5 |
| `lucide-react` | 1.59.0 | 1.60.0 |
| `motion` | 12.43.0 | 14.4.0 |
| `oxfmt` | 0.73.0 | 0.74.0 |
| `oxlint` | 1.88.0 | 1.89.0 |
| `zod` | 3.25.76 | 4.6.7 |

`@types/bcryptjs` 3.0.0 was removed because npm marks it as a deprecated stub and bcryptjs includes its own declarations. A current Vite development dependency was added at the root to provide the standalone Vitest runner with an explicit Vite peer.

## Complete current package list

Each release below was verified through the [npm registry](https://registry.npmjs.org/). Internal `workspace:*` links reference the shared local package. Indirect dependencies follow the versions supported by their owning packages.

| Package | Declared range | Installed target | Workspaces |
| --- | --- | --- | --- |
| [@fastify/cors](https://www.npmjs.com/package/@fastify/cors/v/11.3.1) | `^11.3.1` | 11.3.1 | backend |
| [@fastify/helmet](https://www.npmjs.com/package/@fastify/helmet/v/13.2.0) | `^13.2.0` | 13.2.0 | backend |
| [@nestjs/common](https://www.npmjs.com/package/@nestjs/common/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@nestjs/config](https://www.npmjs.com/package/@nestjs/config/v/12.0.1) | `^12.0.1` | 12.0.1 | backend |
| [@nestjs/core](https://www.npmjs.com/package/@nestjs/core/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@nestjs/jwt](https://www.npmjs.com/package/@nestjs/jwt/v/12.0.3) | `^12.0.3` | 12.0.3 | backend |
| [@nestjs/mongoose](https://www.npmjs.com/package/@nestjs/mongoose/v/12.0.0) | `^12.0.0` | 12.0.0 | backend |
| [@nestjs/passport](https://www.npmjs.com/package/@nestjs/passport/v/12.0.0) | `^12.0.0` | 12.0.0 | backend |
| [@nestjs/platform-fastify](https://www.npmjs.com/package/@nestjs/platform-fastify/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@nestjs/platform-socket.io](https://www.npmjs.com/package/@nestjs/platform-socket.io/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@nestjs/throttler](https://www.npmjs.com/package/@nestjs/throttler/v/6.7.1) | `^6.7.1` | 6.7.1 | backend |
| [@nestjs/websockets](https://www.npmjs.com/package/@nestjs/websockets/v/12.2.0) | `^12.2.0` | 12.2.0 | backend |
| [@tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite/v/4.3.3) | `^4.3.3` | 4.3.3 | frontend |
| [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query/v/5.104.5) | `^5.104.5` | 5.104.5 | frontend |
| [@tanstack/react-router](https://www.npmjs.com/package/@tanstack/react-router/v/1.170.45) | `^1.170.45` | 1.170.45 | frontend |
| [@types/node](https://www.npmjs.com/package/@types/node/v/24.19.2) | `^24.19.2` | 24.19.2 (Node 24) | backend |
| [@types/passport-jwt](https://www.npmjs.com/package/@types/passport-jwt/v/4.0.1) | `^4.0.1` | 4.0.1 | backend |
| [@types/react](https://www.npmjs.com/package/@types/react/v/19.3.0) | `^19.3.0` | 19.3.0 | frontend |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom/v/19.3.0) | `^19.3.0` | 19.3.0 | frontend |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react/v/6.1.2) | `^6.1.2` | 6.1.2 | frontend |
| [bcryptjs](https://www.npmjs.com/package/bcryptjs/v/3.0.3) | `^3.0.3` | 3.0.3 | backend |
| [clsx](https://www.npmjs.com/package/clsx/v/2.1.1) | `^2.1.1` | 2.1.1 | frontend |
| [dotenv](https://www.npmjs.com/package/dotenv/v/18.0.8) | `^18.0.8` | 18.0.8 | backend |
| [fastify](https://www.npmjs.com/package/fastify/v/5.12.7) | `^5.12.7` | 5.12.7 | backend |
| [husky](https://www.npmjs.com/package/husky/v/9.1.7) | `^9.1.7` | 9.1.7 | root |
| [lint-staged](https://www.npmjs.com/package/lint-staged/v/17.6.0) | `^17.6.0` | 17.6.0 | root |
| [lucide-react](https://www.npmjs.com/package/lucide-react/v/1.60.0) | `^1.60.0` | 1.60.0 | frontend |
| [mongoose](https://www.npmjs.com/package/mongoose/v/9.11.2) | `^9.11.2` | 9.11.2 | backend |
| [motion](https://www.npmjs.com/package/motion/v/14.4.0) | `^14.4.0` | 14.4.0 | frontend |
| [oxfmt](https://www.npmjs.com/package/oxfmt/v/0.74.0) | `^0.74.0` | 0.74.0 | root |
| [oxlint](https://www.npmjs.com/package/oxlint/v/1.89.0) | `^1.89.0` | 1.89.0 | root |
| [oxlint-tsgolint](https://www.npmjs.com/package/oxlint-tsgolint/v/7.0.2004) | `^7.0.2004` | 7.0.2004 | root |
| [passport](https://www.npmjs.com/package/passport/v/0.7.0) | `^0.7.0` | 0.7.0 | backend |
| [passport-jwt](https://www.npmjs.com/package/passport-jwt/v/4.0.1) | `^4.0.1` | 4.0.1 | backend |
| [react](https://www.npmjs.com/package/react/v/19.3.1) | `^19.3.1` | 19.3.1 | frontend |
| [react-dom](https://www.npmjs.com/package/react-dom/v/19.3.1) | `^19.3.1` | 19.3.1 | frontend |
| [reflect-metadata](https://www.npmjs.com/package/reflect-metadata/v/0.2.2) | `^0.2.2` | 0.2.2 | backend |
| [rxjs](https://www.npmjs.com/package/rxjs/v/7.8.2) | `^7.8.2` | 7.8.2 | backend |
| [socket.io](https://www.npmjs.com/package/socket.io/v/4.8.4) | `^4.8.4` | 4.8.4 | backend |
| [socket.io-client](https://www.npmjs.com/package/socket.io-client/v/4.8.4) | `^4.8.4` | 4.8.4 | frontend |
| [tailwind-merge](https://www.npmjs.com/package/tailwind-merge/v/3.7.0) | `^3.7.0` | 3.7.0 | frontend |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss/v/4.3.3) | `^4.3.3` | 4.3.3 | frontend |
| [tsx](https://www.npmjs.com/package/tsx/v/4.23.15) | `^4.23.15` | 4.23.15 | backend |
| [typescript](https://www.npmjs.com/package/typescript/v/7.0.2) | `^7.0.2` | 7.0.2 | root, backend, frontend, shared |
| [vite](https://www.npmjs.com/package/vite/v/8.3.4) | `^8.3.4` | 8.3.4 | root, frontend |
| [vite-plus](https://www.npmjs.com/package/vite-plus/v/1.3.0) | `^1.3.0` | 1.3.0 | root |
| [vitest](https://www.npmjs.com/package/vitest/v/5.0.5) | `^5.0.5` | 5.0.5 | root, backend, frontend, shared |
| [zod](https://www.npmjs.com/package/zod/v/4.6.7) | `^4.6.7` | 4.6.7 | backend, frontend, shared |
| [zustand](https://www.npmjs.com/package/zustand/v/5.0.15) | `5.0.15` | 5.0.15 | frontend |

## Migration and compatibility notes

- **Zod 4.6.7:** Updated native enums to `z.enum`, email formats to `z.email` after trimming/normalization, removed the old `ZodSchema` alias, and read errors through `issues`. Numeric schemas retain finite-number validation because Zod 4 rejects infinity by default. Server field-error response paths and inline client validation are preserved. See the [Zod migration guide](https://zod.dev/v4/changelog).
- **Motion 14.4.0:** Reviewed the [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide). Version 13 changes CSS-in-JS prop filtering; this app uses native `motion.div` elements. Version 14 retains the public React APIs used here.
- **Tooling:** Oxlint 1.89.0 and Oxfmt 0.74.0 are explicit root tools. The installed Vite+ release is 1.3.0 and bundles its own tool versions. Source scripts use the standalone tools described in the README.
- **Node:** The compatibility review corrected the initial Node 26 type upgrade to `@types/node` 24.19.2, the latest Node 24 types. The root `engines.node` declares `24.x`, matching the project runtime. DefinitelyTyped documents that declarations follow the corresponding library version. The dependency checker reports both the compatible target and the global npm latest version. See [DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped#versioning).
- **Known upstream peer warning:** `pnpm peers check` reports the Vite+ core alias version 1.3.0 against the Vite 6/7/8 peer ranges in its bundled Vitest 5.0.5 and `@vitest/mocker`. Vite+ documents the core alias in its [migration rules](https://viteplus.dev/guide/migrate-rules#vite-and-overrides), and the warning is tracked [upstream](https://github.com/voidzero-dev/vite-plus/issues/1101). The application and standalone runner resolve Vite 8.3.4.

## Repeat the check

```bash
pnpm deps:check
# Machine-readable output:
node scripts/check-dependencies.mjs --json
```

The check reads the four maintained manifests, queries npm, and compares both installed versions and declared minimums. Node types follow the single-major runtime declared in the root `engines.node`; other packages follow npm latest. It returns a failing exit code for outdated, missing, or deprecated direct dependencies. Run it after installing dependencies. Latest-release checks need network access; the normal test and typecheck gates remain local.

Review migration notes before accepting a future major release. Regenerate the lockfile with pnpm, then run typecheck, tests, builds, formatting/lint, and relevant browser/runtime checks. See the [verification report](IMPLEMENTATION_AND_VERIFICATION_REPORT.md) for application verification.

## Upgrade verification

- `pnpm deps:check`: 49 packages across 58 declarations; all installed versions and declared minimums match their targets, with no deprecated direct packages. The Node 24 type target is reported explicitly.
- `pnpm typecheck`, `pnpm test`, and `pnpm build`: passed, with 161 source tests across 15 suites.
- `pnpm lint`: zero errors, including the deprecated API rule; the existing warning backlog remains.
- `pnpm audit --json`: zero reported vulnerabilities across the resolved dependency tree.
- A compiled production API and frontend preview passed browser checks for real staff login with normalized email, red inline field errors and first-error focus, Motion tracking rendering, live sockets, and configured delivery/tax pricing. The check did not create or advance orders.

## Official documentation compatibility review

Reviewed the package APIs used by the application against current maintainer documentation and release notes on 2026-10-20. The installed-package upgrades and the packages whose minimum ranges were refreshed are covered below. Supported existing APIs remain valid; adopting optional new features is a product decision.

### Corrections from this review

- **Motion:** Added the documented global reduced-motion policy and disabled courier left/top interpolation when reduced motion is requested. CSS media rules alone did not control these JavaScript animations. Temporary browser fixtures confirm animated normal-mode movement, direct reduced-mode updates, and correct final positions in both modes.
- **Node types:** Replaced Node 26 declarations with the latest Node 24 declarations and declared the existing runtime target in `engines.node`. The version checker now reports compatible type targets alongside global npm latest versions.
- **Router/Zod:** Routes now accept Zod 4 schemas directly through Standard Schema. Explicit defaults preserve optional search inputs; `.catch()` still recovers from malformed URLs. Existing URL and history regressions pass without weakening their assertions.
- **Tooling:** The staged-file pattern now includes `.mjs`, `.cjs`, `.mts`, and `.cts`. Formatter descriptions now match the enabled configuration: import and Tailwind sorting require explicit options, which this configuration does not enable.

### Package evidence

| Packages | Official source | Usage and finding |
| --- | --- | --- |
| `motion` 14.4.0 | [Upgrade guide](https://motion.dev/docs/react-upgrade-guide), [MotionConfig](https://motion.dev/docs/react-motion-config), [accessibility](https://motion.dev/docs/react-accessibility) | Native motion elements and spring transitions remain supported across versions 13 and 14. Added reduced-motion controls; no CSS-in-JS prop-filtering integration is used. |
| `zod` 4.6.7 | [Migration guide](https://zod.dev/v4/changelog), [schema API](https://zod.dev/api) | Checked issues, numeric bounds, defaults/transforms, coercion, enums, email normalization, refinements, and generic schema types. Existing field-error HTTP contracts and finite-value checks pass. |
| `@tanstack/react-query` 5.104.5 | [Patch release](https://github.com/TanStack/query/releases/tag/%40tanstack%2Freact-query%405.104.5), [QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient) | Uses object query options, immutable cache updates, invalidation/removal filters, and current `queryClient.query`. The patch's mutation-selector fix requires no migration in this app. |
| `lucide-react` 1.60.0 | [React guide](https://lucide.dev/guide/react), [release](https://github.com/lucide-icons/lucide/releases/tag/1.60.0) | Static named icon components and SVG props remain supported; imports compile and UI icons render. |
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
| `vite-plus` | [Migration rules](https://viteplus.dev/guide/migrate-rules) | Existing standalone scripts remain in use. Its bundled Vite-core alias produces the documented upstream peer warning; the app and root test runner build and run with Vite 8.3.4. |
| `husky`, `lint-staged` | [Husky setup](https://typicode.github.io/husky/get-started.html), [glob and task rules](https://github.com/lint-staged/lint-staged) | Prepare script and hooks use current commands. The expanded module-extension glob retains sequential lint/fix/format commands. |
| `clsx`, `tailwind-merge` | [clsx usage](https://github.com/lukeed/clsx), [Tailwind compatibility](https://github.com/dcastil/tailwind-merge) | Installed utilities have no direct source imports. Tailwind merge 3.7 supports Tailwind 4.3; no application calls require migration. |
| `reflect-metadata`, `rxjs` | [Legacy decorator support](https://github.com/microsoft/reflect-metadata), [RxJS maintainer source](https://github.com/ReactiveX/rxjs/tree/7.8.2) | Metadata is imported before backend startup with compiler decorator options enabled. RxJS supplies the Nest peer; the application has no direct operator calls to migrate. |

The compatibility checks passed 161 tests across 15 suites, workspace typechecking and production builds, zero lint errors, fresh production login/form/socket checks, and temporary normal/reduced-motion component checks. The upstream Vite+ peer warning remains. The separate production issues in the codebase review require their own implementation and verification.
