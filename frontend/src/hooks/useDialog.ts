import { useEffect, useRef } from 'react';

export function useDialog(isOpen: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
  return dialogRef;
}
