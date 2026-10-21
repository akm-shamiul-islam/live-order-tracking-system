import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredSocket } from './useDeferredSocket';
import { api } from '../lib/api';
import { OrderDetails, OrderStatus, type ServerToClientEvents } from '@kitchentodoor/shared';
import { useAuth } from './useAuth';
import { clientSettings } from '../lib/clientSettings';

export function useOrderSocket(orderId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = useMemo(
    () => ['order', orderId, user?.id, user?.role],
    [orderId, user?.id, user?.role],
  );

  const query = useQuery<OrderDetails>({
    queryKey,
    queryFn: () => {
      if (!orderId) throw new Error('Order ID is required');
      return api.orders.getById(orderId);
    },
    enabled: !!orderId && !!user,
    refetchInterval: clientSettings.VITE_ORDER_LIST_REFRESH_MS,
  });

  const resolvedOrderId = query.data?.id;
  const socket = useDeferredSocket(!!orderId && !!resolvedOrderId);

  useEffect(() => {
    if (!orderId || !resolvedOrderId || !socket) return undefined;

    // 1. Join Order Room
    const joinRoom = () => socket.emit('order:join', { orderId });

    // 2. Listen for Real-Time Status Updates & Mutate Cache Instantly
    const handleStatusUpdated: ServerToClientEvents['order:status_updated'] = (payload) => {
      if (payload.orderId === resolvedOrderId) {
        queryClient.setQueryData<OrderDetails>(queryKey, (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            ...(payload.courierId !== undefined ? { courierId: payload.courierId } : {}),
            status: payload.status,
            updatedAt: payload.updatedAt,
            statusHistory: [
              payload.logEntry,
              ...oldData.statusHistory.filter((entry) =>
                payload.logEntry.id
                  ? entry.id !== payload.logEntry.id
                  : entry.timestamp !== payload.logEntry.timestamp,
              ),
            ],
          };
        });
      }
    };

    // 3. Listen for Courier GPS Telemetry & Interpolate Coordinates
    const handleLocationUpdated: ServerToClientEvents['courier:location_updated'] = (payload) => {
      if (payload.orderId === resolvedOrderId) {
        queryClient.setQueryData<OrderDetails>(queryKey, (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            courierCoordinates: {
              lat: payload.lat,
              lng: payload.lng,
              lastUpdated: payload.timestamp,
            },
          };
        });
      }
    };

    // 4. Handle Reconnections: Reconcile missed events
    const handleReconnect = () => {
      joinRoom();
      void queryClient.invalidateQueries({ queryKey });
    };

    const handleCancelled: ServerToClientEvents['order:cancelled'] = (payload) => {
      if (payload.orderId !== resolvedOrderId) return;
      queryClient.setQueryData<OrderDetails>(queryKey, (oldData) =>
        oldData ? { ...oldData, status: OrderStatus.CANCELLED } : oldData,
      );
      void queryClient.invalidateQueries({ queryKey });
    };

    socket.on('order:status_updated', handleStatusUpdated);
    socket.on('courier:location_updated', handleLocationUpdated);
    socket.on('order:cancelled', handleCancelled);
    socket.on('connect', handleReconnect);
    const refreshOrder = () => {
      void queryClient.invalidateQueries({ queryKey });
    };
    socket.on('orders:changed', refreshOrder);
    if (socket.connected) handleReconnect();

    return () => {
      socket.emit('order:leave', { orderId: resolvedOrderId });
      socket.off('order:status_updated', handleStatusUpdated);
      socket.off('courier:location_updated', handleLocationUpdated);
      socket.off('order:cancelled', handleCancelled);
      socket.off('connect', handleReconnect);
      socket.off('orders:changed', refreshOrder);
    };
  }, [orderId, resolvedOrderId, queryClient, queryKey, socket]);

  return query;
}
