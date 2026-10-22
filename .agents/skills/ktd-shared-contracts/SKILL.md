---
name: ktd-shared-contracts
description: >-
  Guides schema definitions, shared contracts, catalog pricing, and DTO types in @kitchentodoor/shared.
  Trigger whenever adding or editing Zod validation schemas, API payload types,
  shared enums, pricing calculations, or monorepo shared exports.
---

# KitchenToDoor: Shared Contracts & Type Safety Skill

This skill governs the `@kitchentodoor/shared` package, which acts as the single source of truth for Zod contracts, DTO types, enums, catalog items, and pricing algorithms shared across `@kitchentodoor/backend` and `@kitchentodoor/frontend`.

## Technology Versions & Constraints

| Technology         | Version   | Monorepo Usage Rule                                                                  |
| :----------------- | :-------- | :----------------------------------------------------------------------------------- |
| **Zod**            | `^4.6.7`  | Contract definitions, schema parsing, and type inference.                            |
| **TypeScript**     | `^7.0.2`  | Strict workspace types (`strict: true`, `noUncheckedIndexedAccess: true`).           |
| **Shared Package** | Workspace | Dual export: Source exports for development; compiled ESM in `dist/` for production. |

---

## Directory Structure

```text
shared/
├── src/
│   ├── schemas/
│   │   ├── auth.schema.ts         # LoginSchema, RegisterSchema, UserSummarySchema
│   │   ├── lookup.schema.ts       # OrderLookupSchema, PhoneSchema, OrderIdentifierSchema
│   │   ├── order.schema.ts        # CreateOrderSchema, UpdateOrderStatusSchema
│   │   ├── public-config.schema.ts# PublicConfigSchema
│   │   ├── telemetry.schema.ts    # CourierLocationUpdateSchema
│   │   └── user.schema.ts         # UserRoleSchema, role labels, user-management schemas
│   ├── catalog.ts                 # Single source of truth for food items & base prices
│   ├── enums.ts                   # OrderStatus/UserRole const objects and transition helpers
│   ├── index.ts                   # Barrel re-export file
│   ├── pagination.ts              # PageNumberSchema, PageSizeSchema, paginate()
│   ├── pricing.ts                 # calculatePricing() with cent-based rounding
│   ├── socket-events.ts           # Typed ClientToServer & ServerToClient event maps
│   └── zod.ts                     # Re-export of Zod library
├── tsconfig.json                  # Typechecking configuration
├── tsconfig.build.json            # Emits dist/ ESM and declarations
└── package.json                   # Workspace package manifest with export conditions
```

---

## 1. Dual Export Architecture (CRITICAL)

In `shared/package.json`:

```json
{
  "name": "@kitchentodoor/shared",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    "./zod": {
      "types": "./src/zod.ts",
      "development": "./src/zod.ts",
      "default": "./dist/zod.js"
    },
    ".": {
      "types": "./src/index.ts",
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

- **In Development:** `tsx watch --conditions=development` and Vite resolve `./src/index.ts` directly. Changes in `shared/src/` reflect immediately without running a build!
- **In Production / Bundling:** The compiled `shared/dist/index.js` is used.
- **When to build:** Always run `pnpm --filter @kitchentodoor/shared build` (or `pnpm build`) before running production build verification.

---

## 2. Defining Schemas & DTO Types

Always define the Zod schema first and derive the TypeScript type using `z.infer`. Import the shared Zod instance so application workspaces resolve the same dependency:

```typescript
import { z } from '@kitchentodoor/shared/zod';

export const MyFeatureSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  count: z.number().int().min(1, 'Count must be at least 1').max(100).default(1),
  notes: z.string().trim().max(500).optional(),
});

export type MyFeatureDto = z.infer<typeof MyFeatureSchema>;
```

---

## 3. Order Status State Machine (`enums.ts`)

Order statuses and their allowed sequence are defined in `shared/src/enums.ts` using const objects and arrays (not TypeScript `enum`s):

```typescript
export const OrderStatus = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];
```

**State Progression Rules:**

1. An order can advance only to the immediately next status in `ORDER_STATUS_SEQUENCE`.
2. An order cannot transition backward.
3. Once `DELIVERED` or `CANCELLED`, an order is terminal: no further status or telemetry updates are permitted.
4. Couriers can advance each stage in order only for deliveries assigned to them. Administrators may manage all orders. Cancellation requires an explanation.

---

## 4. Financial Calculations (`pricing.ts`)

Prices are strictly calculated on the backend from `MENU_ITEMS` to prevent client tampering.

- Uses integer cent arithmetic to eliminate floating-point rounding errors.
- Always use `calculatePricing(items, settings)` when determining order totals.
