import { afterEach, describe, expect, it, vi } from 'vitest';
import { transitionAppearance } from './appearanceTransition';

describe('Theme and language snapshot transitions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it.each(['theme-change', 'language-change'] as const)(
    'handles an interrupted %s snapshot',
    async (type) => {
      const update = vi.fn<() => void>();
      const start = vi.fn<
        (options: {
          update: () => void;
          types: string[];
        }) => Pick<ViewTransition, 'ready' | 'updateCallbackDone'>
      >((options) => ({
        ready: Promise.reject(new DOMException('New transition started', 'AbortError')),
        updateCallbackDone: Promise.resolve().then(options.update),
      }));
      vi.stubGlobal('document', { startViewTransition: start });
      vi.stubGlobal('window', {
        CSS: { supports: () => true },
        matchMedia: () => ({ matches: false }),
      });
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await transitionAppearance(type, update);
      expect(update).toHaveBeenCalledOnce();
      expect(start.mock.calls[0]?.[0].types).toEqual([type]);
      expect(warning).not.toHaveBeenCalled();
    },
  );
  it.each(['reduced-motion', 'unsupported'] as const)('updates directly for %s', async (mode) => {
    const native = vi.fn<() => ViewTransition>();
    const update = vi.fn<() => void>();
    vi.stubGlobal('document', mode === 'unsupported' ? {} : { startViewTransition: native });
    vi.stubGlobal('window', {
      CSS: { supports: () => true },
      matchMedia: () => ({ matches: true }),
    });
    await transitionAppearance('theme-change', update);
    expect(update).toHaveBeenCalledOnce();
    expect(native).not.toHaveBeenCalled();
  });

  it('preserves a real update failure for the caller', async () => {
    const failure = new Error('Failed update');
    vi.stubGlobal('document', {
      startViewTransition: (options: { update: () => void }) => ({
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve().then(options.update),
      }),
    });
    vi.stubGlobal('window', {
      CSS: { supports: () => true },
      matchMedia: () => ({ matches: false }),
    });
    await expect(
      transitionAppearance('theme-change', () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
