import { describe, it, expect } from 'vitest';
import { OrderStatus, isValidStatusTransition } from './enums.js';
import { CreateOrderSchema } from './schemas/order.schema.js';

describe('OrderStatus State Machine', () => {
  it('allows valid sequential status progression', () => {
    expect(isValidStatusTransition(OrderStatus.PLACED, OrderStatus.CONFIRMED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP)).toBe(true);
    expect(
      isValidStatusTransition(OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY),
    ).toBe(true);
    expect(isValidStatusTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).toBe(true);
  });

  it('rejects skipping status steps', () => {
    expect(isValidStatusTransition(OrderStatus.PLACED, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.CONFIRMED, OrderStatus.DELIVERED)).toBe(false);
  });

  it('rejects backwards transitions', () => {
    expect(isValidStatusTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.PREPARING)).toBe(
      false,
    );
    expect(isValidStatusTransition(OrderStatus.DELIVERED, OrderStatus.PLACED)).toBe(false);
  });

  it('allows cancellation of every active stage and keeps terminal states final', () => {
    expect(isValidStatusTransition(OrderStatus.PLACED, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.PREPARING, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
  });
});

describe('CreateOrderSchema validation', () => {
  it('validates a correct order creation payload', () => {
    const validData = {
      customer: {
        name: 'John Doe',
        phone: '1234567890',
        address: '123 Main St, New York',
      },
      items: [
        {
          itemId: 'item-1',
          name: 'Classic Cheeseburger',
          price: 12.99,
          quantity: 2,
        },
      ],
      deliveryAddress: '123 Main St, New York',
    };

    const parsed = CreateOrderSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it('rejects empty items array', () => {
    const invalidData = {
      customer: {
        name: 'John Doe',
        phone: '1234567890',
        address: '123 Main St',
      },
      items: [],
      deliveryAddress: '123 Main St',
    };

    const parsed = CreateOrderSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });
});
