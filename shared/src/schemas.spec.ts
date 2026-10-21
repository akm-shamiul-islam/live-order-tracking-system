import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  RegisterSchema,
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
