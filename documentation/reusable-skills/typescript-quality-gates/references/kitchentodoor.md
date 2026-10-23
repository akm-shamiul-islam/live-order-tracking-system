# KitchenToDoor quality source map

| Repository-relative source | Responsibility |
| --- | --- |
| `package.json` | Tool versions/scripts, TypeScript-only lint-staged glob and prepare hook |
| `.husky/pre-commit`, `.husky/pre-push` | Staged lint/fix/format; full typecheck + source tests before push |
| `.oxlintrc.json`, `.oxlintrc.staged.json`, `.oxfmtrc.json` | Full versus staged lint and formatting scope/ignores |
| `tsconfig.base.json`, `tsconfig.tools.json` | Strict compiler policy and native-Node tooling boundaries |
| `vitest.config.ts`, `vitest.integration.config.ts` | Shared-source aliases, bounded workers, explicit test selection and sequential DB integration files |
| `scripts/check-source-language.ts`, `scripts/check-locales.ts` | Maintained TypeScript and AST-backed locale/source checks |
| `backend/scripts/isolated-runtime.ts`, `backend/scripts/isolated-server.ts`, `backend/scripts/runtime-contracts.ts` | Disposable MongoDB/SMTP/HTTP processes and typed fixture IPC |
| `scripts/lib/browser.ts`, `scripts/verify-browser.ts`, `scripts/verify-profiles.ts` | Isolated browser/CDP, workflow/visual bounds and cleanup |
| `scripts/audit-lighthouse.ts`, `scripts/benchmark-throughput.ts` | Production-build lab audits and repeated isolated throughput experiments |
| `documentation/docs/QUALITY.md`, `documentation/quality/` | Recorded methodology, limitations and dated results |

The reference root source test command is `pnpm test`; integration/browser/audit commands are separate. Pre-push does not run lint, format check, integration, browser or Lighthouse. The staged glob covers TypeScript only; `.agents`/documentation are outside application linting. There is no `.github/workflows` configuration in the inspected repository.

The Lighthouse script's private-case login currently sends no `deviceId`, so the current shared login schema rejects that request. Merely adding a UUID is insufficient if it is not trusted: the response can be a verification challenge rather than `AuthResponse`. The harness must complete local SMTP verification or provision a trusted synthetic device for each account and validate the response before seeding browser auth. Browser workflow scripts have separate authentication flows. Until the harness is aligned, select public scenarios explicitly and treat existing reports as historical build evidence.

Optional tool settings belong to test execution and never to a public browser bundle. `BENCH_RATE_LIMIT_MAX` deliberately relaxes limits only inside an isolated benchmark process; do not copy that value into production. Integration fixtures may set local SMTP TLS/Secure-cookie exceptions for loopback testing; production retains TLS and secure cookies.

The portable skill can be used with another language/backend by preserving behavior/quality boundaries and replacing TypeScript/Vitest/Oxc with compatible native tools where the stack requires it. The named Node packages are an appropriate concrete path for TypeScript projects.
