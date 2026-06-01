import type { QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryCacheTimes } from "@/lib/query-cache";
import { queryKeys } from "@/lib/query-keys";

let lastPrefetchAt = 0;
const PREFETCH_COOLDOWN_MS = 60_000;

export function prefetchCoreAppData(queryClient: QueryClient) {
  if (typeof window === "undefined") {
    return;
  }

  const now = Date.now();
  if (now - lastPrefetchAt < PREFETCH_COOLDOWN_MS) {
    return;
  }
  lastPrefetchAt = now;

  const prefetch = () => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard,
      queryFn: () => apiRequest("/api/stats/dashboard", { skipLoading: true }),
      ...queryCacheTimes.dashboard,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.analytics,
      queryFn: () => apiRequest("/api/analytics/roast", { skipLoading: true }),
      ...queryCacheTimes.insights,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.activity,
      queryFn: () => apiRequest("/api/activity/recent?limit=30", { skipLoading: true }),
      ...queryCacheTimes.insights,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.profile,
      queryFn: () => apiRequest("/api/profile", { skipLoading: true }),
      ...queryCacheTimes.profile,
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(prefetch, { timeout: 2500 });
    return;
  }

  window.setTimeout(prefetch, 800);
}
