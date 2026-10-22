import { lazy, Suspense, useEffect, useState } from 'react';
import { Download, FileText, RefreshCw, X } from 'lucide-react';
import { api } from '../../lib/api';
import { getDesiredLanguage, useCopy } from '../../lib/i18n';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../hooks/useDialog';
import { IconAction } from '../ui/IconAction';
import { Spinner } from '../layout/Loading';
const ReceiptDocumentPreview = lazy(() =>
  import('./ReceiptDocumentPreview').then((module) => ({ default: module.ReceiptDocumentPreview })),
);

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
  const { user } = useAuth();
  const [previewUserId, setPreviewUserId] = useState<string>();
  const [previewGeneration, setPreviewGeneration] = useState(0);
  const openPreview = () => {
    if (!user) return;
    setPreviewGeneration(0);
    setPreviewUserId(user.id);
  };

  const viewButton =
    variant === 'icon' ? (
      <IconAction
        label={c('View Receipt PDF')}
        aria-label={c('View Receipt PDF for {{number}}', { number: orderNumber })}
        icon={FileText}
        onClick={openPreview}
      />
    ) : (
      <button
        type="button"
        onClick={openPreview}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 text-sm font-bold text-white shadow-sm transition duration-200 hover:border-teal-800 hover:bg-teal-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98] dark:border-teal-500 dark:bg-teal-600 dark:hover:border-teal-400 dark:hover:bg-teal-500"
      >
        <FileText aria-hidden="true" className="h-4 w-4" />
        <span>{c('View Receipt PDF')}</span>
      </button>
    );

  return (
    <>
      {viewButton}
      {previewUserId === user?.id && user && (
        <ReceiptPreviewModal
          key={`${orderId}:${user.id}:${getDesiredLanguage()}:${previewGeneration}`}
          orderId={orderId}
          orderNumber={orderNumber}
          onRetry={() => setPreviewGeneration((generation) => generation + 1)}
          onClose={() => setPreviewUserId(undefined)}
        />
      )}
    </>
  );
}

export function ReceiptPreviewModal({
  orderId,
  orderNumber,
  onRetry,
  onClose,
}: {
  orderId: string;
  orderNumber: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const c = useCopy();
  const language = getDesiredLanguage();
  const [receipt, setReceipt] = useState<Blob>();
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  const dialog = useDialog(true);

  useEffect(() => {
    const controller = new AbortController();

    void api.orders
      .downloadReceipt(orderId, language, controller.signal)
      .then((pdf) => {
        if (controller.signal.aborted) return;
        setReceipt(pdf);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });

    return () => {
      controller.abort();
    };
  }, [language, orderId]);

  const download = () => {
    if (!receipt) return;
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
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="receipt-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto h-[min(90dvh,56rem)] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
          <div className="min-w-0">
            <h2 id="receipt-preview-title" className="font-display text-lg font-bold">
              {c('Receipt Preview')}
            </h2>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
              {orderNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={c('Close Receipt Preview')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div
          role="region"
          aria-label={c('Receipt Preview')}
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-y-auto bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 dark:bg-slate-950"
          aria-busy={pending || undefined}
        >
          {receipt && (
            <Suspense
              fallback={
                <div role="status" className="flex justify-center gap-3 p-8 text-sm">
                  <Spinner />
                  {c('Loading receipt preview…')}
                </div>
              }
            >
              <ReceiptDocumentPreview key={language} receipt={receipt} />
            </Suspense>
          )}

          {pending && (
            <div
              role="status"
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-100/95 text-sm text-slate-600 dark:bg-slate-950/95 dark:text-slate-300"
            >
              <Spinner />
              <span>{c('Loading receipt preview…')}</span>
            </div>
          )}

          {failed && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-slate-100 px-6 text-center dark:bg-slate-950">
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                {c('The receipt preview could not be loaded. Please try again.')}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-500/60 dark:hover:bg-teal-500/10 dark:hover:text-teal-200"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                {c('Try Again')}
              </button>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            {c('Cancel')}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={!receipt || pending}
            aria-busy={pending || undefined}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 text-sm font-bold text-white shadow-sm transition duration-200 hover:border-teal-800 hover:bg-teal-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:border-teal-500 dark:bg-teal-600 dark:hover:border-teal-400 dark:hover:bg-teal-500"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {c('Download Receipt')}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
