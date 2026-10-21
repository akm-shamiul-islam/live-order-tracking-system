import { useEffect, useState } from 'react';
import { runWhenIdle } from '../lib/idle';

export function useIdleReady(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    return runWhenIdle(() => setReady(true));
  }, [enabled]);
  return enabled && ready;
}
