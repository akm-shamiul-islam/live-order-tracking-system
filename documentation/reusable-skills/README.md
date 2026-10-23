# Reusable application skills

Twelve portable skills extracted from KitchenToDoor's implementation, reviewed on **2026-10-23**. Give an LLM the relevant skill folder to reproduce a feature in another project. Each folder contains a `SKILL.md` entry point and a `references/kitchentodoor.md` implementation map. The entry point is usable without this repository.

## Choose a skill

| # | Skill | Use it to build | Configuration |
| --- | --- | --- | --- |
| 1 | [Smooth app transitions](smooth-app-transitions/SKILL.md) | Page navigation, language/theme crossfades, motion fallbacks | No environment variables |
| 2 | [Approval notifications](approval-notifications/SKILL.md) | Admin reviews, durable decisions, unread state and audit history | Database/auth, polling, recovery and upload limits |
| 3 | [Persistent language switching](persistent-language-switching/SKILL.md) | Accessible locale selector, guest/account persistence, race-safe saves | No translation service; optional existing account API |
| 4 | [Responsive admin tables](responsive-admin-tables/SKILL.md) | Breadcrumbs, headings, filter/search toolbar, settings, badges and pagination | No UI variables; bounded API list settings |
| 5 | [Profile state and validation](profile-state-and-validation/SKILL.md) | Shared account/avatar state, private uploads, forms and draft protection | Auth/database, upload and review settings |
| 6 | [Light/dark appearance](light-dark-appearance/SKILL.md) | Theme button, Sun/Moon icons, tooltip, persistence and smooth switching | No feature variables; CSP integration for initialization |
| 7 | [Secure auth sessions](secure-auth-sessions/SKILL.md) | Password hashes, JWTs, rotating refresh cookies and authorization | Secrets, cookies, origins, rate limits and OTP settings |
| 8 | [NestJS/Fastify production API](nestjs-fastify-production-api/SKILL.md) | Typed modules, validation, atomic writes, hosting and operations | Runtime, MongoDB, security and hosting settings |
| 9 | [Typed Socket.IO realtime](typed-socketio-realtime/SKILL.md) | Tracking or chat with authorized rooms, acknowledgments and recovery | Connection/packet limits, telemetry and browser settings |
| 10 | [Nodemailer OTP and recovery](nodemailer-otp-recovery/SKILL.md) | Registration/device codes, password reset by OTP **and a recovery link** | Authenticated SMTP, code lifetime, cooldown and attempts |
| 11 | [PDFCN documents and preview](pdfcn-documents-and-preview/SKILL.md) | Choose Forme/Takumi, generate authorized PDFs, preview without editing controls | Receipt timezone/rate limit; no hosted renderer key |
| 12 | [TypeScript quality gates](typescript-quality-gates/SKILL.md) | Tests, lint/format, performance checks and Git gates | Optional browser/report/benchmark settings |

## Use in another project

1. Copy the **whole selected folder**, including `references/`, into the skill directory supported by your agent. Keep its `name` and folder name aligned. For agents without skill discovery, attach `SKILL.md` and the relevant reference directly.
2. Ask the LLM to inspect the target project's framework, versions, design tokens, runtime and existing auth before implementing. KitchenToDoor package versions are source evidence; they are not upgrade instructions for another project.
3. Require the LLM to map the behavior to native framework APIs, preserve existing colors/spacing/components, identify configuration, implement, and verify the acceptance criteria in the skill.
4. Keep credentials in the target project's secret store or ignored environment file. Commit placeholder examples and validation only. Variables labelled **extension** need new configuration/schema wiring; setting them alone does not add a feature.

Example request:

> Use `persistent-language-switching` to add English/Japanese switching to this Next.js app. Inspect our routing and installed versions first. Keep our purple brand palette, existing dropdowns and typography. Preserve the current page, query parameters and unsaved form data. Explain the locale persistence policy and list the public versus server configuration. Verify reloads, account changes and failed saves.

Each skill describes a framework-independent behavior and then gives adaptation choices. React hooks, Zustand, TanStack Router, Mongoose and Nest decorators are implementation examples. Next.js server/client boundaries, Vue stores, SQL transactions or another backend's middleware can provide the same behavior. Do not add the entire source stack to reproduce a small UI feature.

## Read the evidence correctly

- `references/kitchentodoor.md` records paths relative to the **KitchenToDoor repository root**. These are navigation aids when the original repository is available; copied skills do not import from those paths.
- UI-related skills include theme adaptation rules. Source teal/slate colors are examples: use the receiving project's semantic brand, surface, text, border, focus, success, warning and danger tokens.
- Environment tables show **KitchenToDoor names and defaults**, plus explicit requirements. Another project should retain its established names and validate an equivalent mapping. UI-only skills need no secrets.
- For running KitchenToDoor itself, the complete startup inventory remains [`.env.example`](../../.env.example) and [Configuration](../docs/CONFIGURATION.md). Backend production startup additionally requires authenticated SMTP even when the feature being studied is a table, notification or receipt.
- In-app approval notifications currently use MongoDB + HTTP polling/open/focus refresh. They are separate from order Socket.IO events and OTP email delivery.
- OTP password recovery is implemented. Sending and exchanging a recovery link is a **specified extension** in skill 10; it is not advertised as an existing application feature.
- The source currently puts an OTP-issued reset grant in a browser URL fragment. Its signing-key rotation does not independently revoke opaque refresh/reset grants. The mail and auth skills explain these boundaries and the additional controls recommended when reusing them.
- Forme is the installed PDF renderer. Takumi is a researched alternative, not an installed second renderer. The PDF skill links the official sources and states the limits of a read-only preview.
- Git hooks provide local checks and can be bypassed. CI with branch protection is an adaptation recommendation; this repository has no committed GitHub Actions workflow.
- The current Lighthouse private-page fixture omits the login device ID/OTP flow. Public cases can be selected independently; the quality skill documents the required harness update. Historical reports are tied to their original builds.

The existing [workspace engineering skills](../../.agents/skills/) govern changes **inside KitchenToDoor**. This catalog serves feature reuse across projects and does not replace those local rules.
