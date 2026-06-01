export const queryCacheTimes = {
  dashboard: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  },
  insights: {
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  },
  profile: {
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  },
  settings: {
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  },
  nearby: {
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  },
} as const;
