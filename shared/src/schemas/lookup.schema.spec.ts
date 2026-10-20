import { describe, expect, it } from 'vitest';
import { OrderIdentifierSchema, PhoneSchema } from './lookup.schema.js';
import { CustomerInfoSchema } from './order.schema.js';

describe('Order and phone lookup input', () => {
  it.each([
    ['KTD-1234', 'KTD-1234'],
    ['  ktd-1234  ', 'KTD-1234'],
    ['64F1A2B3C4D5E6F7A8B9C0D1', '64f1a2b3c4d5e6f7a8b9c0d1'],
  ])('normalizes valid identifier %s', (input, expected) => {
    expect(OrderIdentifierSchema.parse(input)).toBe(expected);
  });

  it.each(['', 'KTD-ABC', 'https://example.com', '64f1a2b3c4d5e6f7a8b9c0d', 'not-an-order'])(
    'rejects invalid identifier %s',
    (input) => {
      expect(OrderIdentifierSchema.safeParse(input).success).toBe(false);
    },
  );

  it.each(['555-1234', '+1 (555) 019-2834', '12345678910'])('accepts phone %s', (input) => {
    expect(PhoneSchema.safeParse(input).success).toBe(true);
  });

  it.each(['', 'abcdefg', '123', '1234567890123456'])('rejects invalid phone %s', (input) => {
    expect(PhoneSchema.safeParse(input).success).toBe(false);
  });

  it('trims customer details before creating an order', () => {
    expect(
      CustomerInfoSchema.parse({
        name: '  Alex  ',
        phone: ' 555-1234 ',
        address: '  123 Main Street  ',
      }),
    ).toEqual({ name: 'Alex', phone: '555-1234', address: '123 Main Street' });
  });

  it('rejects customer names and addresses made only of spaces', () => {
    const result = CustomerInfoSchema.safeParse({
      name: '  ',
      phone: '555-1234',
      address: '     ',
    });
    expect(result).toMatchObject({
      success: false,
      error: {
        issues: [
          expect.objectContaining({ path: ['name'] }),
          expect.objectContaining({ path: ['address'] }),
        ],
      },
    });
  });
});
