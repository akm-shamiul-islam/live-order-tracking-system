import { useCopy } from '../../lib/i18n';
import {
  cloneElement,
  useCallback,
  useState,
  type HTMLProps,
  type ReactElement,
  type Ref,
} from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
  useTransitionStyles,
  safePolygon,
} from '@floating-ui/react';

export function Tooltip({
  label,
  children,
  triggerRef,
}: {
  label: string;
  children: ReactElement<HTMLProps<HTMLElement>>;
  triggerRef?: Ref<HTMLElement>;
}) {
  const c = useCopy();

  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const {
    refs: elements,
    floatingStyles,
    context,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    strategy: 'fixed',
    placement: 'top',
    middleware: [offset(9), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(context, {
    move: false,
    delay: { open: 280, close: 80 },
    handleClose: safePolygon(),
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context, { referencePress: true });
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);
  const captureRoot = useCallback(
    (node: HTMLElement | null) => {
      elements.setReference(node);
      if (node) setPortalRoot(node.closest('dialog') ?? document.body);
    },
    [elements],
  );
  const ref = useMergeRefs([triggerRef, captureRoot]);
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => elements.setFloating(node),
    [elements],
  );
  const { isMounted, styles } = useTransitionStyles(context, {
    duration: { open: 140, close: 100 },
    initial: { opacity: 0, transform: 'translateY(3px) scale(.97)' },
  });
  return (
    <>
      {cloneElement(children, { ...getReferenceProps(children.props), ref })}
      {isMounted && portalRoot && (
        <FloatingPortal root={portalRoot}>
          <div
            ref={setFloating}
            style={{ ...floatingStyles, zIndex: 1000 }}
            {...getFloatingProps()}
          >
            <div
              className="themed-tooltip max-w-72 rounded-xl border border-teal-200 bg-white/95 px-3 py-2 text-center text-xs font-semibold leading-relaxed text-slate-800 shadow-xl shadow-teal-950/15 backdrop-blur-sm dark:border-teal-700/60 dark:bg-slate-900/95 dark:text-teal-100 dark:shadow-black/40"
              style={styles}
            >
              {c(label)}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
