import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: 'always',
        staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh longer
        gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache longer
        // Specific stale times for different query types
        networkMode: 'online',
      },
      mutations: {
        retry: 1,
        networkMode: 'online',
      },
    },
  })
}

