# KitchenToDoor: Agent Engineering Guidelines & Architecture Reference

> **Purpose:** This file defines the authoritative engineering rules, technology versions, anti-patterns, and token efficiency guidelines for AI agents working in this monorepo. **Do NOT rely on outdated LLM training data**—follow the exact versions and patterns documented here and in `.agents/skills/`.

---

## 1. Pinned Technology Stack Matrix

| Subsystem                   | Technology                  | Target Version               | Critical Rule / Constraint                                                              |
| :-------------------------- | :-------------------------- | :--------------------------- | :-------------------------------------------------------------------------------------- |
| **Workspace**               | `Node.js`                   | `24.x`                       | Modern ESM runtime; native fetch, crypto, and URL APIs.                                 |
| **Workspace**               | `pnpm`                      | `12.14.0`                    | Workspace package manager with strict dependency isolation.                             |
| **Workspace**               | `TypeScript`                | `^7.0.2`                     | Strict workspace types (`strict: true`, `noUncheckedIndexedAccess: true`).              |
| **Frontend**                | `React` / `React DOM`       | `^19.3.1`                    | Native `<dialog>` via `useDialog`, React Actions. No `React.FC`.                        |
| **Frontend**                | `@tanstack/react-router`    | `^1.170.45`                  | Code-based route tree in `src/router.tsx`. Typed `Link`, `useNavigate`, `useSearch`.    |
| **Frontend**                | `tailwindcss`               | `^4.3.3`                     | **Tailwind CSS v4.** No `tailwind.config.js`. Uses `@theme` and `@custom-variant dark`. |
| **Frontend**                | `motion`                    | `^14.6.0`                    | **Import strictly from `motion/react`.** Never import `framer-motion`.                  |
| **Frontend**                | `zustand`                   | `5.0.16` (pinned)            | Vanilla `createStore` singleton (`authStore`) + `useStore(authStore, selector)` hook.   |
| **Frontend**                | `@tanstack/react-query`     | `^5.104.5`                   | Object config syntax. In-memory WebSocket cache mutations (`queryClient.setQueryData`). |
| **Frontend**                | `@floating-ui/react`        | `0.27.20`                    | Floating tooltips & popovers with collision detection and clean positioning.            |
| **Frontend**                | `i18next` / `react-i18next` | `26.5.5` / `17.1.2`          | Client localization (EN/JA) under `frontend/src/locales/`.                              |
| **Frontend**                | `lucide-react`              | `^1.61.0`                    | Project-wide SVG icon library.                                                          |
| **Backend**                 | `@nestjs/core` / `common`   | `^12.2.0`                    | **Mandatory `@Inject(Service)` on ALL constructor parameters.**                         |
| **Backend**                 | `@nestjs/platform-fastify`  | `^12.2.0`                    | Fastify v5 HTTP adapter. No Express-only middleware.                                    |
| **Backend**                 | `mongoose`                  | `^9.11.3`                    | Mongoose ODM. Optimistic concurrency control via atomic `findOneAndUpdate`.             |
| **Backend runtime / build** | `sharp`                     | `0.35.5` (pinned dependency) | Normalizes private profile photos and converts trusted menu photos to receipt JPEGs.    |
| **Backend**                 | `socket.io`                 | `^4.8.4`                     | WebSocket Gateway with `WsJwtGuard`, room routing, and `SocketRateLimiter`.             |
| **Shared**                  | `@kitchentodoor/shared`     | Workspace                    | Shared Zod 4 contracts, DTO types, catalog, and pricing. Dual ESM/source export.        |
| **Validation**              | `zod`                       | `^4.6.7`                     | Zod 4 contracts in shared package, backend `ZodValidationPipe`, frontend `useZodForm`.  |

---

## 2. Strict Anti-Patterns (Obsolete Training Traps - NEVER DO THESE)

1. 🚫 **NEVER create `tailwind.config.js` or `tailwind.config.ts`.**
   - Tailwind v4 uses `@import 'tailwindcss';` and CSS cascade layers directly in `frontend/src/index.css`.
   - Dark mode is configured via `@custom-variant dark (&:where(.dark, .dark *));`.
2. 🚫 **NEVER import from `framer-motion`.**
   - The package is rebranded and installed as `motion`. Always write:
     `import { motion, AnimatePresence } from 'motion/react';`
3. 🚫 **NEVER omit `@Inject(...)` in NestJS constructors.**
   - In development, `tsx watch` runs without TypeScript's `emitDecoratorMetadata`. Omitting `@Inject(ServiceName)` causes dependency resolution to fail at runtime.
4. 🚫 **NEVER use React Router v6 or TanStack Router beta APIs.**
   - The app uses TanStack Router v1.170+ with `createRoute`, `createRootRoute`, `lazyRouteComponent`, and `stripSearchParams`. See `.agents/skills/ktd-frontend/SKILL.md`.
5. 🚫 **NEVER call `order.save()` for shared state mutations.**
   - Competing dispatchers or couriers cause race conditions. Always use atomic conditional updates:
     `orderModel.findOneAndUpdate({ _id, status: expectedStatus }, { $set: ..., $push: ... }, { returnDocument: 'after' })`.
6. 🚫 **NEVER use Zustand v3/v4 currying or persist middleware anti-patterns.**
   - Session state is managed by a vanilla `createStore` in `src/lib/authSession.ts` with explicit `localStorage` synchronization across tabs.
7. 🚫 **NEVER hardcode secrets, ports, or rate limits.**
   - Read from `getRuntimeSettings()` on the backend and allowlisted client settings on the frontend.

---

## 3. Token Conservation & Efficiency Guidelines

To prevent context bloat and wasteful token usage:

1. **Progressive Skill Activation:**
   - Consult the dedicated skills under `.agents/skills/` only when working in that specific domain.
   - Do not dump all project files into conversation context; use `grep_search` to find exact lines and `view_file` with `StartLine`/`EndLine` ranges.
2. **Surgical File Edits:**
   - Use `replace_file_content` for single contiguous edits and `multi_replace_file_content` for non-contiguous changes.
   - Avoid `write_to_file` on existing large files unless completely replacing or creating a new file.
3. **Targeted Testing:**
   - Run tests targeting the specific file you modified (e.g. `pnpm vitest run path/to/test.spec.ts`) before running the full workspace suite.

---

## 4. Specialized Workspace Skills

Load these skills on demand for detailed guides, checklists, and templates:

For cross-workspace type contracts, compiler policy and external-data boundaries, follow [the TypeScript implementation guide](documentation/docs/TYPESCRIPT_GUIDE.md).

- **Frontend Engineering:** [`.agents/skills/ktd-frontend/SKILL.md`](.agents/skills/ktd-frontend/SKILL.md)
  _Covers React 19, TanStack Router routes, Tailwind v4, Zustand 5, TanStack Query, and `<dialog>` modals._
- **Backend Architecture:** [`.agents/skills/ktd-backend/SKILL.md`](.agents/skills/ktd-backend/SKILL.md)
  _Covers NestJS 12, Fastify 5, Mongoose 9 atomic queries, Socket.io gateways, and JWT token versioning._
- **Shared Contracts & Types:** [`.agents/skills/ktd-shared-contracts/SKILL.md`](.agents/skills/ktd-shared-contracts/SKILL.md)
  _Covers `@kitchentodoor/shared` Zod 4 contracts, DTO types, state machine, and dual ESM/source exports._
- **PDF Generation (PDFCN):** [`.agents/skills/ktd-pdf-generation/SKILL.md`](.agents/skills/ktd-pdf-generation/SKILL.md)
  _Covers PDFCN (`https://www.pdfcn.dev/`) receipt and invoice generation patterns._

---

## 5. Multi-Agent & Git Etiquette

- **Non-Interference:** When another agent or the user is working, never touch files outside your immediate task scope.
- **Staging Control:** Do not stage files (`git add`) or commit unless explicitly directed by the user. Keep working changes clean and inspectable.
