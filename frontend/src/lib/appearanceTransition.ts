import { flushSync } from 'react-dom';

export function transitionAppearance(
  type: 'theme-change' | 'language-change',
  update: () => void,
): Promise<void> {
  if (
    typeof document.startViewTransition !== 'function' ||
    !window.CSS?.supports?.('selector(:active-view-transition-type(appearance))') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return Promise.resolve();
  }
  const transition = document.startViewTransition({
    types: [type],
    update: () => flushSync(update),
  });
  void transition.ready.catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === 'AbortError'))
      console.warn('Appearance animation was skipped.', error);
  });
  return transition.updateCallbackDone;
}
