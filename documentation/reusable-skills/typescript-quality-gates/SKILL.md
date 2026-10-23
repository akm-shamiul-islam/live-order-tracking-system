---
name: typescript-quality-gates
description: Set up complementary TypeScript checks, Vitest tests, isolated MongoDB integration, Oxlint/Oxfmt, Lighthouse and Husky/lint-staged gates, with honest local-versus-CI guarantees.
---

# TypeScript quality gates

Inspect the target package scripts, lockfile, compiler, CI and Git hook conventions before changing tooling. Preserve its package manager and working checks. Read [the source map](references/kitchentodoor.md) for KitchenToDoor commands/configuration.

## Tool responsibilities and reference versions

| Tool | Reference version | Role and boundary |
| --- | --- | --- |
| Vitest | `5.0.5` | Source tests and separately configured integration tests; assertions should verify behavior/races/permissions |
| Lighthouse | `13.5.0` | Repeatable lab audits of a real production build; does not prove security, full accessibility or field performance |
| Oxlint | `1.89.0` | Correctness/suspicious/performance lint, with compatible type-aware tooling where configured |
| Oxfmt | `0.74.0` | Deterministic formatting; it does not typecheck or verify behavior |
| Oxc Parser | `0.155.0` | AST parsing for project-specific source checks; not a semantic TypeScript compiler |
| Husky | `9.1.7` | Local Git hook execution |
| lint-staged | `17.6.0` | Pass staged file paths to targeted fix/format commands |
| mongodb-memory-server | `11.3.0` | Disposable real MongoDB process for isolated tests; first run may download its binary |

These are the inspected source versions, not instructions to downgrade or upgrade an unrelated project. Check target compatibility and current primary documentation before installing different versions. KitchenToDoor uses Node 24.x, pnpm 12.14.0 and strict TypeScript 7.0.2.

## Establish meaningful layers

1. Keep compiler checks explicit. Strict TypeScript validates maintained apps, shared contracts, tests and tools with the correct runtime module settings. Native Node TypeScript stripping executes scripts but does not typecheck them. An AST rule cannot replace `tsc`.
2. Configure source tests to resolve current workspace source rather than stale build artifacts, and include maintained test paths only. Bound workers to avoid competing native/DB workloads exhausting the machine.
3. Put integration tests in a separate config with suitable hooks/timeouts and deliberate concurrency. Create a unique temporary database, isolated ports, random test-only secrets and local SMTP capture. Start the actual HTTP adapter and real socket clients. Shut down child processes/browser/DB on success and failure.
4. Test high-value boundaries: authorization, duplicate requests, concurrent edits, session/recovery races, database interruption, private broadcasts and actual output. Follow the target's coverage policy; avoid tests that only repeat implementation text or trivial reversible styling.
5. Use Oxc Parser only for explicit project policies that benefit from ASTs, such as untranslated display text, locale interpolation parity or maintained-source language rules. Bound exceptions and report file/location; do not mistake parse success for safe runtime data.
6. Keep full type-aware linting separate from fast staged checks if the tool's file-list mode cannot build complete type context. The source staged configuration disables type-aware/typecheck options; full `pnpm lint` keeps them enabled.
7. Inspect formatter/linter include/ignore patterns. Source docs/skill examples may intentionally be excluded. Do not claim pre-commit formats Markdown if the staged glob includes only TypeScript. Apply formatting to prose separately when appropriate.

## Git gates and GitHub enforcement

The source has a root `prepare: husky` script and these local hooks:

```sh
# .husky/pre-commit
pnpm exec lint-staged

# .husky/pre-push
pnpm typecheck && pnpm test
```

Its staged configuration runs `oxlint --fix --config .oxlintrc.staged.json` then `oxfmt` for `*.{ts,tsx,mts,cts}`. Keep filenames passed structurally by lint-staged so spaces are handled correctly. Avoid broad `git add .` in hooks; preserve unrelated/partially staged edits and review the tool's staged changes after fixes.

Local hooks can be bypassed, may not be installed and do not run on web edits. To require acceptable changes before merging on GitHub, add a CI workflow **in the receiving project** and require its statuses through branch protection/rulesets. Re-run frozen-lockfile install, typecheck, tests, full lint, format check and production build there, adding integration/browser jobs where relevant. The original repo has **no committed GitHub Actions workflow**; do not advertise these recommended remote gates as existing behavior.

Do not stage/commit/push solely because a check passes; follow the user's requested Git scope. Dependency audit/update checks need network and registry state; report what actually ran instead of treating an old report as a fresh audit.

## Performance and browser workflow

Measure a built application using isolated synthetic fixtures. Include public and authenticated routes, cold-cache mobile/desktop conditions, Chrome/tool versions and commit/build identity. Use a fresh browser profile, log in synthetic users through the supported auth flow, and avoid recording credentials/private URLs in reports.

Record Performance/Accessibility/Best Practices/SEO plus LCP/TBT/CLS as needed. Private pages can intentionally use `noindex`; do not remove privacy directives to increase a score. Compare like-for-like measurements, repeat when variance matters and investigate measured candidates rather than claiming every tool change improved performance.

Supplement lab audits with keyboard/mobile/form/transition behavior and deployed field metrics when available. If benchmarking throughput, warm up and repeat isolated loads with fixed fixture counts and options; do not point load tests at production without explicit scope. The reference audit/benchmark scripts expect build artifacts; build first.

The current Lighthouse harness has an authentication mismatch: its private scenarios post only email/password, while `LoginSchema` requires a device ID and new-device sign-in can return an OTP challenge. Those scenarios need a trusted synthetic device or local SMTP verification plus auth-response validation before they can be advertised as runnable. Public scenarios (`menu-mobile`, `menu-desktop`, `account-mobile`) avoid that login branch. Historical reports remain evidence for their recorded builds, not proof that today's full command completes.

## Commands and environment

Typical source commands, to map to existing target scripts:

```bash
pnpm exec vitest run path/to/relevant.spec.ts
pnpm typecheck
pnpm test:integration
pnpm lint
pnpm fmt:check
pnpm build
pnpm test:browser
pnpm test:browser:profiles
pnpm audit:lighthouse
```

Start with checks relevant to the change, then required gates. A documentation-only skill addition warrants frontmatter/link/format checks, not a full production performance run. `pnpm fmt`/`lint:fix` mutate files; inspect the diff and keep their scope appropriate.

| Variable | Requirement / source default |
| --- | --- |
| `CHROME_PATH` | Optional installed Chrome/Chromium executable for browser/Lighthouse scripts; otherwise source helper auto-detects |
| `LIGHTHOUSE_PAGES` | Optional comma-separated scenario names, e.g. `menu-mobile,menu-desktop`; the complete source run needs the private-login harness correction described above |
| `LIGHTHOUSE_OUTPUT` | Optional sanitized summary destination; detailed reports stay in a temporary directory |
| `BENCH_CONNECTIONS`, `BENCH_PIPELINING` | Optional isolated load options; `25`, `1` |
| `BENCH_TIMEOUT_SECONDS`, `BENCH_DURATION_SECONDS`, `BENCH_WARMUP_SECONDS`, `BENCH_REPEATS` | `10`, `10`, `3`, `3` |
| `BENCH_FIXTURE_ORDERS`, `BENCH_RATE_LIMIT_MAX` | `100`, `1000000` for the isolated fixture only |
| `BENCH_OUTPUT` | Optional benchmark summary destination |
| `HUSKY=0` | Optional hook disable switch; explains why hooks cannot enforce remote policy |

No production `MONGODB_URI`, real SMTP password, JWT secret or customer account is needed by the isolated fixture. The helper generates temporary values and configures local test services. It also uses internal `KTD_*` child-process variables; those are fixture protocol, not application deployment settings. A MongoDB binary download needs initial network/cache access. Tests requiring transactions need a supported replica-set fixture instead of assuming the default standalone instance provides transactions.

## Acceptance criteria

Verify checks reject a deliberate representative type/lint/test failure in an isolated temporary sample, and remove the sample afterward when setting up new gates. Verify passing changes and a production build, partially staged files and paths with spaces. Confirm local hooks, required remote statuses if configured, fixture cleanup and data isolation. Record commands/results and distinguish an audit not rerun, a historical measurement and a current result. Adapt browser routes/design assertions to the host project rather than hardcoding the source palette or food workflows.
