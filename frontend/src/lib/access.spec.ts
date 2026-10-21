import { describe, expect, it } from 'vitest';
import { UserRole } from '@kitchentodoor/shared';
import { canOpenPage, safeReturnTo } from './access';

describe('Account navigation permissions', () => {
  it('keeps protected menus closed to guests and non-admin accounts', () => {
    for (const path of ['/orders', '/tracking/KTD-1234', '/courier', '/dispatch', '/users'])
      expect(canOpenPage(path)).toBe(false);
    for (const role of [UserRole.CUSTOMER, UserRole.COURIER]) {
      expect(canOpenPage('/users', role)).toBe(false);
      expect(canOpenPage('/dispatch', role)).toBe(false);
    }
    expect(canOpenPage('/courier', UserRole.CUSTOMER)).toBe(false);
    expect(canOpenPage('/courier', UserRole.COURIER)).toBe(true);
    expect(canOpenPage('/users', UserRole.ADMIN)).toBe(true);
  });

  it('rejects external and malformed return URLs before post-login navigation', () => {
    for (const value of [
      'https://example.test',
      '//example.test',
      '/\\example.test',
      '/orders\n',
      '/account/reset',
      {},
      '/orders'.repeat(200),
    ])
      expect(safeReturnTo(value)).toBeUndefined();
    expect(safeReturnTo('/tracking/KTD-1234?view=detail')).toBe('/tracking/KTD-1234?view=detail');
    expect(safeReturnTo('/orders?page=2&size=25')).toBe('/orders?page=2&size=25');
    expect(safeReturnTo('/')).toBe('/');
  });
});
