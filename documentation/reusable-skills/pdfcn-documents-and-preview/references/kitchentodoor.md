# KitchenToDoor PDF source map and research

Reviewed against repository code and official documentation on **2026-10-23**.

| Repository-relative source | Responsibility |
| --- | --- |
| `backend/src/receipts/render-order-receipt.ts` | Forme primitives/renderDocument, validated locale copy, local fonts/images, layout, saved pricing and history pages |
| `backend/src/receipts/receipt.service.ts` | Customer/admin role gate and actor-aware authorized order snapshot |
| `backend/src/orders/orders.controller.ts` | Receipt endpoint, language validation, rate limit, PDF headers and filename |
| `backend/scripts/copy-receipt-assets.ts` | Copies fonts/locales and uses Sharp to convert trusted catalog WebP to receipt JPEG |
| `backend/src/receipts/fonts/README.md`, `backend/src/receipts/fonts/OFL-1.1.txt` | Licensed static Noto Sans JP assets and provenance |
| `frontend/src/components/customer/ReceiptDownloadButton.tsx` | Account/locale-bound modal, lazy preview, fetch/retry and same-Blob download |
| `frontend/src/components/customer/ReceiptDocumentPreview.tsx` | PDF.js matching local worker, no annotation/editor controls, canvas sizing, text extraction and cleanup |
| `.agents/skills/ktd-pdf-generation/SKILL.md` | Existing project-specific implementation rules |

Installed engine: exact `@formepdf/core`/`@formepdf/react` **0.28.0** with React 19.3.1; preview: `pdfjs-dist` **6.4.299**; images: Sharp **0.35.5**. The renderer directly composes Forme primitives in the PDFCN design approach; do not imply an `@pdfcn` hosted package/remote service is called at runtime. Takumi is not installed.

Installed-version observations worth preserving: trusted JPEG bytes are embedded as data URIs because this Node adapter did not read local image paths into WASM; source WebP assets are converted to JPEG at build time. Rounded thumbnails/tables need an actual clipping parent. Register fixed footers before content, and verify right-aligned totals in rendered output rather than assuming browser CSS behavior.

The preview has accessible extracted text with canvas pages, a bounded device-pixel ratio and cancellation on resize/unmount. Its API helper checks PDF content type, nonempty bytes and captured auth identity before returning the Blob. It provides no editing UI; access to PDF bytes remains access to a copy of the document. The app regenerates a receipt from the order's current authorized snapshot with saved prices; it does not archive/sign an immutable receipt artifact.

Official references for future implementation/upgrades:

- [PDFCN introduction](https://www.pdfcn.dev/docs): source-owned components and two rendering bases.
- [PDFCN installation](https://www.pdfcn.dev/docs/installation), [registry setup](https://www.pdfcn.dev/docs/registry) and [Forme themes](https://www.pdfcn.dev/docs/theming/forme): namespace mapping, installation and design-token integration.
- [Forme quickstart](https://docs.formepdf.com/quickstart), [fonts](https://docs.formepdf.com/fonts) and [page breaks](https://docs.formepdf.com/page-breaks): engine-specific primitives/assets/pagination.
- [Takumi PDF](https://takumi.kane.tw/docs/pdf) and [pagination](https://takumi.kane.tw/docs/pdf/pagination): paged JSX/HTML/CSS and fragmentation.
- [PDF.js examples](https://mozilla.github.io/pdf.js/examples/): document/page promises and viewport/canvas rendering.

APIs evolve beyond installed 0.28.0; current online docs are not evidence that a newer capability exists in the pinned engine. The skill's renderer matrix is an engineering recommendation, not proof that one renderer is universally faster or supports every browser CSS feature.

Existing verification: `backend/src/orders/orders.integration.ts`, `scripts/verify-profiles.ts` and `.agents/skills/ktd-pdf-generation/references/order-receipt-pdfcn-template.tsx`. Browser checks inspect real PDF text/canvases, bilingual output, footer controls and authenticated access.
