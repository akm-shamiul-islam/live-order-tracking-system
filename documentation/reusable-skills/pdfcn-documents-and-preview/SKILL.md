---
name: pdfcn-documents-and-preview
description: Choose Forme or Takumi with PDFCN, generate branded authorized PDFs from server data, package fonts and trusted images, and provide a responsive browser preview without editing controls.
---

# PDFCN documents and preview

Inspect the host's document type, runtime, languages, asset trust, access rules and brand tokens. Read [the source map](references/kitchentodoor.md) for the Forme receipt implementation and official sources. The renderer decision below is guidance inferred from the documented capabilities and this implementation, not a performance benchmark.

## Choose the renderer

PDFCN distributes source components/blocks via a registry; the selected engine produces PDF bytes. It is not a hosted PDF service requiring an API key. Its React components can run in a document-generation service even when the application's UI uses another framework. [PDFCN installation](https://www.pdfcn.dev/docs/installation) documents the two registry namespaces.

| Project need | Candidate and decision criteria |
| --- | --- |
| Dynamic invoices, receipts, long tables, contracts/reports | **Forme** is a natural fit for explicit document primitives, page-native flow, repeated table headers and fixed footers. Validate the largest real document and script coverage. This is the installed KitchenToDoor path. |
| Branded documents closely related to existing HTML/JSX/CSS layouts or a graphics pipeline | **Takumi** can be a good fit when shared layout vocabulary matters. `takumi-pdf` accepts JSX/HTML/node trees and CSS, with paged output; the Takumi ecosystem also provides image outputs. Validate supported CSS, fonts and page breaks. |
| Reports/invoices supported by either | Prototype representative overflow, table/header repetition, multilingual text, assets and deployment cold start. Choose by verified layout correctness and runtime requirements. Both support multiple pages; Takumi is not limited to single-page images. |
| Non-React frontend or backend | Keep a Node document service/worker if using React PDFCN components, or evaluate an engine's supported native/HTML adapter. Preserve the authorized server snapshot and preview contract independently of the rendering framework. |

See [Forme quickstart](https://docs.formepdf.com/quickstart), [page breaks](https://docs.formepdf.com/page-breaks) and [Takumi PDF](https://takumi.kane.tw/docs/pdf). Takumi's [pagination guide](https://takumi.kane.tw/docs/pdf/pagination) describes CSS fragmentation controls. Confirm installed APIs rather than assuming all engine/style props are interchangeable.

## Setup and document design

For CLI installation, use a compatible shadcn configuration while preserving the target's framework, aliases and CSS setup. A server-only package or unsupported frontend can instead copy audited registry source manually or use the engine's primitives; creating another web application is unnecessary. Merge the PDFCN namespace into `components.json` without replacing other registries, as documented in the [official registry setup](https://www.pdfcn.dev/docs/registry):

```json
{
  "registries": {
    "@pdfcn": "https://pdfcn.dev/r/{name}.json"
  }
}
```

Install only the chosen base. Inspect the registry diff/dependencies before accepting generated code:

```bash
# Choose one matching your document engine:
pnpm dlx shadcn@latest add @pdfcn/forme/invoice-minimal
pnpm dlx shadcn@latest add @pdfcn/takumi/invoice-minimal
```

Adapt the commands to the target package manager, aliases and registry configuration; do not run both by default. Forme uses `@formepdf/react` document primitives and `@formepdf/core` rendering. Takumi uses `takumi-pdf` and its documented helpers/primitives. Declare renderer/React dependencies in the workspace that imports them, pin compatible runtime packages and inspect build/WASM requirements. Native Node TypeScript stripping does not transform TSX/JSX; compile document components or use a supported JSX runner. A Next.js document endpoint must use a runtime supported by the chosen renderer/dependencies, including any native image library, and keep generation in server code.

Create a separate print theme mapped from the host brand: logo, accent, readable text, borders, spacing and status tokens. Resolve CSS variables/OKLCH into engine-supported concrete colors; PDFCN's [Forme theming](https://www.pdfcn.dev/docs/theming/forme) specifies hex theme tokens. Keep the document legible on white paper and independent of the current UI theme.

Use semantic headings and real tables, clear totals, page numbers and deliberate pagination. Embed licensed fonts for every locale, including CJK, with the weights actually used. Bundle runtime assets into the deployed artifact; verify the compiled process can find them. A browser WOFF2 or a variable font is not automatically a supported PDF font. Follow [Forme font documentation](https://docs.formepdf.com/fonts) and test the installed version.

For the reference receipt: centered brand/title, order/date row, customer/status cards, pale-accent item header, white rows, trusted thumbnails, right-aligned totals and separate history page. Reuse those information priorities in another project while following its print identity; do not hardcode food/order sections into unrelated reports.

## Authorized generation

1. Authenticate and authorize each document request against persisted ownership/current role. Apply the same unknown/other-owner not-found policy where identifiers are private. Browser visibility checks cannot authorize a download.
2. Fetch a trusted server snapshot and validate it. Generate saved amounts/history from that snapshot; accept only bounded identifiers/options such as locale, never caller-supplied totals/customer data/template code.
3. Use a trusted asset catalog or restricted storage lookup. Do not fetch arbitrary client-supplied URLs/paths inside a renderer: that can expose internal services or files. Bound image decode bytes/pixels, document size and generation workload.
4. Return `application/pdf`, `Cache-Control: no-store`, a sanitized filename and appropriate Content-Disposition. An authenticated fetch can preview an attachment response as a Blob; it does not require a public inline URL. Rate-limit expensive generation.
5. Keep the server artifact authoritative. If a product needs proof that a distributed document is authentic, evaluate digital signatures/certification and verification against server records explicitly. Removing viewer buttons cannot provide that guarantee.

## Browser preview without editing controls

Open a loading modal/page and fetch through the authenticated API; render pages only after validating the response is nonempty `application/pdf` bytes. Never send JSON/HTML error bodies to the PDF parser. Lazy-load a maintained PDF.js build and its **matching local worker**, using the host bundler's documented URL handling. Render pages to canvases with editing/annotation controls disabled, and include accessible page labels/text. The reference uses `annotationMode: 0` and `isEditing: false`; verify these options in the installed PDF.js types. Do not create an annotation/editor layer.

Fit pages to the measured container with a ResizeObserver, bound pixel ratio/memory, cancel overlapping render tasks and destroy document/loading tasks on close/change. Large documents may need page virtualization and maximum-page limits. Show loading/failure with retry and a footer download of the **same Blob**. Revoke any created object URLs. Close or discard stale requests when account/locale/document identity changes.

Use the host's modal border, theme, typography and footer button pattern; keep the PDF page itself print-colored. Test footer wrapping, Escape/focus restoration and mobile scrolling. Avoid untrusted document scripts and external-resource loading; the source previews its own server-generated files. See [PDF.js rendering examples](https://mozilla.github.io/pdf.js/examples/).

The preview prevents edits through this application UI and exposes no update endpoint. Anyone allowed to see/download bytes may copy, screenshot or edit their own local file. Explain this boundary when a request says “cannot make changes”; enforce stored-record integrity on the server rather than promising an uneditable distributed PDF.

## Environment

| Scope | Source setting | Default / requirement |
| --- | --- | --- |
| Existing backend | `MONGODB_URI`, `JWT_SECRET`, exact `FRONTEND_URL` | Reuse authenticated document/data access |
| Server | `RECEIPT_RATE_LIMIT_MAX`, `RATE_LIMIT_TTL_MS` | `10` requests per `60000` ms |
| Server | `RECEIPT_TIME_ZONE` | `UTC`; validate an IANA zone and print the zone with timestamps |
| Deployment | `SERVE_FRONTEND`, `PUBLIC_APP_URL` | Existing hosting/CSP configuration; true and HTTPS canonical origin for the source combined production server |
| Browser | None specific | Same-origin authenticated request and bundled local worker; no PDF service key |

No Forme/Takumi cloud credentials are needed for the local library workflow. Fonts/images/locales are build assets, not secrets. The source app's production SMTP requirement belongs to auth startup, not PDF rendering. If adding a hosted renderer or signed storage URLs in another project, document those **new** credentials, expirations and access checks separately.

## Acceptance criteria

Test anonymous/other-owner/wrong-role requests, malformed IDs/locales, no-store and sanitized disposition. Render short/long multilingual documents and inspect actual text, page count, repeated headers/footers, complete rows, totals, clipping, fonts and image paths. Start from compiled output with network access unavailable to prove local assets work. Verify preview task cleanup, resize/reduced memory, account switch, keyboard/mobile layout, matching worker/CSP and download/preview byte identity.
