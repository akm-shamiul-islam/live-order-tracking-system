import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { useAppActions } from '../components/layout/AppActionsContext';
import { getSession } from '../lib/authSession';

export function useUnsavedProfileChanges(userId: string, dirty: boolean, saving: boolean) {
  const { registerLeaveGuard } = useAppActions();
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);
  const prompt = useRef<{ promise: Promise<boolean>; resolve: (allowed: boolean) => void } | null>(
    null,
  );
  const settle = useCallback((allowed: boolean) => {
    const current = prompt.current;
    prompt.current = null;
    setConfirming(false);
    current?.resolve(allowed);
  }, []);
  const ask = useCallback((): Promise<boolean> => {
    if (savedRef.current || getSession().user?.id !== userId || (!dirty && !saving))
      return Promise.resolve(true);
    if (prompt.current) return prompt.current.promise;
    let resolvePrompt!: (allowed: boolean) => void;
    const promise = new Promise<boolean>((resolve) => {
      resolvePrompt = resolve;
    });
    prompt.current = { promise, resolve: resolvePrompt };
    setConfirming(true);
    return promise;
  }, [dirty, saving, userId]);
  useBlocker({
    disabled: saved || (!dirty && !saving),
    shouldBlockFn: async () => !(await ask()),
    enableBeforeUnload: !saved && (dirty || saving),
  });
  useEffect(() => registerLeaveGuard(ask), [registerLeaveGuard, ask]);
  useEffect(
    () => () => {
      prompt.current?.resolve(false);
      prompt.current = null;
    },
    [],
  );
  const markSaved = useCallback(() => {
    savedRef.current = true;
    setSaved(true);
    settle(true);
  }, [settle]);
  return {
    confirming,
    dirty: dirty && !saved,
    ask,
    keepEditing: () => settle(false),
    discard: () => settle(true),
    markSaved,
  };
}
