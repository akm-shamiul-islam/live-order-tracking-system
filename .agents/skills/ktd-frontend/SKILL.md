---
name: ktd-frontend
description: >-
  Guides development of React 19 frontend pages, components, routes, state, and forms in KitchenToDoor.
  Trigger whenever creating or editing frontend pages, routes, TanStack Router configurations,
  Tailwind CSS styles, Zustand state, TanStack Query hooks, or Zod form validation.
---

# KitchenToDoor: Frontend Engineering Skill

This skill provides authoritative patterns, version constraints, and checklists for building and modifying frontend pages, layouts, and components in `@kitchentodoor/frontend`.

## Technology Versions & Constraints

| Technology          | Version             | Import / Usage Rule                                                                                                                                                    |
| :------------------ | :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React**           | `19.3.1`            | Native `<dialog>` for modals, `useActionState`, Actions. Avoid `React.FC`.                                                                                             |
| **TanStack Router** | `^1.170.45`         | Code-based route tree in `src/router.tsx`. Use `createRoute`, `lazyRouteComponent`, `Link`, `useNavigate`, `useSearch`.                                                |
| **Tailwind CSS**    | `^4.3.3`            | Tailwind v4 with `@import 'tailwindcss';` and `@custom-variant dark (&:where(.dark, .dark *));`. **No `tailwind.config.js`**.                                          |
| **Motion**          | `^14.6.0`           | Import strictly from `motion/react` (e.g. `import { motion, AnimatePresence } from 'motion/react'`). **Never import `framer-motion`**.                                 |
| **Zustand**         | `5.0.16` (pinned)   | Vanilla stores in `src/lib/authSession.ts` and `src/lib/cart.ts`, consumed with `useStore`. Keep localStorage synchronization explicit; do not add persist middleware. |
| **TanStack Query**  | `^5.104.5`          | Object config syntax (`useQuery({ queryKey: [...], queryFn: ... })`). Real-time cache updates with `queryClient.setQueryData`.                                         |
| **Zod**             | `^4.6.7`            | Client-side validation via `useZodForm`, field-level errors linked via `aria-describedby` to `<FieldError />`.                                                         |
| **Floating UI**     | `0.27.20`           | Tooltip & popover positioning from `@floating-ui/react`.                                                                                                               |
| **i18n**            | `26.5.5` / `17.1.2` | `i18next` & `react-i18next` localization with namespace bundles in `src/locales/`.                                                                                     |
| **Lucide Icons**    | `^1.61.0`           | SVG icons from `lucide-react`.                                                                                                                                         |

---

Zustand selectors must return stable references. Use a shared empty array/object fallback during account changes, rather than allocating a new fallback on each snapshot read. See the [official v5 migration guidance](https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md).

## Directory Architecture

```text
frontend/src/
├── components/
│   ├── admin/             # Dispatch table, staff dialog, filters
│   ├── auth/              # AuthSessionSync, StaffOnly, AccountRequired
│   ├── customer/          # MenuCatalog, CartDrawer, CheckoutModal, OrderHistory
│   ├── forms/             # FieldError, custom form controls
│   ├── layout/            # Navbar, NavigationDrawer, AppActionsContext, Pagination
│   └── tracking/          # OrderTimeline (6-stage stepper), LiveMapTracker, CourierSimulator
├── hooks/
│   ├── useAuth.ts         # User/token selectors & auth actions
│   ├── useDialog.ts       # Native HTMLDialogElement management & focus trap
│   ├── useOrderSocket.ts  # TanStack Query + Socket.io cache synchronization
│   ├── useTheme.ts        # Dark/light theme toggle with persistent class
│   └── useZodForm.ts      # Inline field validation & blur rechecking
├── lib/
│   ├── api.ts             # Typed REST API client & ApiError with fieldErrors
│   ├── authSession.ts     # Zustand session store & cross-tab storage listener
│   ├── cart.ts            # Account-scoped Zustand cart & explicit localStorage sync
│   ├── queryClient.ts     # Singleton QueryClient instance
│   └── socket.ts          # Singleton Socket.io client with auth reconnection
├── pages/                 # Route page components (MenuPage, TrackingPage, etc.)
├── router.tsx             # Typed TanStack Router route tree definition
├── index.css              # Tailwind v4 cascade layers, themes, and keyframes
└── main.tsx               # QueryClientProvider, AuthSessionSync, RouterProvider
```

---

## 1. Creating a New Page (Step-by-Step)

Follow this exact pattern when introducing a new route/page:

### Step A: Define the Page Component in `src/pages/<Name>Page.tsx`

```tsx
import { useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function MyFeaturePage() {
  const { page, size } = useSearch({ from: '/my-feature' });

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-feature', page, size],
    queryFn: () => api.myFeature.getPage({ page, size }),
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-100">
          Feature Title
        </h1>
      </div>
      {isLoading ? (
        <div role="status" className="p-8 text-center text-sm text-slate-400">
          Loading…
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-2xl">{/* Render content */}</div>
      )}
    </section>
  );
}
```

### Step B: Add Search Schema in `src/lib/listSearch.ts` (if URL state is needed)

```typescript
import { z } from '@kitchentodoor/shared/zod';
import { PageNumberSchema, PageSizeSchema } from '@kitchentodoor/shared';

export const MyFeatureSearchSchema = z.object({
  page: PageNumberSchema.catch(1),
  size: PageSizeSchema.catch(10),
  q: z.string().trim().max(100).catch(''),
});
```

### Step C: Register the Route in `src/router.tsx`

```typescript
import { MyFeatureSearchSchema } from './lib/listSearch';

const myFeatureRoute = createRoute({
  getParentRoute: () => rootRoute, // Or staffRoute for protected views
  path: 'my-feature',
  validateSearch: MyFeatureSearchSchema,
  search: { middlewares: [stripSearchParams({ page: 1, size: 10, q: '' })] },
  component: lazyRouteComponent(() => import('./pages/MyFeaturePage'), 'MyFeaturePage'),
});

// Add to route tree children array:
rootRoute.addChildren([
  menuRoute,
  // ...
  myFeatureRoute,
]);
```

---

## 2. Navigation & Links

Always use typed `<Link>` elements instead of click handlers with state for page transitions:

```tsx
import { Link } from '@tanstack/react-router';

<Link
  to="/tracking/$orderId"
  params={{ orderId: order.id }}
  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition active:scale-95"
>
  Track Order
</Link>;
```

---

## 3. Form Validation with `useZodForm`

Always pair form inputs with `<FieldError />` and `aria-describedby` for accessible, inline feedback:

```tsx
import { useZodForm } from '../../hooks/useZodForm';
import { FieldError } from '../forms/FieldError';
import { MyFormSchema } from '@kitchentodoor/shared';

export function MyForm() {
  const form = useZodForm(MyFormSchema, { email: '', name: '' }, 'my-form');

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = form.validate(e.currentTarget);
    if (!values) return; // Validation failed; first invalid field focused automatically
    // Submit values...
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="my-form-email"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          Email Address
        </label>
        <input
          type="email"
          {...form.field('email')}
          className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <FieldError id="my-form-email-error" message={form.errors.email} />
      </div>
      <button
        type="submit"
        className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs"
      >
        Submit
      </button>
    </form>
  );
}
```

---

## 4. Modal Dialogs with `useDialog`

KitchenToDoor uses native `<dialog>` elements for focus containment, Escape key dismissal, and backdrop blur:

```tsx
import { useDialog } from '../../hooks/useDialog';
import { X } from 'lucide-react';

export function CustomModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useDialog(isOpen);
  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="modal-title"
      className="fixed inset-0 m-auto z-50 w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-slate-100 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id="modal-title" className="font-display font-bold text-lg">
          Modal Title
        </h2>
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* Modal Content */}
    </dialog>
  );
}
```

---

## 5. Themed Dropdown with `ThemedSelect`

Avoid native `<select>` styling bugs by using the accessible `<ThemedSelect />` component:

```tsx
import { ThemedSelect } from '../forms/ThemedSelect';

const statusOptions = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PREPARING', label: 'Preparing' },
];

export function StatusFilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ThemedSelect
      label="Order status"
      value={value}
      options={statusOptions}
      onChange={onChange}
      placement="below"
    />
  );
}
```

---

## 6. Breadcrumbs & Accessibility

Every view under `/orders`, `/tracking`, `/dispatch`, or `/courier` mounts `<Breadcrumbs />` from `src/components/layout/Breadcrumbs.tsx`. It automatically reads TanStack Router's `useLocation()` and builds accessible semantic breadcrumb links with `aria-current="page"`.

---

## 7. View Transitions & Smooth Navigation

Route commits use the router's `startViewTransition` hook and the shared browser helper. Do not pass a `navigateWith` option to TanStack Router:

```typescript
import { startPageTransition } from './lib/pageTransition';

router.startViewTransition = (update) => {
  const disabled = router.shouldViewTransition === false;
  router.shouldViewTransition = undefined;
  return disabled
    ? update()
    : startPageTransition(
        update,
        router.state.resolvedLocation?.pathname,
        router.latestLocation.pathname,
      );
};
```

---

## Reference Documents

For complete templates and reference implementations, consult:

- [`references/new-page-template.md`](./references/new-page-template.md)
