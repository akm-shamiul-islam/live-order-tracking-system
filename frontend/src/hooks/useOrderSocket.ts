import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { OrderDetails, OrderStatus, type ServerToClientEvents } from '@kitchentodoor/shared';

export function useOrderSocket(orderId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery<OrderDetails>({
    queryKey: ['order', orderId],
    queryFn: () => {
      if (!orderId) throw new Error('Order ID is required');
      return api.orders.getById(orderId);
    },
    enabled: !!orderId,
  });

  const resolvedOrderId = query.data?.id;

  useEffect(() => {
    if (!orderId || !resolvedOrderId) return;

    const socket = getSocket();

    // 1. Join Order Room
    const joinRoom = () => socket.emit('order:join', { orderId: resolvedOrderId });

    // 2. Listen for Real-Time Status Updates & Mutate Cache Instantly
    const handleStatusUpdated: ServerToClientEvents['order:status_updated'] = (payload) => {
      if (payload.orderId === resolvedOrderId) {
        queryClient.setQueryData<OrderDetails>(['order', orderId], (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
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
        queryClient.setQueryData<OrderDetails>(['order', orderId], (oldData) => {
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
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    };

    const handleCancelled: ServerToClientEvents['order:cancelled'] = (payload) => {
      if (payload.orderId !== resolvedOrderId) return;
      queryClient.setQueryData<OrderDetails>(['order', orderId], (oldData) =>
        oldData ? { ...oldData, status: OrderStatus.CANCELLED } : oldData,
      );
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    };

    socket.on('order:status_updated', handleStatusUpdated);
    socket.on('courier:location_updated', handleLocationUpdated);
    socket.on('order:cancelled', handleCancelled);
    socket.on('connect', handleReconnect);
    if (socket.connected) handleReconnect();

    return () => {
      socket.emit('order:leave', { orderId: resolvedOrderId });
      socket.off('order:status_updated', handleStatusUpdated);
      socket.off('courier:location_updated', handleLocationUpdated);
      socket.off('order:cancelled', handleCancelled);
      socket.off('connect', handleReconnect);
    };
  }, [orderId, resolvedOrderId, queryClient]);

  return query;
}
