import { QueryClient } from '@tanstack/react-query';
import { clientSettings } from './clientSettings';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: clientSettings.VITE_QUERY_STALE_TIME_MS,
      refetchOnWindowFocus: false,
      retry: clientSettings.VITE_QUERY_RETRY_COUNT,
    },
  },
});
