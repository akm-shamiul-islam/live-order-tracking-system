import { useEffect, useState } from 'react';
import type { TypedSocket } from '../lib/socket';
import { runWhenIdle } from '../lib/idle';

export function useDeferredSocket(enabled = true) {
  const [socket, setSocket] = useState<TypedSocket>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const cancel = runWhenIdle(() => {
      void import('../lib/socket')
        .then((module) => {
          if (active) setSocket(module.getSocket());
        })
        .catch(() => {
          // HTTP polling continues if the optional live connection cannot load.
        });
    });
    return () => {
      active = false;
      cancel();
    };
  }, [enabled]);
  return enabled ? socket : undefined;
}
