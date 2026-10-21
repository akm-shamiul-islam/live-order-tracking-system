import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../../lib/api';
import { getDesiredLanguage, useCopy } from '../../lib/i18n';
import { IconAction } from '../ui/IconAction';
import { Spinner } from '../layout/Loading';

export function ReceiptDownloadButton({
  orderId,
  orderNumber,
  variant,
}: {
  orderId: string;
  orderNumber: string;
  variant: 'icon' | 'button';
}) {
  const c = useCopy();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  const download = async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    setFailed(false);
    try {
      const receipt = await api.orders.downloadReceipt(
        orderId,
        getDesiredLanguage(),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(receipt);
      const anchor = document.createElement('a');
      const filename = orderNumber.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'order';
      anchor.href = url;
      anchor.download = `KitchenToDoor-Receipt-${filename}.pdf`;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  };

  const button =
    variant === 'icon' ? (
      <IconAction
        label={c('Download receipt PDF')}
        aria-label={c('Download receipt PDF for {{number}}', { number: orderNumber })}
        icon={Download}
        pending={pending}
        disabled={pending}
        onClick={() => void download()}
      />
    ) : (
      <button
        type="button"
        onClick={() => void download()}
        disabled={pending}
        aria-busy={pending || undefined}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 text-sm font-bold text-white shadow-sm transition duration-200 hover:border-teal-800 hover:bg-teal-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 motion-safe:active:scale-[0.98] dark:border-teal-500 dark:bg-teal-600 dark:hover:border-teal-400 dark:hover:bg-teal-500"
      >
        {pending ? <Spinner /> : <Download aria-hidden="true" className="h-4 w-4" />}
        <span>{c(pending ? 'Downloading receipt…' : 'Download receipt')}</span>
      </button>
    );

  return (
    <div className={variant === 'icon' ? 'flex flex-col items-center gap-1' : 'space-y-1'}>
      {button}
      {failed && (
        <p
          role="alert"
          className={`text-xs text-rose-700 dark:text-rose-300 ${variant === 'icon' ? 'max-w-48 text-center' : ''}`}
        >
          {c('The receipt could not be downloaded. Please try again.')}
        </p>
      )}
    </div>
  );
}
