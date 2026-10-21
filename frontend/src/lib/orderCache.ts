import { OrderStatus, type OrderDetails, type ServerToClientEvents } from '@kitchentodoor/shared';
import { replaceEqualDeep } from '@tanstack/react-query';

type StatusEvent = Parameters<ServerToClientEvents['order:status_updated']>[0];
type LocationEvent = Parameters<ServerToClientEvents['courier:location_updated']>[0];

const observedAt = (coordinates: OrderDetails['courierCoordinates']) =>
  coordinates?.lastUpdated ? Date.parse(coordinates.lastUpdated) : -Infinity;

export function mergeOrderSnapshot(
  previous: OrderDetails | undefined,
  incoming: OrderDetails,
): OrderDetails {
  if (!previous || previous.id !== incoming.id) return incoming;
  const latest = (previous.revision ?? 0) > (incoming.revision ?? 0) ? previous : incoming;
  const coordinates =
    observedAt(previous.courierCoordinates) > observedAt(incoming.courierCoordinates)
      ? previous.courierCoordinates
      : incoming.courierCoordinates;
  return replaceEqualDeep(
    previous,
    coordinates === latest.courierCoordinates
      ? latest
      : { ...latest, courierCoordinates: coordinates },
  );
}

export function applyOrderStatus(
  previous: OrderDetails | undefined,
  event: StatusEvent,
): OrderDetails | undefined {
  if (!previous || previous.id !== event.orderId || event.revision <= (previous.revision ?? 0))
    return previous;
  return {
    ...previous,
    revision: event.revision,
    ...(event.courierId !== undefined ? { courierId: event.courierId } : {}),
    status: event.status,
    updatedAt: event.updatedAt,
    statusHistory: [
      event.logEntry,
      ...previous.statusHistory.filter((entry) =>
        event.logEntry.id
          ? entry.id !== event.logEntry.id
          : entry.timestamp !== event.logEntry.timestamp,
      ),
    ].sort(
      (a, b) => b.timestamp.localeCompare(a.timestamp) || (b.id ?? '').localeCompare(a.id ?? ''),
    ),
  };
}

export function applyCourierLocation(
  previous: OrderDetails | undefined,
  event: LocationEvent,
): OrderDetails | undefined {
  if (
    !previous ||
    previous.id !== event.orderId ||
    [OrderStatus.CANCELLED, OrderStatus.DELIVERED].some((status) => status === previous.status) ||
    !Number.isFinite(Date.parse(event.timestamp)) ||
    Date.parse(event.timestamp) <= observedAt(previous.courierCoordinates)
  )
    return previous;
  return {
    ...previous,
    courierCoordinates: { lat: event.lat, lng: event.lng, lastUpdated: event.timestamp },
  };
}
