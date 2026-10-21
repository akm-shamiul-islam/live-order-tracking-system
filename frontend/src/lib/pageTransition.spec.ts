import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPageTransition } from './pageTransition';

type NativeCommit = (options: {
  update: () => Promise<void>;
  types: string[];
}) => Pick<ViewTransition, 'ready' | 'updateCallbackDone'>;

describe('Native page transition promises', () => {
  const matchMedia = vi.fn<(query: string) => Pick<MediaQueryList, 'matches'>>(() => ({
    matches: false,
  }));
  const supports = vi.fn<(condition: string) => boolean>(() => true);

  beforeEach(() => {
    matchMedia.mockReturnValue({ matches: false });
    supports.mockReturnValue(true);
    vi.stubGlobal('window', { matchMedia, CSS: { supports } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('handles a skipped snapshot while preserving a successful page update', async () => {
    const update = vi.fn<() => Promise<void>>(async () => {});
    const native = vi.fn<NativeCommit>((options) => ({
      ready: Promise.reject(new DOMException('New transition started', 'AbortError')),
      updateCallbackDone: options.update(),
    }));
    vi.stubGlobal('document', { startViewTransition: native });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await startPageTransition(update, '/', '/account');
    expect(update).toHaveBeenCalledOnce();
    expect(native).toHaveBeenCalledWith({ update, types: ['page-navigation'] });
    expect(warning).not.toHaveBeenCalled();
  });

  it('propagates a real page update error to the router', async () => {
    const error = new Error('Page commit failed');
    const update = async () => {
      throw error;
    };
    vi.stubGlobal('document', {
      startViewTransition: (options: { update: () => Promise<void> }) => ({
        ready: Promise.reject(error),
        updateCallbackDone: options.update(),
      }),
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(startPageTransition(update, '/', '/account')).rejects.toBe(error);
    expect(warning).toHaveBeenCalledWith('Page animation was skipped.', error);
  });

  it.each([
    'initial',
    'same-page',
    'reduced-motion',
    'unsupported-types',
    'unsupported-api',
    'server',
  ])('commits without animation for %s', async (mode) => {
    const native = vi.fn<NativeCommit>();
    const update = vi.fn<() => Promise<void>>(async () => {});
    vi.stubGlobal('document', { startViewTransition: native });
    if (mode === 'reduced-motion') matchMedia.mockReturnValue({ matches: true });
    if (mode === 'unsupported-types') supports.mockReturnValue(false);
    if (mode === 'unsupported-api') vi.stubGlobal('document', {});
    if (mode === 'server') vi.stubGlobal('document', undefined);

    await startPageTransition(
      update,
      mode === 'initial' ? undefined : '/',
      mode === 'same-page' ? '/' : '/account',
    );
    expect(update).toHaveBeenCalledOnce();
    expect(native).not.toHaveBeenCalled();
  });
});
