import { renderDocument } from '@formepdf/core';
import {
  Cell,
  Document,
  Fixed,
  H1,
  H2,
  Image,
  Page,
  PageBreak,
  Row,
  Table,
  Text,
  View,
  type FontRegistration,
} from '@formepdf/react';
import { createElement, type ReactElement } from 'react';
import { MENU_ITEMS, OrderStatus, type Language, type OrderDetails } from '@kitchentodoor/shared';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const ReceiptCopySchema = z.object({
  food: z.record(z.string(), z.string()),
  receipt: z.object({
    brand: z.string(),
    tagline: z.string(),
    title: z.string(),
    orderNumber: z.string(),
    placed: z.string(),
    customer: z.string(),
    deliveryAddress: z.string(),
    phone: z.string(),
    items: z.string(),
    item: z.string(),
    itemNumber: z.string(),
    quantity: z.string(),
    unitPrice: z.string(),
    amount: z.string(),
    subtotal: z.string(),
    deliveryFee: z.string(),
    tax: z.string(),
    total: z.string(),
    currentStatus: z.string(),
    orderNote: z.string(),
    cancellationReason: z.string(),
    statusHistory: z.string(),
    updatedBy: z.string(),
    page: z.string(),
    statusPlaced: z.string(),
    statusConfirmed: z.string(),
    statusPreparing: z.string(),
    statusReadyForPickup: z.string(),
    statusOutForDelivery: z.string(),
    statusDelivered: z.string(),
    statusCancelled: z.string(),
    orderReceived: z.string(),
  }),
});
type ReceiptCopy = z.infer<typeof ReceiptCopySchema>;

const languageFile = (language: Language) =>
  import.meta.url.endsWith('.ts') || import.meta.url.endsWith('.tsx')
    ? new URL(`../../../frontend/src/locales/${language}.json`, import.meta.url)
    : new URL(`./locales/${language}.json`, import.meta.url);

const copyPromises = new Map<Language, Promise<ReceiptCopy>>();
function getCopy(language: Language): Promise<ReceiptCopy> {
  let pending = copyPromises.get(language);
  if (!pending) {
    pending = readFile(languageFile(language), 'utf8')
      .then((source) => ReceiptCopySchema.parse(JSON.parse(source) as unknown))
      .catch((error: unknown) => {
        copyPromises.delete(language);
        throw error;
      });
    copyPromises.set(language, pending);
  }
  return pending;
}

const fontFile = (name: string) => new URL(`./fonts/${name}`, import.meta.url);
let fontPromise: Promise<FontRegistration[]> | undefined;
function getFonts(): Promise<FontRegistration[]> {
  fontPromise ??= Promise.all([
    readFile(fontFile('noto-sans-jp-japanese-400-normal.ttf')),
    readFile(fontFile('noto-sans-jp-japanese-700-normal.ttf')),
    readFile(fontFile('noto-sans-jp-latin-400-normal.ttf')),
    readFile(fontFile('noto-sans-jp-latin-700-normal.ttf')),
  ]).then(([japaneseRegular, japaneseBold, latinRegular, latinBold]) => [
    { family: 'Noto Sans JP', src: japaneseRegular, fontWeight: 400 },
    { family: 'Noto Sans JP', src: japaneseBold, fontWeight: 700 },
    { family: 'Noto Sans JP Latin', src: latinRegular, fontWeight: 400 },
    { family: 'Noto Sans JP Latin', src: latinBold, fontWeight: 700 },
  ]);
  return fontPromise;
}

const statusLabels: Record<OrderStatus, keyof ReceiptCopy['receipt']> = {
  [OrderStatus.PLACED]: 'statusPlaced',
  [OrderStatus.CONFIRMED]: 'statusConfirmed',
  [OrderStatus.PREPARING]: 'statusPreparing',
  [OrderStatus.READY_FOR_PICKUP]: 'statusReadyForPickup',
  [OrderStatus.OUT_FOR_DELIVERY]: 'statusOutForDelivery',
  [OrderStatus.DELIVERED]: 'statusDelivered',
  [OrderStatus.CANCELLED]: 'statusCancelled',
};

// Match the light-mode badge hues used throughout the application on white PDF pages.
const statusColors: Record<OrderStatus, { background: string; border: string; text: string }> = {
  [OrderStatus.PLACED]: { background: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
  [OrderStatus.CONFIRMED]: { background: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  [OrderStatus.PREPARING]: { background: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
  [OrderStatus.READY_FOR_PICKUP]: { background: '#eef2ff', border: '#c7d2fe', text: '#4338ca' },
  [OrderStatus.OUT_FOR_DELIVERY]: { background: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
  [OrderStatus.DELIVERED]: { background: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
  [OrderStatus.CANCELLED]: { background: '#fff1f2', border: '#fecdd3', text: '#be123c' },
};

function formatTimestamp(value: string, language: Language, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(language === 'ja' ? 'ja-JP' : 'en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}/${part('month')}/${part('day')}, ${part('hour')}:${part('minute')}:${part('second')} (${timeZone})`;
}

const currency = (amount: number, language: Language) =>
  new Intl.NumberFormat(language === 'ja' ? 'ja-JP' : 'en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);

const trustedMenuImages = new Map(MENU_ITEMS.map(({ id, photo }) => [id, photo]));
function itemImagePath(itemId: string): URL | undefined {
  const photo = trustedMenuImages.get(itemId);
  if (!photo) return undefined;
  const imageUrl = import.meta.url.endsWith('.ts')
    ? new URL(`../../dist/receipts/images/${photo}.jpg`, import.meta.url)
    : new URL(`./images/${photo}.jpg`, import.meta.url);
  return imageUrl;
}
const imagePromises = new Map<string, Promise<string>>();
async function getItemImages(order: OrderDetails): Promise<ReadonlyMap<string, string>> {
  const entries = await Promise.all(
    [...new Set(order.items.map((item) => item.itemId))].map(async (id) => {
      const path = itemImagePath(id);
      if (!path) return undefined;
      let pending = imagePromises.get(id);
      if (!pending) {
        pending = readFile(path)
          .then((bytes) => `data:image/jpeg;base64,${bytes.toString('base64')}`)
          .catch((error: unknown) => {
            imagePromises.delete(id);
            throw error;
          });
        imagePromises.set(id, pending);
      }
      return [id, await pending] as const;
    }),
  );
  return new Map(
    entries.filter((entry): entry is readonly [string, string] => entry !== undefined),
  );
}

function ReceiptDocument({
  order,
  language,
  timeZone,
  copy,
  fonts,
  images,
}: {
  order: OrderDetails;
  language: Language;
  timeZone: string;
  copy: ReceiptCopy;
  fonts: FontRegistration[];
  images: ReadonlyMap<string, string>;
}): ReactElement {
  const h = createElement;
  const labels = copy.receipt;
  const status = (value: OrderStatus) => labels[statusLabels[value]];
  const statusColor = statusColors[order.status];
  const initialNote = 'Order received and logged in kitchen system';
  const logs = order.statusHistory.toReversed();
  const cancellationReason =
    order.status === OrderStatus.CANCELLED
      ? order.statusHistory.toReversed().find((entry) => entry.status === OrderStatus.CANCELLED)
          ?.note
      : undefined;
  const totals = [
    [labels.subtotal, order.pricing.subtotal],
    [labels.deliveryFee, order.pricing.deliveryFee],
    [labels.tax, order.pricing.tax],
    [labels.total, order.pricing.total],
  ] as const;

  const centeredCell = (value: string, strong = false) =>
    h(
      Cell,
      { style: { padding: 7 } },
      h(
        View,
        { style: { height: 32, justifyContent: 'center' } },
        h(Text, { style: { textAlign: 'center', fontWeight: strong ? 700 : 400 } }, value),
      ),
    );
  const itemRows = h(
    Table,
    {
      columns: [
        { width: { fraction: 0.07 } },
        { width: { fraction: 0.39 } },
        { width: { fraction: 0.12 } },
        { width: { fraction: 0.19 } },
        { width: { fraction: 0.23 } },
      ],
    },
    h(
      Row,
      { header: true, style: { backgroundColor: '#e6f4f1' } },
      [labels.itemNumber, labels.item, labels.quantity, labels.unitPrice, labels.amount].map(
        (label) =>
          h(
            Cell,
            {
              key: label,
              style: { padding: 8, borderBottomWidth: 1, borderColor: '#b8dcd5' },
            },
            h(
              Text,
              { style: { color: '#175c55', fontSize: 8, fontWeight: 700, textAlign: 'center' } },
              label,
            ),
          ),
      ),
    ),
    ...order.items.map((item, index) => {
      const imageSource = images.get(item.itemId);
      return h(
        Row,
        {
          key: `${item.itemId}-${index}`,
          style: {
            backgroundColor: '#ffffff',
            borderBottomWidth: 0.5,
            borderColor: '#e2e8f0',
          },
        },
        centeredCell(String(index + 1)),
        h(
          Cell,
          { style: { padding: 7 } },
          h(
            View,
            { style: { flexDirection: 'row', alignItems: 'center', gap: 8 } },
            imageSource
              ? h(
                  View,
                  {
                    style: {
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      borderRadius: 7,
                      overflow: 'hidden',
                    },
                  },
                  h(Image, {
                    src: imageSource,
                    alt: copy.food[item.name] ?? item.name,
                    width: 32,
                    height: 32,
                  }),
                )
              : null,
            h(
              Text,
              { style: { flexGrow: 1, flexBasis: 0, textAlign: 'left' } },
              copy.food[item.name] ?? item.name,
            ),
          ),
        ),
        centeredCell(String(item.quantity)),
        centeredCell(currency(item.price, language)),
        centeredCell(currency(item.price * item.quantity, language), true),
      );
    }),
  );
  const itemTable = h(
    View,
    {
      style: {
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        overflow: 'hidden',
      },
    },
    itemRows,
  );

  const orderHistory =
    logs.length > 0
      ? h(
          View,
          { style: { marginBottom: 18 } },
          h(
            H2,
            { style: { marginTop: 0, marginBottom: 5, fontSize: 19, textAlign: 'center' } },
            labels.statusHistory,
          ),
          h(
            Text,
            { style: { marginBottom: 18, fontSize: 9, color: '#64748b', textAlign: 'center' } },
            `${labels.orderNumber}: ${order.orderNumber}`,
          ),
          ...logs.map((entry) =>
            h(
              View,
              {
                key: entry.id ?? `${entry.status}-${entry.timestamp}`,
                wrap: false,
                style: {
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 8,
                  backgroundColor: '#f8fafc',
                  marginBottom: 10,
                  padding: 12,
                },
              },
              h(
                Text,
                { style: { fontWeight: 700 } },
                `${status(entry.status)} · ${formatTimestamp(entry.timestamp, language, timeZone)}`,
              ),
              entry.note
                ? h(
                    Text,
                    { style: { marginTop: 2, color: '#475569' } },
                    entry.note === initialNote ? labels.orderReceived : entry.note,
                  )
                : null,
              entry.changedBy.name
                ? h(
                    Text,
                    { style: { marginTop: 2, color: '#64748b', fontSize: 8 } },
                    labels.updatedBy.replace('{{name}}', entry.changedBy.name),
                  )
                : null,
            ),
          ),
        )
      : null;
  const pageFooter = h(
    Fixed,
    { position: 'footer' },
    h(
      View,
      { style: { borderTopWidth: 0.5, borderColor: '#cbd5e1', paddingTop: 6 } },
      h(
        Text,
        { style: { color: '#64748b', fontSize: 8, textAlign: 'right' } },
        `${labels.page} {{pageNumber}} / {{totalPages}}`,
      ),
    ),
  );

  return h(
    Document,
    {
      title: `${labels.title} - ${order.orderNumber}`,
      author: labels.brand,
      creator: labels.brand,
      lang: language,
      tagged: true,
      fonts,
      style: {
        fontFamily: 'Noto Sans JP, Noto Sans JP Latin',
        color: '#172033',
        fontSize: 10,
      },
    },
    h(
      Page,
      { size: 'A4', margin: 40 },
      pageFooter,
      h(
        View,
        {
          style: {
            borderWidth: 1,
            borderColor: '#cbd5e1',
            borderRadius: 12,
            backgroundColor: '#ffffff',
            padding: 18,
          },
        },
        h(
          View,
          {
            style: {
              borderBottomWidth: 1,
              borderColor: '#cbd5e1',
              paddingBottom: 16,
            },
          },
          h(
            Text,
            { style: { color: '#0f172a', fontSize: 20, fontWeight: 700, textAlign: 'center' } },
            labels.brand,
          ),
          h(
            Text,
            { style: { marginTop: 5, color: '#64748b', fontSize: 9, textAlign: 'center' } },
            labels.tagline,
          ),
        ),
        h(
          H1,
          {
            style: {
              marginTop: 16,
              marginBottom: 20,
              color: '#0f172a',
              fontSize: 21,
              textAlign: 'center',
            },
          },
          labels.title,
        ),
        h(
          View,
          {
            style: {
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 18,
            },
          },
          h(
            View,
            { style: { flexGrow: 1 } },
            h(
              Text,
              { style: { color: '#64748b', fontSize: 8, fontWeight: 700 } },
              labels.orderNumber,
            ),
            h(Text, { style: { marginTop: 2, fontSize: 12, fontWeight: 700 } }, order.orderNumber),
          ),
          h(
            View,
            { style: { flexGrow: 1 } },
            h(Text, { style: { color: '#64748b', fontSize: 8, fontWeight: 700 } }, labels.placed),
            h(
              Text,
              { style: { marginTop: 2, fontSize: 9 } },
              formatTimestamp(order.createdAt, language, timeZone),
            ),
          ),
        ),
        h(
          View,
          {
            wrap: false,
            style: {
              flexDirection: 'row',
              alignItems: 'stretch',
              gap: 14,
              marginBottom: 18,
            },
          },
          h(
            View,
            {
              style: {
                flexGrow: 1,
                flexBasis: 0,
                padding: 12,
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 10,
              },
            },
            h(H2, { style: { marginTop: 0, marginBottom: 8, fontSize: 13 } }, labels.customer),
            h(Text, { style: { fontWeight: 700 } }, order.customer.name),
            h(
              Text,
              { style: { marginTop: 4, fontSize: 9 } },
              `${labels.deliveryAddress}: ${order.customer.address}`,
            ),
            h(
              Text,
              { style: { marginTop: 3, fontSize: 9 } },
              `${labels.phone}: ${order.customer.phone}`,
            ),
          ),
          h(
            View,
            {
              style: {
                flexGrow: 1,
                flexBasis: 0,
                padding: 12,
                backgroundColor: statusColor.background,
                borderWidth: 1,
                borderColor: statusColor.border,
                borderRadius: 10,
                color: statusColor.text,
              },
            },
            h(H2, { style: { marginTop: 0, marginBottom: 8, fontSize: 13 } }, labels.currentStatus),
            h(Text, { style: { fontSize: 10 } }, status(order.status)),
            cancellationReason
              ? h(
                  Text,
                  { style: { marginTop: 8, fontSize: 9 } },
                  `${labels.cancellationReason}: ${cancellationReason}`,
                )
              : null,
          ),
        ),
        h(H2, { style: { marginTop: 0, marginBottom: 8, fontSize: 13 } }, labels.items),
        itemTable,
        h(
          View,
          {
            wrap: false,
            style: {
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginBottom: 4,
            },
          },
          h(
            View,
            {
              style: {
                width: 225,
                flexShrink: 0,
                gap: 8,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 10,
                backgroundColor: '#f8fafc',
                padding: 12,
              },
            },
            ...totals.map(([label, amount], index) =>
              h(
                View,
                {
                  key: label,
                  style: {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    borderTopWidth: index === 3 ? 1 : 0,
                    borderColor: '#cbd5e1',
                    paddingTop: index === 3 ? 8 : 0,
                  },
                },
                h(
                  Text,
                  { style: { color: '#475569', fontWeight: index === 3 ? 700 : 400 } },
                  label,
                ),
                h(
                  Text,
                  {
                    style: {
                      color: index === 3 ? '#206e73' : '#172033',
                      fontSize: index === 3 ? 12 : 10,
                      fontWeight: index === 3 ? 700 : 500,
                      textAlign: 'right',
                    },
                  },
                  currency(amount, language),
                ),
              ),
            ),
          ),
        ),
      ),
      orderHistory ? h(PageBreak) : null,
      orderHistory
        ? h(
            View,
            {
              style: {
                padding: 18,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 12,
                backgroundColor: '#ffffff',
              },
            },
            orderHistory,
          )
        : null,
    ),
  );
}

export async function renderOrderReceipt(
  order: OrderDetails,
  language: Language,
  timeZone: string,
): Promise<Uint8Array> {
  const [copy, fonts, images] = await Promise.all([
    getCopy(language),
    getFonts(),
    getItemImages(order),
  ]);
  const document: ReactElement = ReceiptDocument({
    order,
    language,
    timeZone,
    copy,
    fonts,
    images,
  });
  return renderDocument(document);
}
