# TypeScript implementation guide

Reviewed against TypeScript **7.0.2**, the installed compiler, on 2026-10-23. Applies to maintained application, tests and tooling.

## Compiler and module boundaries

- Inherit `tsconfig.base.json`. Keep `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedSideEffectImports` and `noEmitOnError` enabled.
- Backend/shared use NodeNext and compiled `.js` import specifiers. Frontend uses ESNext/Bundler and Vite. Root tools use native Node 24 TypeScript stripping and a separate strict typecheck. Keep these runtime-specific module settings.
- Backend and tool configurations intentionally disable `strictPropertyInitialization` for Nest/Mongoose decorator-managed properties. Explicit injection tokens remain mandatory. Do not turn this exception into weaker null or function checking.
- Maintained source is TypeScript. Generated JavaScript in `dist` is required by Node/browsers and is outside the source-language gate.

## Types and validation

1. Infer obvious local values. Annotate parameters and exported service/API contracts. Derive DTOs from shared Zod schemas rather than duplicating their fields.
2. Use `unknown` for JSON, caught values and untyped library payloads. Narrow with guards or shared Zod schemas before reading fields. A generic or assertion does not validate runtime data.
3. Prefer unions, `keyof`, utility types and `satisfies` where they describe a real relationship. Avoid complex generic abstractions for a single concrete shape.
4. Use type-only imports for erased types. Keep real values used by Nest injection/decorators as runtime imports.
5. Handle absent array entries and optional values. Use a non-null assertion only where an invariant has actually been established. Prefer a guard when the value can be absent at runtime.
6. Keep shared catalog/pricing/status contracts authoritative. Derive copies when sorting cached or shared arrays; do not mutate caller-owned data for presentation.

## Authentication and sockets

- HTTP access uses `AuthenticatedRequest`; WebSocket access uses `OrderSocket` and `client.data.user` from `backend/src/auth/authenticated-context.ts`.
- `WsJwtGuard` verifies current account/session access before storing the actor. RolesGuard and handlers read the same typed context. A missing actor must reject a mutation; never invent an admin role or substitute an account.
- `OrderSocketServer` binds shared incoming/outgoing event contracts and socket data. Broadcast helpers preserve the event-to-argument relationship through `Parameters<ServerToClientEvents[Event]>`.
- Keep network payload parameters `unknown` and validate them. Socket generics help the compiler; they cannot constrain a hostile client.

## React forms and async work

- Reuse `PasswordInput` and other shared controls. Preserve identifiers, controlled values, autocomplete, disabled state and linked errors. Visibility is temporary component state.
- Type props from React's native component props where appropriate. Use shared validation schemas and the existing form helper for field errors.
- Await dependent writes. Use `Promise.all` for independent work only. Socket acknowledgements, account coordination and UI workflow steps often require ordering.
- A deliberate background promise needs an error handler. Preserve the original failure when translating errors into an API response. Keep unknown internal errors out of client messages.

## Tests and deliberate boundaries

- Use `vi.fn<FunctionSignature>()` and inferred mock factories. Test fixture types can model partial records without claiming to construct complete Mongoose documents.
- Keep unavoidable partial-double assertions at service/framework construction boundaries. Do not propagate them into application code. Exercise database/framework behavior with integration tests.
- The Socket.IO adapter has one documented options assertion: Nest 12 declares complete `ServerOptions`, while Socket.IO accepts partial options and supplies defaults. Keep this compatibility bridge local and check the returned server before use.
- Every successful JSON response in the frontend API client passes through a shared Zod schema before entering application state. Keep response envelopes, pagination and nested DTOs synchronized with backend changes. Translate malformed responses into a readable ApiError; retain checkout retry keys until the returned order validates.
- Keep browser-storage failures separate from authentication failure. A failed write must preserve the active in-memory session; routine synchronization must not restore the older saved snapshot. Real storage events still reconcile account changes from other tabs.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
```

Run browser workflows when changing forms, navigation, appearance, authentication or Socket.IO behavior. No explicit `any` or unsupported TypeScript suppression comments are allowed by the staged/full lint configurations. A necessary `@ts-expect-error` needs an explanation and a test of the intended rejected input.

## Sources

- [TypeScript compiler options](https://www.typescriptlang.org/tsconfig/), [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) and [type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions).
- [Socket.IO typed events and socket data](https://socket.io/docs/v4/typescript/), [Nest execution contexts](https://docs.nestjs.com/fundamentals/execution-context) and [Zod validation](https://zod.dev/basics).
- [Node 24 TypeScript runtime](https://nodejs.org/docs/latest-v24.x/api/typescript.html) and [Oxlint suppression-comment rule](https://oxc.rs/docs/guide/usage/linter/rules/typescript/ban-ts-comment.html).
