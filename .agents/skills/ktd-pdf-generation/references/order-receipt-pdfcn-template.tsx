// Minimal Forme primitive example. The production renderer also places a badge-colored Current Status card beside Customer and starts Order History with PageBreak; see SKILL.md.
import { renderDocument } from '@formepdf/core';
import {
  Cell,
  Document,
  Fixed,
  H1,
  Image,
  Page,
  Row,
  Table,
  Text,
  View,
  type FontRegistration,
} from '@formepdf/react';
import { createElement as h, type ReactElement } from 'react';
import type { Language, OrderDetails } from '@kitchentodoor/shared';

type ReceiptLabels = {
  brand: string;
  tagline: string;
  title: string;
  orderNumber: string;
  customer: string;
  deliveryAddress: string;
  phone: string;
  number: string;
  item: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  subtotal: string;
  deliveryFee: string;
  tax: string;
  total: string;
  page: string;
};

type ReceiptProps = {
  order: OrderDetails;
  language: Language;
  labels: ReceiptLabels;
  fonts: FontRegistration[];
  /** Resolve an item ID through MENU_ITEMS to a preloaded data:image/jpeg;base64 URI. */
  menuImageSource: (itemId: string) => string | undefined;
};

export function OrderReceiptDocument({
  order,
  language,
  labels,
  fonts,
  menuImageSource,
}: ReceiptProps): ReactElement {
  const currency = (amount: number) =>
    new Intl.NumberFormat(language === 'ja' ? 'ja-JP' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  const rows = order.items.map((item, index) => {
    const trustedImage = menuImageSource(item.itemId);
    return h(
      Row,
      { key: `${item.itemId}-${index}`, style: { backgroundColor: '#ffffff' } },
      h(Cell, null, h(Text, { style: { textAlign: 'center' } }, String(index + 1))),
      h(
        Cell,
        null,
        h(
          View,
          { style: { flexDirection: 'row', alignItems: 'center', gap: 8 } },
          trustedImage
            ? h(
                View,
                { style: { width: 30, height: 30, borderRadius: 7, overflow: 'hidden' } },
                h(Image, { src: trustedImage, width: 30, height: 30 }),
              )
            : null,
          h(Text, null, item.name),
        ),
      ),
      h(Cell, null, h(Text, { style: { textAlign: 'center' } }, String(item.quantity))),
      h(Cell, null, h(Text, { style: { textAlign: 'center' } }, currency(item.price))),
      h(
        Cell,
        null,
        h(Text, { style: { textAlign: 'center' } }, currency(item.price * item.quantity)),
      ),
    );
  });

  const totals = [
    [labels.subtotal, order.pricing.subtotal],
    [labels.deliveryFee, order.pricing.deliveryFee],
    [labels.tax, order.pricing.tax],
    [labels.total, order.pricing.total],
  ] as const;

  return h(
    Document,
    {
      title: `${labels.title} - ${order.orderNumber}`,
      lang: language,
      tagged: true,
      fonts,
      style: { fontFamily: 'Noto Sans JP, Noto Sans JP Latin', fontSize: 10, color: '#172033' },
    },
    h(
      Page,
      { size: 'A4', margin: 40 },
      h(
        Fixed,
        { position: 'footer' },
        h(
          Text,
          { style: { textAlign: 'right' } },
          `${labels.page} {{pageNumber}} / {{totalPages}}`,
        ),
      ),
      h(
        View,
        {
          style: {
            borderWidth: 1,
            borderColor: '#dbe4e8',
            borderRadius: 12,
            padding: 18,
          },
        },
        h(
          View,
          { style: { borderBottomWidth: 1, borderColor: '#cbd5e1', paddingBottom: 14 } },
          h(Text, { style: { fontSize: 20, fontWeight: 700, textAlign: 'center' } }, labels.brand),
          h(
            Text,
            { style: { marginTop: 5, color: '#64748b', textAlign: 'center' } },
            labels.tagline,
          ),
        ),
        h(
          H1,
          { style: { color: '#0f172a', fontSize: 22, textAlign: 'center', marginTop: 16 } },
          labels.title,
        ),
        h(Text, { style: { marginBottom: 16 } }, `${labels.orderNumber}: ${order.orderNumber}`),
        h(Text, { style: { fontWeight: 700 } }, order.customer.name),
        h(Text, null, `${labels.phone}: ${order.customer.phone}`),
        h(
          Text,
          { style: { marginBottom: 16 } },
          `${labels.deliveryAddress}: ${order.customer.address}`,
        ),
        h(
          View,
          {
            style: {
              borderWidth: 1,
              borderColor: '#cbd5e1',
              borderRadius: 10,
              overflow: 'hidden',
              marginBottom: 16,
            },
          },
          h(
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
              ...[labels.number, labels.item, labels.quantity, labels.unitPrice, labels.amount].map(
                (label) =>
                  h(
                    Cell,
                    { key: label, style: { padding: 8 } },
                    h(Text, { style: { color: '#175c55', textAlign: 'center' } }, label),
                  ),
              ),
            ),
            ...rows,
          ),
        ),
        h(
          View,
          { style: { flexDirection: 'row', justifyContent: 'flex-end' } },
          h(
            View,
            {
              style: {
                width: 250,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 10,
                padding: 12,
                backgroundColor: '#f8fafc',
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
                    paddingTop: index === 3 ? 6 : 0,
                  },
                },
                h(Text, null, label),
                h(
                  Text,
                  { style: { textAlign: 'right', fontWeight: index === 3 ? 700 : 400 } },
                  currency(amount),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export async function renderReceipt(document: ReactElement): Promise<Uint8Array> {
  return renderDocument(document);
}
