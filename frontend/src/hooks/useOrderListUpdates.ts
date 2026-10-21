import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDeferredSocket } from './useDeferredSocket';

export function useOrderListUpdates() {
  const queryClient = useQueryClient();
  const socket = useDeferredSocket();
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      for (const key of ['available-deliveries', 'my-orders', 'admin-orders', 'order'])
        void queryClient.invalidateQueries({ queryKey: [key] });
    };
    socket.on('orders:changed', refresh);
    socket.on('connect', refresh);
    if (socket.connected) refresh();
    return () => {
      socket.off('orders:changed', refresh);
      socket.off('connect', refresh);
    };
  }, [queryClient, socket]);
}
