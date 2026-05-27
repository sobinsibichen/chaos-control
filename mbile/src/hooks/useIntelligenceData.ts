import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import {
  type ActivityRow,
  type DashboardPayload,
  type RoastAnalyticsPayload,
  buildHeatmap,
  buildHourlyCravingData,
  buildWeeklyReplay,
  resolveSmokingProfile,
} from "@/lib/intelligence";
import { queryKeys } from "@/lib/query-keys";

export function useIntelligenceData() {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiRequest<{ success: boolean } & DashboardPayload>("/api/stats/dashboard"),
    refetchInterval: 60000,
  });

  const analyticsQuery = useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => apiRequest<{ success: boolean; analytics: RoastAnalyticsPayload }>("/api/analytics/roast"),
    refetchInterval: 60000,
  });

  const activityQuery = useQuery({
    queryKey: queryKeys.activity,
    queryFn: () => apiRequest<{ success: boolean; activity: ActivityRow[] }>("/api/activity/recent?limit=12"),
    refetchInterval: 60000,
  });

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data?.analytics;
  const activity = activityQuery.data?.activity ?? [];
  const profileLabel = resolveSmokingProfile(dashboard, analytics);
  const hourlyCraving = buildHourlyCravingData(dashboard, analytics);
  const weeklyReplay = buildWeeklyReplay(analytics);
  const replayHeatmap = buildHeatmap(analytics);

  return {
    dashboard,
    analytics,
    activity,
    profileLabel,
    hourlyCraving,
    weeklyReplay,
    replayHeatmap,
    isLoading: dashboardQuery.isLoading || analyticsQuery.isLoading,
    error:
      (dashboardQuery.error instanceof Error && dashboardQuery.error.message) ||
      (analyticsQuery.error instanceof Error && analyticsQuery.error.message) ||
      (activityQuery.error instanceof Error && activityQuery.error.message) ||
      "",
  };
}
