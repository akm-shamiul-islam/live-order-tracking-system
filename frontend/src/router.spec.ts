import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './router';

describe('Application URLs', () => {
  it.each([
    { url: '/', params: {}, staff: false },
    { url: '/tracking', params: {}, staff: false },
    { url: '/tracking/KTD-1234', params: { orderId: 'KTD-1234' }, staff: false },
    { url: '/orders', params: {}, staff: false },
    { url: '/dispatch', params: {}, staff: true },
    { url: '/courier', params: {}, staff: true },
    {
      url: '/courier/64f1a2b3c4d5e6f7a8b9c0d1',
      params: { orderId: '64f1a2b3c4d5e6f7a8b9c0d1' },
      staff: true,
    },
  ])('loads a directly opened page at $url', async ({ url, params, staff }) => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [url] }),
    });
    await router.load();
    expect(router.state.matches.every((match) => match.status === 'success')).toBe(true);
    expect(router.state.matches.at(-1)?.pathname.replace(/\/$/, '') || '/').toBe(url);
    expect(router.state.matches.some((match) => match.routeId === '/staff')).toBe(staff);
    expect(router.state.matches.at(-1)?.params).toEqual(params);
  });

  it('preserves the selected order through navigation and browser history', async () => {
    const history = createMemoryHistory({ initialEntries: ['/tracking/KTD-1234'] });
    const router = createRouter({ routeTree, history });
    await router.load();
    // In Node the router runs in server mode; drive memory history like a browser.
    history.push(router.buildLocation({ to: '/orders' }).href);
    await router.load();
    expect(history.location.pathname).toBe('/orders');
    history.back();
    await router.load();
    expect(history.location.pathname).toBe('/tracking/KTD-1234');
    expect(router.state.matches.at(-1)?.params).toMatchObject({ orderId: 'KTD-1234' });
  });

  it('matches only the root not-found boundary for unknown pages', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/missing-page'] }),
    });
    await router.load();
    expect(router.state.matches.map((match) => match.routeId)).toEqual(['__root__']);
    expect(router.state.location.pathname).toBe('/missing-page');
  });
});
