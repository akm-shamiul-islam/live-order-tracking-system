import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  RegisterSchema,
  DeliveryAddressSchema,
  UpdateOrderStatusSchema,
  CourierLocationUpdateSchema,
  OrderStatus,
  UserRole,
} from './index.js';

describe('Shared Zod Schemas Validation Tests', () => {
  describe('LoginSchema', () => {
    it('accepts valid email and password', () => {
      const res = LoginSchema.safeParse({
        email: 'user@example.com',
        password: 'securePassword123',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid email formats', () => {
      const res = LoginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });
      expect(res.success).toBe(false);
    });

    it('rejects passwords shorter than 6 characters', () => {
      const res = LoginSchema.safeParse({
        email: 'user@example.com',
        password: '123',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('RegisterSchema', () => {
    const customer = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'strongPassword!123',
      phone: '555-123-4567',
    };

    it('allows registration without an address or with a blank address', () => {
      expect(RegisterSchema.parse(customer).address).toBeUndefined();
      expect(RegisterSchema.parse({ ...customer, address: '   ' }).address).toBe('');
    });

    it('trims a saved address while retaining apartment and city lines', () => {
      const address = '45 Registration Avenue, Apt 2\nTest City 10001';
      expect(RegisterSchema.parse({ ...customer, address: `  ${address}\n ` }).address).toBe(
        address,
      );
    });

    it.each(['1234', 'a'.repeat(501), '😀'.repeat(251), 12345, null])(
      'rejects an invalid supplied registration address: %j',
      (address) => {
        const result = RegisterSchema.safeParse({ ...customer, address });
        expect(result).toMatchObject({
          success: false,
          error: { issues: [expect.objectContaining({ path: ['address'] })] },
        });
      },
    );

    it('requires a delivery address at checkout with the same length limits', () => {
      expect(DeliveryAddressSchema.safeParse('').success).toBe(false);
      expect(DeliveryAddressSchema.safeParse('1234').success).toBe(false);
      expect(DeliveryAddressSchema.safeParse('a'.repeat(501)).success).toBe(false);
      expect(DeliveryAddressSchema.parse('  123 Test Street  ')).toBe('123 Test Street');
      for (const address of [
        '1234',
        '😀'.repeat(4),
        '😀'.repeat(5),
        'a'.repeat(500),
        'a'.repeat(501),
      ])
        expect(RegisterSchema.safeParse({ ...customer, address }).success).toBe(
          DeliveryAddressSchema.safeParse(address).success,
        );
    });

    it('accepts valid customer registration', () => {
      const res = RegisterSchema.safeParse({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'strongPassword!123',
        role: UserRole.CUSTOMER,
        phone: '555-123-4567',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid role', () => {
      const res = RegisterSchema.safeParse({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'strongPassword!123',
        role: 'SUPERUSER',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('UpdateOrderStatusSchema', () => {
    it('accepts valid status and orderId', () => {
      const res = UpdateOrderStatusSchema.safeParse({
        orderId: '64f1a2b3c4d5e6f7a8b9c0d1',
        status: OrderStatus.PREPARING,
        note: 'Starting the grill',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid order status value', () => {
      const res = UpdateOrderStatusSchema.safeParse({
        orderId: '64f1a2b3c4d5e6f7a8b9c0d1',
        status: 'FLYING',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('CourierLocationUpdateSchema', () => {
    it('validates GPS latitude and longitude within world boundaries', () => {
      const res = CourierLocationUpdateSchema.safeParse({
        orderId: 'KTD-1234',
        lat: 40.7128,
        lng: -74.006,
        heading: 180,
        speed: 25.5,
        timestamp: new Date().toISOString(),
      });
      expect(res.success).toBe(true);
    });

    it('rejects latitude out of bounds (> 90 or < -90)', () => {
      const res = CourierLocationUpdateSchema.safeParse({
        orderId: 'KTD-1234',
        lat: 95.5,
        lng: -74.006,
        timestamp: new Date().toISOString(),
      });
      expect(res.success).toBe(false);
    });

    it('rejects longitude out of bounds (> 180 or < -180)', () => {
      const res = CourierLocationUpdateSchema.safeParse({
        orderId: 'KTD-1234',
        lat: 40.7128,
        lng: 195.0,
        timestamp: new Date().toISOString(),
      });
      expect(res.success).toBe(false);
    });
  });
});
