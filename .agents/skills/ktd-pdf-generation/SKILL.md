---
name: ktd-pdf-generation
description: >-
  Guides PDF document and receipt generation using PDFCN (pdfcn.dev) in KitchenToDoor.
  Trigger whenever implementing or updating PDF download, invoice printing, or printable order receipts.
---

# KitchenToDoor: PDF Generation with PDFCN

Use PDFCN's Forme renderer for server-generated order receipts. The current backend uses the exact `@formepdf/core` and `@formepdf/react` versions in `backend/package.json`; check the official PDFCN and Forme documentation when upgrading them.

## Current implementation

- Renderer: `backend/src/receipts/render-order-receipt.ts`.
- Authorization and order lookup: `backend/src/receipts/receipt.service.ts` and the receipt route in `backend/src/orders/orders.controller.ts`.
- Customer downloads: `frontend/src/components/customer/ReceiptDownloadButton.tsx` calls the authenticated API; never render a receipt from client-supplied order data.
- Read-only preview: `ReceiptDocumentPreview.tsx` lazily uses `pdfjs-dist` **6.4.299** with its matching local worker. Render only canvases and accessible text; never add annotation/editor controls or depend on the browser's native PDF plugin. The footer downloads the same authenticated Blob.
- Receipt fonts: licensed static Noto Sans JP TTF files in `backend/src/receipts/fonts/`; `backend/scripts/copy-receipt-assets.ts` copies runtime assets into the build output.
- Receipt food photos: the renderer maps saved item IDs to the trusted shared menu catalog. The asset script uses pinned Sharp `0.35.5` during asset preparation to convert local WebP photos to JPEG because the current Forme Image component supports JPEG/PNG. Never use an order's `imageUrl` as a PDF image path.
- Read trusted JPEG bytes into `data:image/jpeg;base64,...` before rendering. The installed Node adapter resolves HTTP images but does not load local image paths into its WASM renderer. Use a row with `justifyContent: 'flex-end'` around the totals card; verify the rendered result instead of assuming `alignSelf` is honored.
- Locale copy: `frontend/src/locales/en.json` and `ja.json`, validated by the receipt copy schema before rendering.

## Security requirements

1. Authenticate the receipt endpoint and authorize the owner against the persisted customer user ID. Administrators may access receipts for operational support; other roles must be denied.
2. Return the same not-found response for another customer's order as for an unknown order identifier. Do not trust a frontend role check as authorization.
3. Render from the authorized server-side order snapshot. Do not accept customer, price, status, or order-item details from the download request.
4. Return `Cache-Control: no-store`, `Content-Type: application/pdf`, and a sanitized attachment filename. Validate the requested language and apply the configurable receipt rate limit.
5. Keep the PDF independent of the active UI theme, embed local licensed fonts, and escape or safely render all user-controlled order fields through Forme primitives.

## Receipt content and layout

Use the saved order snapshot for the order number, creation time, customer and delivery details, item names and quantities, saved prices, subtotal, delivery fee, tax, total, current status, status history, and cancellation explanation when present. Do not add fields that are absent from the authorized `OrderDetails` contract. Localize headings and food names in English and Japanese, and format timestamps using the configured IANA time zone.

Center the brand and tagline above a divider, then center Order Receipt below it. Keep Order Number and Placed in their existing row. Use slate text and restrained teal accents, with a pale teal-green Items header and white item rows. Center all table headers and numeric cells; keep item names left-aligned. Wrap the table and each thumbnail in a View with borderRadius and overflow: hidden so child backgrounds/images are actually clipped.

Place Customer and Current Status cards side by side, with equally sized headings and smaller details below. Tint the status card with the corresponding application badge color family and retain cancellation explanations. Keep the fixed-width totals card right-aligned below the items. Start Order History on a separate page with PageBreak. Register Fixed page footers before content so they repeat across manual breaks. Verify short and multi-page EN/JA receipts, repeated headers/footers and all items in the actual output.

Use semantic document headings and a table with repeating headers across pages. Keep totals visually distinct and maintain readable contrast. Page footers contain page numbering only; do not restore the removed English/Japanese payment notice. Register fonts on the PDF document and keep font licenses and source hashes beside the assets.

## Verification

- Test owner and administrator downloads, anonymous access, other-customer IDs and tracking IDs, denied roles, invalid languages, and cache headers through the HTTP integration suite.
- Build the backend and verify locale/font assets are copied to `backend/dist/receipts`.
- Smoke-render both locales and inspect that generated bytes begin with `%PDF-` and include the expected text and page structure.
- Consult the official [PDFCN Forme integration](https://www.pdfcn.dev/docs/theming/forme), [Forme quickstart](https://docs.formepdf.com/quickstart), [component reference](https://docs.formepdf.com/components), and [page-break guidance](https://docs.formepdf.com/page-breaks) when changing renderer APIs.

For a concise Forme primitive example using localized labels and trusted local menu images, see [`references/order-receipt-pdfcn-template.tsx`](./references/order-receipt-pdfcn-template.tsx). Treat `render-order-receipt.ts` as the implementation source of truth.
