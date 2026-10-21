// Start optional live UI after the browser can paint; the deadline keeps busy pages connected.
export function runWhenIdle(work: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(work, { timeout: 1000 });
    return () => window.cancelIdleCallback(id);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(work, 0);
  });
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}
