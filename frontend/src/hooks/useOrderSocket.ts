import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredSocket } from './useDeferredSocket';
import { api } from '../lib/api';
import { OrderDetails, OrderStatus, type ServerToClientEvents } from '@kitchentodoor/shared';
import { useAuth } from './useAuth';
import { clientSettings } from '../lib/clientSettings';
import { applyOrderStatus, applyCourierLocation, mergeOrderSnapshot } from '../lib/orderCache';

export function useOrderSocket(orderId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = useMemo(
    () => ['order', orderId, user?.id, user?.role],
    [orderId, user?.id, user?.role],
  );

  const query = useQuery<OrderDetails>({
    queryKey,
    queryFn: ({ signal }) => {
      if (!orderId) throw new Error('Order ID is required');
      return api.orders.getById(orderId, signal);
    },
    enabled: !!orderId && !!user,
    refetchInterval: clientSettings.VITE_ORDER_LIST_REFRESH_MS,
    structuralSharing: (previous, incoming) =>
      mergeOrderSnapshot(previous as OrderDetails | undefined, incoming as OrderDetails),
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
          return applyOrderStatus(oldData, payload);
        });
      }
    };

    // 3. Listen for Courier GPS Telemetry & Interpolate Coordinates
    const handleLocationUpdated: ServerToClientEvents['courier:location_updated'] = (payload) => {
      if (payload.orderId === resolvedOrderId) {
        queryClient.setQueryData<OrderDetails>(queryKey, (oldData) => {
          return applyCourierLocation(oldData, payload);
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
        applyOrderStatus(oldData, { ...payload, status: OrderStatus.CANCELLED }),
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
