import { renderDocument } from '@formepdf/core';
import {
  Cell,
  Document,
  Fixed,
  H1,
  H2,
  Page,
  Row,
  Table,
  Text,
  View,
  type FontRegistration,
} from '@formepdf/react';
import { createElement, type ReactElement } from 'react';
import { OrderStatus, type Language, type OrderDetails } from '@kitchentodoor/shared';
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
    paymentNotice: z.string(),
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

function ReceiptDocument({
  order,
  language,
  timeZone,
  copy,
  fonts,
}: {
  order: OrderDetails;
  language: Language;
  timeZone: string;
  copy: ReceiptCopy;
  fonts: FontRegistration[];
}): ReactElement {
  const h = createElement;
  const labels = copy.receipt;
  const status = (value: OrderStatus) => labels[statusLabels[value]];
  const initialNote = 'Order received and logged in kitchen system';
  const logs = [...order.statusHistory].reverse();
  const cancellationReason =
    order.status === OrderStatus.CANCELLED
      ? [...order.statusHistory].reverse().find((entry) => entry.status === OrderStatus.CANCELLED)
          ?.note
      : undefined;
  const totals = [
    [labels.subtotal, order.pricing.subtotal],
    [labels.deliveryFee, order.pricing.deliveryFee],
    [labels.tax, order.pricing.tax],
    [labels.total, order.pricing.total],
  ] as const;

  const itemTable = h(
    Table,
    {
      columns: [
        { width: { fraction: 0.46 } },
        { width: { fraction: 0.12 } },
        { width: { fraction: 0.2 } },
        { width: { fraction: 0.22 } },
      ],
      style: { marginBottom: 14 },
    },
    h(
      Row,
      { header: true, style: { backgroundColor: '#e2e8f0' } },
      [labels.item, labels.quantity, labels.unitPrice, labels.amount].map((label) =>
        h(
          Cell,
          { key: label, style: { padding: 7 } },
          h(Text, { style: { fontSize: 8, fontWeight: 700 } }, label),
        ),
      ),
    ),
    ...order.items.map((item, index) =>
      h(
        Row,
        {
          key: `${item.itemId}-${index}`,
          style: { borderBottomWidth: 0.5, borderColor: '#e2e8f0' },
        },
        h(Cell, { style: { padding: 7 } }, h(Text, null, copy.food[item.name] ?? item.name)),
        h(Cell, { style: { padding: 7 } }, h(Text, null, String(item.quantity))),
        h(Cell, { style: { padding: 7 } }, h(Text, null, currency(item.price, language))),
        h(
          Cell,
          { style: { padding: 7 } },
          h(Text, null, currency(item.price * item.quantity, language)),
        ),
      ),
    ),
  );

  const orderHistory =
    logs.length > 0
      ? h(
          View,
          { style: { marginBottom: 18 } },
          h(H2, { style: { marginTop: 0, marginBottom: 8, fontSize: 13 } }, labels.statusHistory),
          ...logs.map((entry) =>
            h(
              View,
              {
                key: entry.id ?? `${entry.status}-${entry.timestamp}`,
                style: {
                  borderLeftWidth: 2,
                  borderColor: '#99f6e4',
                  marginBottom: 7,
                  paddingLeft: 8,
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
      h(
        View,
        {
          style: {
            marginBottom: 22,
            borderBottomWidth: 2,
            borderColor: '#0f766e',
            paddingBottom: 14,
          },
        },
        h(Text, { style: { color: '#0f766e', fontSize: 13, fontWeight: 700 } }, labels.brand),
        h(Text, { style: { marginTop: 3, color: '#475569', fontSize: 9 } }, labels.tagline),
        h(
          H1,
          { style: { marginTop: 14, marginBottom: 0, color: '#0f172a', fontSize: 22 } },
          labels.title,
        ),
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
      h(H2, { style: { marginTop: 0, marginBottom: 8, fontSize: 13 } }, labels.customer),
      h(
        View,
        { style: { marginBottom: 18, padding: 10, backgroundColor: '#f8fafc' } },
        h(Text, { style: { fontWeight: 700 } }, order.customer.name),
        h(
          Text,
          { style: { marginTop: 4 } },
          `${labels.deliveryAddress}: ${order.customer.address}`,
        ),
        h(Text, { style: { marginTop: 3 } }, `${labels.phone}: ${order.customer.phone}`),
      ),
      h(H2, { style: { marginTop: 0, marginBottom: 8, fontSize: 13 } }, labels.items),
      itemTable,
      h(
        View,
        { style: { alignSelf: 'flex-end', width: 250, marginBottom: 20, gap: 5 } },
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
                paddingTop: index === 3 ? 6 : 0,
              },
            },
            h(Text, { style: { fontWeight: index === 3 ? 700 : 400 } }, label),
            h(Text, { style: { fontWeight: index === 3 ? 700 : 400 } }, currency(amount, language)),
          ),
        ),
      ),
      h(
        View,
        { style: { marginBottom: 16, padding: 10, backgroundColor: '#f8fafc' } },
        h(
          Text,
          { style: { fontSize: 9, fontWeight: 700 } },
          `${labels.currentStatus}: ${status(order.status)}`,
        ),
        cancellationReason
          ? h(
              Text,
              { style: { marginTop: 5, color: '#9f1239' } },
              `${labels.cancellationReason}: ${cancellationReason}`,
            )
          : null,
      ),
      orderHistory,
      h(
        Fixed,
        { position: 'footer' },
        h(
          View,
          { style: { borderTopWidth: 0.5, borderColor: '#cbd5e1', paddingTop: 6 } },
          h(Text, { style: { color: '#475569', fontSize: 8 } }, labels.paymentNotice),
          h(
            Text,
            { style: { marginTop: 3, color: '#64748b', fontSize: 8, textAlign: 'right' } },
            `${labels.page} {{pageNumber}} / {{totalPages}}`,
          ),
        ),
      ),
    ),
  );
}

export async function renderOrderReceipt(
  order: OrderDetails,
  language: Language,
  timeZone: string,
): Promise<Uint8Array> {
  const [copy, fonts] = await Promise.all([getCopy(language), getFonts()]);
  const document: ReactElement = ReceiptDocument({ order, language, timeZone, copy, fonts });
  return renderDocument(document);
}
