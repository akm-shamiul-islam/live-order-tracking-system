// TanStack's commit hook must return the DOM update promise, not the animation's
// completion. A skipped snapshot must not reject an otherwise successful route.
export function startPageTransition(
  update: () => Promise<void>,
  fromPathname: string | undefined,
  toPathname: string,
): Promise<void> {
  if (
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    !window.CSS?.supports?.('selector(:active-view-transition-type(page-navigation))') ||
    !fromPathname ||
    fromPathname === toPathname ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return update();

  const transition = document.startViewTransition({ update, types: ['page-navigation'] });
  void transition.ready.catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === 'AbortError'))
      console.warn('Page animation was skipped.', error);
  });
  return transition.updateCallbackDone;
}
