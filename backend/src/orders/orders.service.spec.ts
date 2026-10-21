import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrdersService } from './orders.service.js';
import { OrderStatus } from '@kitchentodoor/shared';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Types } from 'mongoose';

describe('OrdersService Unit Tests', () => {
  let service: OrdersService;
  let mockOrderModel: any;
  let mockStatusLogModel: any;

  beforeEach(() => {
    mockOrderModel = {
      findOne: vi.fn<any>(),
      findOneAndUpdate: vi.fn<any>(),
      exists: vi.fn<any>(),
      find: vi.fn<any>(),
      countDocuments: vi.fn<any>(),
      create: vi.fn<any>(),
      updateOne: vi.fn<any>(),
    };
    mockStatusLogModel = {
      create: vi.fn<any>(),
      find: vi.fn<any>(),
    };
    service = new OrdersService(mockOrderModel, mockStatusLogModel);
  });

  it('searches the database literally and paginates in a stable order', async () => {
    const query = {
      sort: vi.fn<(sort: Record<string, number>) => unknown>().mockReturnThis(),
      skip: vi.fn<(count: number) => unknown>().mockReturnThis(),
      limit: vi.fn<(count: number) => Promise<unknown[]>>().mockResolvedValue([]),
    };
    mockOrderModel.find.mockReturnValue(query);
    mockStatusLogModel.find.mockReturnValue({
      sort: vi.fn<(sort: Record<string, number>) => Promise<unknown[]>>().mockResolvedValue([]),
    });
    await service.getAllOrders('PLACED', 10, 3, 'A.*(B)');
    expect(mockOrderModel.find).toHaveBeenCalledWith({
      status: 'PLACED',
      $or: ['orderNumber', 'customer.name', 'customer.phone'].map((field) => ({
        [field]: { $regex: 'A\\.\\*\\(B\\)', $options: 'i' },
      })),
    });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it('uses the same filtered search for result counts', async () => {
    mockOrderModel.countDocuments.mockResolvedValue(51);
    expect(await service.countOrders('DELIVERED', 'KTD-12')).toBe(51);
    expect(mockOrderModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DELIVERED', $or: expect.any(Array) }),
    );
  });

  it('paginates history for the requested phone', async () => {
    const query = {
      sort: vi.fn<(sort: Record<string, number>) => unknown>().mockReturnThis(),
      skip: vi.fn<(count: number) => unknown>().mockReturnThis(),
      limit: vi.fn<(count: number) => Promise<unknown[]>>().mockResolvedValue([]),
    };
    mockOrderModel.find.mockReturnValue(query);
    mockStatusLogModel.find.mockReturnValue({
      sort: vi.fn<(sort: Record<string, number>) => Promise<unknown[]>>().mockResolvedValue([]),
    });
    await service.getMyOrders('555-1234', 25, 2);
    expect(mockOrderModel.find).toHaveBeenCalledWith({ 'customer.phone': '555-1234' });
    expect(query.skip).toHaveBeenCalledWith(25);
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it('generates an order number starting with KTD-', () => {
    const orderNumber = service.generateOrderNumber();
    expect(orderNumber).toMatch(/^KTD-[A-F\d]{12}$/);
  });

  it('calculates totals correctly when creating an order', async () => {
    const createDto = {
      customer: {
        name: 'Alice Smith',
        phone: '555-1234',
        address: '456 Elm St',
      },
      items: [
        { itemId: 'item-1', name: 'Forged name', price: 0.01, quantity: 2 },
        { itemId: 'item-3', name: 'Fries', price: 5, quantity: 1 },
      ],
      deliveryAddress: '456 Elm St',
    };

    mockOrderModel.findOne.mockResolvedValue(null);
    mockOrderModel.create.mockImplementation((doc: any) =>
      Promise.resolve({
        _id: { toString: () => 'order123' },
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    mockStatusLogModel.create.mockImplementation((doc: any) =>
      Promise.resolve({
        _id: { toString: () => 'log123' },
        ...doc,
        timestamp: new Date(),
      }),
    );

    const result = await service.createOrder(createDto);

    // Prices and names come from the server catalog even if the request tampers with them.
    expect(result.items[0]).toMatchObject({ name: 'Truffle Smoke Burger', price: 15.99 });
    expect(result.pricing.subtotal).toBe(38.48);
    expect(result.pricing.deliveryFee).toBe(5);
    expect(result.pricing.tax).toBe(3.08);
    expect(result.pricing.total).toBe(46.56);
    expect(result.status).toBe('PLACED');
    expect(result.statusHistory).toHaveLength(1);
    expect(mockOrderModel.create.mock.calls[0][0].auditTrail).toHaveLength(1);
    expect(mockStatusLogModel.create).not.toHaveBeenCalled();
  });

  it('updateOrderStatus advances status and creates audit log', async () => {
    const mockOrder: any = {
      _id: { toString: () => '64f1a2b3c4d5e6f7a8b9c0d1' },
      orderNumber: 'KTD-1001',
      status: OrderStatus.PLACED,
      save: vi.fn<any>().mockResolvedValue(true),
      customer: { name: 'Bob', phone: '555-0000', address: '123 St' },
      items: [],
      pricing: { subtotal: 20, deliveryFee: 5, tax: 2, total: 27 },
      deliveryCoordinates: { lat: 40.71, lng: -74.0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockOrderModel.findOne.mockResolvedValue(mockOrder);
    mockOrderModel.findOneAndUpdate.mockResolvedValue({
      ...mockOrder,
      status: OrderStatus.CONFIRMED,
    });
    mockStatusLogModel.create.mockResolvedValue({
      _id: { toString: () => 'log_1' },
      orderId: '64f1a2b3c4d5e6f7a8b9c0d1',
      orderNumber: 'KTD-1001',
      status: OrderStatus.CONFIRMED,
      note: 'Confirmed by kitchen',
      changedBy: { role: 'ADMIN', name: 'Dispatcher' },
      timestamp: new Date(),
    });
    mockStatusLogModel.find.mockReturnValue({
      sort: vi.fn<any>().mockResolvedValue([]),
    });

    const result = await service.updateOrderStatus('KTD-1001', OrderStatus.CONFIRMED);
    expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockOrder._id, status: OrderStatus.PLACED },
      {
        $set: { status: OrderStatus.CONFIRMED },
        $push: {
          auditTrail: expect.objectContaining({
            orderId: '64f1a2b3c4d5e6f7a8b9c0d1',
            status: OrderStatus.CONFIRMED,
            timestamp: expect.any(Date),
          }),
        },
      },
      { returnDocument: 'after' },
    );
    expect(result.order.status).toBe(OrderStatus.CONFIRMED);
    expect(result.logEntry.status).toBe(OrderStatus.CONFIRMED);
    expect(mockStatusLogModel.create).not.toHaveBeenCalled();
  });

  it('bounds duplicate order-number retries and returns a recoverable error', async () => {
    vi.stubEnv('ORDER_NUMBER_RETRY_ATTEMPTS', '2');
    try {
      mockOrderModel.create.mockRejectedValue({ code: 11000, keyPattern: { orderNumber: 1 } });
      await expect(
        service.createOrder({
          customer: { name: 'Customer', phone: '555-1234', address: '123 Main St' },
          items: [{ itemId: 'item-1', name: 'Burger', price: 15.99, quantity: 1 }],
          deliveryAddress: '123 Main St',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(mockOrderModel.create).toHaveBeenCalledTimes(2);
      expect(mockStatusLogModel.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('updateOrderStatus rejects invalid status progression with BadRequestException', async () => {
    const mockOrder: any = {
      _id: { toString: () => '64f1a2b3c4d5e6f7a8b9c0d1' },
      orderNumber: 'KTD-1002',
      status: OrderStatus.PLACED,
    };
    mockOrderModel.findOne.mockResolvedValue(mockOrder);

    // Attempting to jump directly from PLACED to DELIVERED
    await expect(service.updateOrderStatus('KTD-1002', OrderStatus.DELIVERED)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('updateOrderStatus throws NotFoundException if order does not exist', async () => {
    mockOrderModel.findOne.mockResolvedValue(null);

    await expect(service.updateOrderStatus('NON-EXISTENT', OrderStatus.CONFIRMED)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('cancelOrder cancels order in PLACED state', async () => {
    const mockOrder: any = {
      _id: { toString: () => '64f1a2b3c4d5e6f7a8b9c0d1' },
      orderNumber: 'KTD-1003',
      status: OrderStatus.PLACED,
      save: vi.fn<any>().mockResolvedValue(true),
      customer: { name: 'Charlie', phone: '555-1111', address: '456 St' },
      items: [],
      pricing: { subtotal: 10, deliveryFee: 5, tax: 1, total: 16 },
      deliveryCoordinates: { lat: 40.71, lng: -74.0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockOrderModel.findOne.mockResolvedValue(mockOrder);
    mockOrderModel.findOneAndUpdate.mockResolvedValue({
      ...mockOrder,
      status: OrderStatus.CANCELLED,
    });
    mockStatusLogModel.create.mockResolvedValue({
      _id: { toString: () => 'log_c' },
      orderId: '64f1a2b3c4d5e6f7a8b9c0d1',
      orderNumber: 'KTD-1003',
      status: OrderStatus.CANCELLED,
      note: 'User changed mind',
      changedBy: { role: 'CUSTOMER', name: 'Customer' },
      timestamp: new Date(),
    });
    mockStatusLogModel.find.mockReturnValue({
      sort: vi.fn<any>().mockResolvedValue([]),
    });

    const result = await service.cancelOrder('KTD-1003', 'User changed mind');
    expect(result.order.status).toBe(OrderStatus.CANCELLED);
  });

  it('cancelOrder rejects cancellation after delivery is complete', async () => {
    const mockOrder: any = {
      _id: { toString: () => '64f1a2b3c4d5e6f7a8b9c0d1' },
      orderNumber: 'KTD-1004',
      status: OrderStatus.DELIVERED,
    };
    mockOrderModel.findOne.mockResolvedValue(mockOrder);

    await expect(service.cancelOrder('KTD-1004', 'Too late to cancel')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('updateCourierCoordinates updates courier lat and lng', async () => {
    mockOrderModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    await service.updateCourierCoordinates('KTD-1005', 40.72, -74.01);
    expect(mockOrderModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          'courierCoordinates.lat': 40.72,
          'courierCoordinates.lng': -74.01,
        }),
      }),
    );
  });

  it('preserves audit history when MongoDB stores order references as ObjectIds', async () => {
    const id = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const order = {
      _id: id,
      orderNumber: 'KTD-1006',
      status: OrderStatus.PLACED,
      customer: { name: 'Customer', phone: '555-1234', address: '123 Main St' },
      items: [],
      pricing: { subtotal: 10, deliveryFee: 5, tax: 0.8, total: 15.8 },
      deliveryCoordinates: { lat: 40, lng: -74 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockOrderModel.find.mockReturnValue({ sort: () => ({ limit: async () => [order] }) });
    mockStatusLogModel.find.mockReturnValue({
      sort: async () => [
        {
          _id: new Types.ObjectId(),
          orderId: new Types.ObjectId(id.toString()),
          orderNumber: 'KTD-1006',
          status: OrderStatus.PLACED,
          note: 'Received',
          timestamp: new Date(),
          changedBy: { userId, role: 'CUSTOMER', name: 'Customer' },
        },
      ],
    });
    for (const result of [await service.getAllOrders(), await service.getMyOrders('555-1234')]) {
      expect(result[0]?.statusHistory).toHaveLength(1);
      expect(result[0]?.statusHistory[0]).toMatchObject({
        orderId: id.toString(),
        changedBy: { userId: userId.toString() },
      });
    }
  });

  it('rejects menu items that do not exist', async () => {
    await expect(
      service.createOrder({
        customer: { name: 'Customer', phone: '555-1234', address: '123 Main St' },
        deliveryAddress: '123 Main St',
        items: [{ itemId: 'missing-item', name: 'Forged item', price: 1, quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockOrderModel.create).not.toHaveBeenCalled();
  });

  it('reports missing telemetry orders instead of acknowledging an update', async () => {
    mockOrderModel.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    await expect(service.updateCourierCoordinates('missing-order', 40, -74)).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each(['advance', 'cancel'])(
    'rejects a stale %s without creating a misleading audit entry',
    async (action) => {
      mockOrderModel.findOne.mockResolvedValue({ _id: 'order-id', status: OrderStatus.PLACED });
      // Another dispatcher changes the status after the initial read.
      mockOrderModel.findOneAndUpdate.mockResolvedValue(null);
      const request =
        action === 'advance'
          ? service.updateOrderStatus('KTD-1000', OrderStatus.CONFIRMED)
          : service.cancelOrder('KTD-1000', 'Customer requested cancellation');
      await expect(request).rejects.toThrow(ConflictException);
      expect(mockStatusLogModel.create).not.toHaveBeenCalled();
    },
  );

  it('rejects telemetry for a completed order', async () => {
    mockOrderModel.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    mockOrderModel.exists.mockResolvedValue({ _id: 'order-id' });
    await expect(service.updateCourierCoordinates('KTD-1000', 40, -74)).rejects.toThrow(
      ConflictException,
    );
    expect(mockOrderModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } }),
      expect.anything(),
    );
  });
});
