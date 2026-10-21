import { useEffect, useRef } from 'react';

export function useDialog(isOpen: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ].filter(
        (element) =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== 'hidden' &&
          !element.closest('[inert]'),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', containFocus);
    return () => {
      dialog.removeEventListener('keydown', containFocus);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen]);
  return dialogRef;
}
