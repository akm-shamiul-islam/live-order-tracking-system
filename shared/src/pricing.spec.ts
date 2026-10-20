import { describe, expect, it } from 'vitest';
import { calculatePricing } from './pricing.js';

describe('Configured delivery pricing', () => {
  it('uses configured delivery fee and tax rate with cent-based rounding', () => {
    expect(
      calculatePricing([{ price: 15.99, quantity: 2 }], { deliveryFee: 7.25, taxRate: 0.12 }),
    ).toEqual({ subtotal: 31.98, deliveryFee: 7.25, tax: 3.84, total: 43.07 });
  });
  it('supports zero fees and tax', () => {
    expect(calculatePricing([{ price: 10, quantity: 1 }], { deliveryFee: 0, taxRate: 0 })).toEqual({
      subtotal: 10,
      deliveryFee: 0,
      tax: 0,
      total: 10,
    });
  });
  it('does not charge an empty cart', () => {
    expect(calculatePricing([], { deliveryFee: 7.25, taxRate: 0.12 })).toEqual({
      subtotal: 0,
      deliveryFee: 0,
      tax: 0,
      total: 0,
    });
  });
});
