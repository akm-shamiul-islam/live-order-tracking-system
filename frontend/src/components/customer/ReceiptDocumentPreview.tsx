import { useEffect, useRef, useState } from 'react';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCopy } from '../../lib/i18n';
import { LoadingState, Spinner } from '../layout/Loading';

GlobalWorkerOptions.workerSrc = workerUrl;

export function ReceiptDocumentPreview({ receipt }: { receipt: Blob }) {
  const c = useCopy();
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;
    void receipt
      .arrayBuffer()
      .then(async (buffer) => {
        if (!active) return;
        // PDFCN/Forme generates the document; PDF.js only renders its pages. No annotation/editor UI is created.
        task = getDocument({ data: new Uint8Array(buffer), useWasm: false });
        const pdf = await task.promise;
        if (active) setDocument(pdf);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      void task?.destroy().catch(() => undefined);
    };
  }, [receipt]);
  if (failed)
    return (
      <p role="alert" className="p-8 text-center text-sm text-rose-700 dark:text-rose-300">
        {c('The PDF could not be displayed. You can still download the receipt below.')}
      </p>
    );
  if (!document) return <LoadingState label={c('Loading receipt preview…')} />;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-3 sm:p-6">
      {Array.from({ length: document.numPages }, (_, index) => (
        <ReceiptPage key={index + 1} document={document} number={index + 1} />
      ))}
    </div>
  );
}

function ReceiptPage({ document, number }: { document: PDFDocumentProxy; number: number }) {
  const c = useCopy();
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!container.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setReady(false);
        setWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!width || !canvas.current) return undefined;
    let active = true;
    let render: RenderTask | undefined;
    const target = canvas.current;
    void document
      .getPage(number)
      .then(async (page) => {
        if (!active) return;
        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        target.width = Math.floor(viewport.width * pixelRatio);
        target.height = Math.floor(viewport.height * pixelRatio);
        target.style.width = `${viewport.width}px`;
        target.style.height = `${viewport.height}px`;
        render = page.render({
          canvas: target,
          viewport,
          transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
          annotationMode: 0,
          isEditing: false,
        });
        await render.promise;
        const content = await page.getTextContent();
        if (active) {
          setText(content.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(' '));
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof Error && error.name === 'RenderingCancelledException'))
          setFailed(true);
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [document, number, width]);
  return (
    <div
      ref={container}
      className="relative min-h-32 overflow-hidden rounded-md bg-white shadow-lg"
    >
      <canvas
        ref={canvas}
        role="img"
        aria-label={c('Receipt Page {{page}} of {{count}}', {
          page: number,
          count: document.numPages,
        })}
        className="block max-w-full"
      />
      <p className="sr-only">{text}</p>
      {!ready && !failed && (
        <div
          role="status"
          className="absolute inset-0 grid place-items-center bg-white/90 text-teal-700"
        >
          <Spinner className="h-7 w-7" />
          <span className="sr-only">{c('Loading receipt preview…')}</span>
        </div>
      )}
      {failed && (
        <p role="alert" className="p-5 text-sm text-rose-700">
          {c('The PDF could not be displayed. You can still download the receipt below.')}
        </p>
      )}
    </div>
  );
}
