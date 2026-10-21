import React from 'react';
import type { OrderDetails } from '@kitchentodoor/shared';

/**
 * PDFCN Order Receipt Template
 * Follows the shadcn-style component model from https://www.pdfcn.dev/
 * Provides a clean, print-optimized A4 order receipt layout with tabular numbers,
 * brand header, customer info, itemized table, and financial totals.
 */

export interface OrderReceiptPdfProps {
  order: OrderDetails;
  companyName?: string;
  supportEmail?: string;
}

export function OrderReceiptDocument({
  order,
  companyName = 'KitchenToDoor',
  supportEmail = 'support@kitchentodoor.io',
}: OrderReceiptPdfProps) {
  const formattedDate = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(order.createdAt));

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '36px',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontSize: '12px',
        lineHeight: '1.5',
      }}
    >
      {/* Brand Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #0d9488',
          paddingBottom: '20px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '800',
              color: '#0f766e',
              margin: '0 0 4px 0',
              fontFamily: "'Outfit', system-ui, sans-serif",
            }}
          >
            {companyName}
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '11px' }}>
            Fresh from the Kitchen, Tracked to Your Door.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 10px',
              backgroundColor: '#f0fdfa',
              color: '#0f766e',
              borderRadius: '6px',
              fontWeight: '700',
              fontFamily: 'monospace',
              fontSize: '13px',
              border: '1px solid #ccfbf1',
            }}
          >
            {order.orderNumber}
          </span>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '11px' }}>{formattedDate}</p>
        </div>
      </header>

      {/* Customer & Delivery Summary */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          backgroundColor: '#f8fafc',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#64748b',
              margin: '0 0 6px 0',
              fontWeight: '700',
            }}
          >
            Customer Details
          </h3>
          <p style={{ margin: '0 0 2px 0', fontWeight: '600' }}>{order.customer.name}</p>
          <p style={{ margin: '0', color: '#475569' }}>Phone: {order.customer.phone}</p>
        </div>
        <div>
          <h3
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#64748b',
              margin: '0 0 6px 0',
              fontWeight: '700',
            }}
          >
            Delivery Address
          </h3>
          <p style={{ margin: 0, color: '#334155' }}>{order.customer.address}</p>
        </div>
      </section>

      {/* Itemized Bill Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '24px',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
            <th
              style={{ padding: '8px 4px', color: '#64748b', fontWeight: '700', fontSize: '11px' }}
            >
              ITEM
            </th>
            <th
              style={{
                padding: '8px 4px',
                textAlign: 'center',
                color: '#64748b',
                fontWeight: '700',
                fontSize: '11px',
              }}
            >
              QTY
            </th>
            <th
              style={{
                padding: '8px 4px',
                textAlign: 'right',
                color: '#64748b',
                fontWeight: '700',
                fontSize: '11px',
              }}
            >
              UNIT PRICE
            </th>
            <th
              style={{
                padding: '8px 4px',
                textAlign: 'right',
                color: '#64748b',
                fontWeight: '700',
                fontSize: '11px',
              }}
            >
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 4px', fontWeight: '500' }}>{item.name}</td>
              <td style={{ padding: '10px 4px', textAlign: 'center', fontFamily: 'monospace' }}>
                {item.quantity}
              </td>
              <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                ${item.price.toFixed(2)}
              </td>
              <td
                style={{
                  padding: '10px 4px',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                }}
              >
                ${(item.price * item.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Financial Summary */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
        <div style={{ width: '260px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
              color: '#64748b',
            }}
          >
            <span>Subtotal</span>
            <span style={{ fontFamily: 'monospace' }}>${order.pricing.subtotal.toFixed(2)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
              color: '#64748b',
            }}
          >
            <span>Delivery Fee</span>
            <span style={{ fontFamily: 'monospace' }}>${order.pricing.deliveryFee.toFixed(2)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
              color: '#64748b',
            }}
          >
            <span>Tax</span>
            <span style={{ fontFamily: 'monospace' }}>${order.pricing.tax.toFixed(2)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderTop: '2px solid #0f172a',
              marginTop: '6px',
              fontWeight: '800',
              fontSize: '15px',
              color: '#0f766e',
            }}
          >
            <span>Total Paid</span>
            <span style={{ fontFamily: 'monospace' }}>${order.pricing.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          paddingTop: '16px',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '10px',
        }}
      >
        <p style={{ margin: '0 0 2px 0' }}>Thank you for ordering with KitchenToDoor!</p>
        <p style={{ margin: 0 }}>Questions regarding this receipt? Contact {supportEmail}</p>
      </footer>
    </div>
  );
}
