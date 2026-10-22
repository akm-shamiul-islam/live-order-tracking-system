import { OrderStatus } from './enums.js';
import type { OrderDetails, OrderStatusLog } from './schemas/order.schema.js';
import type { CourierLocationUpdateDto } from './schemas/telemetry.schema.js';
import type { UserSummary } from './schemas/auth.schema.js';

export interface ServerToClientEvents {
  'orders:changed': (payload: Record<string, never>) => void;
  /** Emitted when an order's status is advanced */
  'order:status_updated': (payload: {
    orderId: string;
    orderNumber: string;
    status: OrderStatus;
    updatedAt: string;
    revision: number;
    courierId?: string | null;
    logEntry: OrderStatusLog;
  }) => void;

  /** Emitted when courier GPS telemetry changes */
  'courier:location_updated': (payload: {
    orderId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    timestamp: string;
  }) => void;

  /** Broadcast to admins/dispatch when a new order is placed */
  'order:created': (payload: { order: OrderDetails }) => void;

  /** Broadcast when an order is cancelled */
  'order:cancelled': (payload: {
    orderId: string;
    orderNumber: string;
    reason?: string;
    updatedAt: string;
    revision: number;
    logEntry: OrderStatusLog;
  }) => void;

  /** Server acknowledgment on successful authentication */
  authenticated: (payload: { user: UserSummary }) => void;

  /** Generic error message */
  error: (payload: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  ping: (callback: (ack: { ok: boolean }) => void) => void;
  /** Join a room specific to an order (customers, admins) */
  'order:join': (
    payload: { orderId: string },
    callback?: (ack: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Leave an order tracking room */
  'order:leave': (payload: { orderId: string }) => void;

  /** Dispatch or Admin advances the Order Status */
  'order:update_status': (
    payload: { orderId: string; status: OrderStatus; note?: string },
    callback?: (ack: { ok: boolean; error?: string; order?: OrderDetails }) => void,
  ) => void;

  /** Courier broadcasts live GPS coordinates */
  'courier:update_location': (
    payload: CourierLocationUpdateDto,
    callback: (ack: { ok: boolean; error?: string }) => void,
  ) => void;

  /** An administrator cancels an active order */
  'order:cancel': (
    payload: { orderId: string; reason?: string },
    callback?: (ack: { ok: boolean; error?: string }) => void,
  ) => void;
}
