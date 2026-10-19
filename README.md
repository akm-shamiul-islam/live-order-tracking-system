# 🍳 KitchenToDoor: Real-Time Order & Telemetry Platform

> **Fresh from the Kitchen, Tracked to Your Door.**  
> A high-performance full-stack monorepo built with NestJS (Fastify), MongoDB Mongoose, Socket.io, React 19, TanStack Router & Query, Tailwind CSS v4, Motion, and automated Git hooks via Husky + lint-staged.

---

## 🌟 Overview & Key Features

**KitchenToDoor** is an enterprise-grade real-time food order tracking and telemetry platform engineered for high-throughput kitchen operations, live courier dispatch management, and modern customer tracking experiences.

* ⚡ **High-Throughput Fastify Engine:** Powered by NestJS + Fastify (`@nestjs/platform-fastify`), delivering 2x to 3x higher throughput than legacy Express setups.
* 🛰️ **Live Telemetry & Radar Simulation:** Dynamic radar showing simulated courier movement with real-time GPS coordinate broadcasting.
* 🔒 **Hardened Security & RBAC:** Cryptographic password hashing (`bcryptjs` salt rounds: 12), stateless JWT authentication, and **`WsJwtGuard`** for authenticated WebSocket handshakes.
* 🛡️ **Automated Quality Gates (Husky + lint-staged):**
  * `pre-commit`: Instant linting and formatting on staged files with `oxlint` and `oxfmt`.
  * `pre-push`: Automated typechecking (`pnpm typecheck`) and Vitest test runner (`pnpm test`) to guarantee zero broken builds reach the remote repository.
* 🌓 **Adaptive Dark & Light Mode:** Responsive navbar with a toggle switch and persistent theme preference.
* 📱 **100% Mobile Responsive:** Fluid drawers, responsive cards, thumb-friendly tracking steppers, and accessible components.
* 📦 **One-Command Monorepo:** Orchestrated with `pnpm` workspaces—run both frontend and backend dev servers simultaneously with `pnpm dev`.

---

## 🛠️ Technology Stack & Role Matrix

| Category | Technology | Target Version | Role & Justification / Project Usage Notes |
| :--- | :--- | :--- | :--- |
| **Runtime** | `Node.js` | `v24.x` | Modern JavaScript runtime offering top V8 performance, native fetch, and ES module support. |
| **Package Manager** | `pnpm` | `10.x` | Workspace-native package manager providing ultra-fast installation and strict dependency isolation. |
| **Language** | `typescript` | `^7.0.2` | Workspace-wide strict static type safety (`strict: true`, `noUncheckedIndexedAccess: true`). |
| **Monorepo Tooling** | `vite-plus` (`vp`) | `^1.3.x` | VoidZero's unified toolchain unifying bundling, dev server, Vitest testing, and Oxc tooling. |
| **Git Hooks** | `husky` | `^9.1.7` | Git hooks orchestrator managing `pre-commit` and `pre-push` automated gates. |
| **Staged Linting** | `lint-staged` | `^17.6.0` | Runs linters and formatters strictly against git staged files on commit. |
| **Linter** | `oxlint` | `^1.88.0` | Rust-based linter executing ~50x faster than traditional ESLint, enforcing React and TypeScript correctness. |
| **Formatter** | `oxfmt` | `^0.73.0` | Rust-powered formatter ensuring Prettier compatibility, automatic Tailwind class sorting, and import sorting. |
| **Shared Bundler** | `tsdown` | `^0.23.1` | Instant TypeScript bundler powered by Rolldown for fast builds of `packages/shared`. |
| **Backend Framework** | `NestJS` (`@nestjs/core`) | `^12.0.0` | Enterprise architecture featuring modular dependency injection, decorators, and clean domain separation. |
| **HTTP Engine** | `@nestjs/platform-fastify` | `^12.1.3` | High-performance Fastify adapter selected over Express for superior throughput and lower latency. |
| **Real-Time Engine** | `socket.io` / `@nestjs/platform-socket.io` | `^4.8.4` / `^12.0.0` | WebSocket engine managing room subscriptions (`order_<id>`, `admins`), bi-directional telemetry, and acknowledgments. |
| **Database & ODM** | `mongodb` / `mongoose` / `@nestjs/mongoose` | `^9.11.2` / `^12.0.0` | Production MongoDB document database with typed Mongoose schemas, indices, and audit logging. |
| **Authentication** | `bcryptjs` + `@nestjs/jwt` + `passport-jwt` | `^3.0.3` / `^12.0.3` | Replaces insecure plaintext auth with salted bcrypt password hashing and cryptographically signed JWTs. |
| **WebSocket Guard** | Custom `WsJwtGuard` | Internal | Validates JWT tokens during the Socket.io handshake so unauthenticated users cannot join admin channels. |
| **API Security** | `@fastify/helmet` + `@fastify/cors` | `^13.1.1` / `^11.3.1` | Native Fastify security plugins enforcing HTTP response headers and strict CORS origin whitelisting. |
| **Rate Limiter** | `@nestjs/throttler` | `^6.0.0` | Protects HTTP endpoints and WebSocket events from brute force, event flooding, and DDoS attacks. |
| **Frontend Framework** | `React` / `React DOM` | `^19.0.0` | Modern React UI with optimized rendering, Actions, and seamless transition management. |
| **Routing** | `@tanstack/react-router` | `^1.170.45` | 100% type-safe file-based router with built-in search param validation for orders and filters. |
| **Server State** | `@tanstack/react-query` | `^5.104.4` | Server state cache updated directly by incoming Socket.io events (`setQueryData`), eliminating refetch round-trips. |
| **Styling** | `tailwindcss` + `@tailwindcss/vite` | `^4.3.3` | Utility-first CSS framework using native CSS cascade layers and customized dark/light mode tokens. |
| **Animations** | `motion` (`motion/react`) | `^12.x` | Rebranded Framer Motion library powering smooth route transitions, glowing order steppers, and telemetry radar. |
| **Icons & UI** | `lucide-react` + `clsx` + `tailwind-merge` | `^1.x` | Accessible Feather-style SVG icons and clean conditional class merging. |
| **Testing** | `vitest` | `^3.x` (via Vite+) | Instant Vite-native testing runner for unit, integration, and E2E specs. |

---

## 📁 Monorepo Workspace Architecture

```
kitchen-to-door/
├── .github/
│   └── workflows/
│       └── ci.yml                          # Oxlint, Oxfmt check, Typecheck, Vitest
├── .husky/
│   ├── pre-commit                          # Runs pnpm exec lint-staged (oxlint + oxfmt)
│   └── pre-push                            # Runs pnpm typecheck && pnpm test
├── apps/
│   ├── api/                                # @kitchentodoor/api (NestJS Fastify + Mongoose + Socket.io)
│   │   ├── src/
│   │   │   ├── auth/                       # JWT Auth, Bcrypt, Guards, Strategies
│   │   │   ├── database/                   # Mongoose Schemas (User, Order, OrderStatusLog)
│   │   │   ├── orders/                     # Orders Controller, Service, & WebSocket Gateway
│   │   │   ├── app.module.ts
│   │   │   └── main.ts                     # Fastify bootstrap with Helmet & CORS
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                                # @kitchentodoor/web (React 19 + TanStack + Tailwind CSS v4 + Motion)
│       ├── src/
│       │   ├── components/                 # Navbar, Stepper, Radar, Cart, Admin tables
│       │   ├── hooks/                      # useOrderSocket, useTheme, useAuth
│       │   ├── routes/                     # TanStack Router type-safe file routes
│       │   ├── index.css                   # Tailwind v4 theme tokens
│       │   └── main.tsx
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   └── shared/                             # @kitchentodoor/shared (Shared Zod Schemas & Contracts)
│       ├── src/
│       │   ├── schemas/                    # Zod validation schemas
│       │   └── socket-events.ts            # Typed Socket.io event interfaces
│       └── package.json
├── documentation/
│   ├── audit/                              # Original audit specifications
│   ├── docs/                               # Technical architecture & deployment guides
│   └── plan/                               # Master implementation blueprints
├── .env.example                            # Generated cryptographic secrets and variables
├── .oxlintrc.json                          # Workspace Oxlint configuration
├── .oxfmtrc.json                           # Workspace Oxfmt configuration
├── pnpm-workspace.yaml                     # Monorepo workspace configuration
└── package.json                            # Workspace root scripts
```

---

## ⚡ Quick Start & Development

### 1. Prerequisites
* **Node.js**: `v24.x`
* **PNPM**: `pnpm` (`v10.x`)
* **MongoDB**: A running local MongoDB instance or a free MongoDB Atlas cluster connection string.

### 2. Environment Configuration
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
*(Pre-generated 256-bit cryptographic secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET` are already provided inside `.env.example`)*

### 3. Install Dependencies & Initialize Git Hooks
```bash
pnpm install
```
*(This automatically runs `husky` to activate the `pre-commit` and `pre-push` hooks)*

### 4. Run Both Backend & Frontend with One Command
```bash
# Concurrently starts both apps/api (port 5000) and apps/web (port 5173):
pnpm dev
```

---

## 🛡️ Git Hooks & Automated Quality Gates

* **On `git commit` (`pre-commit` via `lint-staged`):**  
  Only files staged for commit are inspected. Runs `oxlint --fix` and `oxfmt` in milliseconds, ensuring no malformed or unformatted code is committed.
* **On `git push` (`pre-push`):**  
  Executes `pnpm typecheck` (strict TypeScript 7.x) and `pnpm test` (Vitest across all packages). If any test or type check fails, the push is immediately halted, preventing broken code on GitHub.
