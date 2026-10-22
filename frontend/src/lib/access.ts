import { UserRole } from '@kitchentodoor/shared';

// Shared by the drawer and page guards; API authorization is enforced separately.
export function canOpenPage(path: string, role?: UserRole): boolean {
  if (path === '/' || path.startsWith('/account')) return true;
  if (!role) return false;
  if (path.startsWith('/users') || path.startsWith('/dispatch')) return role === UserRole.ADMIN;
  if (path.startsWith('/courier')) return role === UserRole.COURIER || role === UserRole.ADMIN;
  return (
    path.startsWith('/orders') ||
    path.startsWith('/tracking') ||
    path === '/profile' ||
    path === '/notifications'
  );
}

export function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 1000 || /[\\\r\n]/.test(value)) return undefined;
  if (value === '/') return value;
  if (!/^\/(?:orders|dispatch|courier|tracking|users|profile|notifications)(?:[/?#]|$)/.test(value))
    return undefined;
  return value;
}

export function roleHome(role: UserRole): '/dispatch' | '/courier' | '/orders' {
  return role === UserRole.ADMIN ? '/dispatch' : role === UserRole.COURIER ? '/courier' : '/orders';
}
