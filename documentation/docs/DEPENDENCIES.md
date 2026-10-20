# Dependency version audit

Checked npm's latest stable metadata on **2026-10-20T13:03:59.073Z**. The initial audit covered **50 distinct packages** in the root, backend, frontend, and shared manifests. After removing the deprecated bcrypt types stub, **49 maintained packages across 58 declarations** match the registry release and declared minimum.

The `^` prefix permits compatible newer versions; it does not mean the installed version equals the minimum shown in `package.json`. The lockfile and installed package metadata establish the version actually used. React 19.3.1 and Tailwind CSS 4.3.3 were already installed at their current stable versions; their README badges and lower dependency bounds were outdated.

## Installed package updates

| Package | Previous installed | Verified stable release |
| --- | --- | --- |
| `@tanstack/react-query` | 5.104.4 | 5.104.5 |
| `@types/node` | 24.19.2 | 26.6.5 |
| `lucide-react` | 1.59.0 | 1.60.0 |
| `motion` | 12.43.0 | 14.4.0 |
| `oxfmt` | 0.73.0 | 0.74.0 |
| `oxlint` | 1.88.0 | 1.89.0 |
| `zod` | 3.25.76 | 4.6.7 |

`@types/bcryptjs` 3.0.0 was removed because npm marks it as a deprecated stub and bcryptjs includes its own declarations. A current Vite development dependency was added at the root to provide the standalone Vitest runner with an explicit Vite peer.

## Complete current package list

Each release below was verified through the [npm registry](https://registry.npmjs.org/). Internal `workspace:*` links reference the shared local package. Indirect dependencies follow the versions supported by their owning packages.

| Package | Declared range | Installed and npm latest | Workspaces |
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
| [@types/node](https://www.npmjs.com/package/@types/node/v/26.6.5) | `^26.6.5` | 26.6.5 | backend |
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
- **Node:** Package updates use the latest Node declaration package. Runtime verification uses the project's supported Node 24 installation; no global runtime installation is performed.
- **Known upstream peer warning:** `pnpm peers check` reports the Vite+ core alias version 1.3.0 against the Vite 6/7/8 peer ranges in its bundled Vitest 5.0.5 and `@vitest/mocker`. Vite+ documents the core alias in its [migration rules](https://viteplus.dev/guide/migrate-rules#vite-and-overrides), and the warning is tracked [upstream](https://github.com/voidzero-dev/vite-plus/issues/1101). The application and standalone runner resolve Vite 8.3.4.

## Repeat the check

```bash
pnpm deps:check
# Machine-readable output:
node scripts/check-dependencies.mjs --json
```

The check reads the four maintained manifests, queries npm, and compares both installed versions and declared minimums. It returns a failing exit code for outdated, missing, or deprecated direct dependencies. Run it after installing dependencies. Latest-release checks need network access; the normal test and typecheck gates remain local.

Review migration notes before accepting a future major release. Regenerate the lockfile with pnpm, then run typecheck, tests, builds, formatting/lint, and relevant browser/runtime checks. See the [verification report](IMPLEMENTATION_AND_VERIFICATION_REPORT.md) for application verification.

## Upgrade verification

- `pnpm deps:check`: 49 packages across 58 declarations; no outdated installed versions, declared minimums, or deprecated packages.
- `pnpm typecheck`, `pnpm test`, and `pnpm build`: passed, with 161 source tests across 15 suites.
- `pnpm lint`: zero errors, including the deprecated API rule; the existing warning backlog remains.
- `pnpm audit --json`: zero reported vulnerabilities across the resolved dependency tree.
- A compiled production API and frontend preview passed browser checks for real staff login with normalized email, red inline field errors and first-error focus, Motion tracking rendering, live sockets, and configured delivery/tax pricing. The check did not create or advance orders.
