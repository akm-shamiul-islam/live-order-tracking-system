import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function usePublicSettings() {
  return useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.settings.get(),
    staleTime: 0,
  });
}
