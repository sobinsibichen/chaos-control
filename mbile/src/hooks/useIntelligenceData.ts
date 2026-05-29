import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/lib/app-store";
import { createCravingPrediction, createFallbackCravingPrediction, fetchLiveCravingPrediction, listCravingPredictions, type CravingPredictionRecord } from "@/lib/cravingApi";
import { createFallbackSmokeDna, createSmokeDna, listSmokeDna } from "@/lib/intelligenceApi";
import {
  buildHeatmap,
  buildHourlyCravingData,
  buildWeeklyReplay,
  createFallbackAnalytics,
  createFallbackDashboard,
  resolveSmokingProfile,
  type ActivityRow,
  type DashboardPayload,
  type RoastAnalyticsPayload,
} from "@/lib/intelligence";
import { queryKeys } from "@/lib/query-keys";
import { createFallbackReplayRecord, fetchMonthlyReplay, fetchYearlyReplay, listSmokeReplay } from "@/lib/replayApi";

function buildPredictionSeries(prediction: CravingPredictionRecord | undefined) {
  const map = new Map<number, number>();
  prediction?.dangerousHours.forEach((hour) => {
    map.set(hour.hour, hour.score);
  });

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    intensity: map.get(hour) ?? 14,
  }));
}

export function useIntelligenceData() {
  const queryClient = useQueryClient();
  const hydrated = useAppStore((state) => state.meta.hydrated);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const queriesEnabled = hydrated && isAuthenticated;
  const smokeDnaBootstrappedRef = useRef(false);
  const cravingBootstrappedRef = useRef(false);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      try {
        return await apiRequest<{ success: boolean } & DashboardPayload>("/api/stats/dashboard");
      } catch {
        return createFallbackDashboard();
      }
    },
    enabled: queriesEnabled,
  });

  const analyticsQuery = useQuery({
    queryKey: queryKeys.analytics,
    queryFn: async () => {
      try {
        return await apiRequest<{ success: boolean; analytics: RoastAnalyticsPayload }>("/api/analytics/roast");
      } catch {
        return { analytics: createFallbackAnalytics() };
      }
    },
    enabled: queriesEnabled,
  });

  const activityQuery = useQuery({
    queryKey: queryKeys.activity,
    queryFn: async () => {
      try {
        return await apiRequest<{ success: boolean; activity: ActivityRow[] }>("/api/activity/recent?limit=30");
      } catch {
        return { activity: [] };
      }
    },
    enabled: queriesEnabled,
  });

  const smokeDnaQuery = useQuery({
    queryKey: queryKeys.smokeDna,
    queryFn: async () => {
      try {
        return await listSmokeDna(6);
      } catch {
        return createFallbackSmokeDna();
      }
    },
    enabled: queriesEnabled,
  });

  const replayHistoryQuery = useQuery({
    queryKey: queryKeys.smokeReplayHistory,
    queryFn: async () => {
      try {
        return await listSmokeReplay(8);
      } catch {
        return [];
      }
    },
    enabled: queriesEnabled,
  });

  const monthlyReplayQuery = useQuery({
    queryKey: queryKeys.smokeReplayMonthly(currentYear, currentMonth),
    queryFn: async () => {
      try {
        return await fetchMonthlyReplay(currentYear, currentMonth);
      } catch {
        return createFallbackReplayRecord();
      }
    },
    enabled: queriesEnabled,
  });

  const yearlyReplayQuery = useQuery({
    queryKey: queryKeys.smokeReplayYearly(currentYear),
    queryFn: async () => {
      try {
        return await fetchYearlyReplay(currentYear);
      } catch {
        return createFallbackReplayRecord();
      }
    },
    enabled: queriesEnabled,
  });

  const cravingHistoryQuery = useQuery({
    queryKey: queryKeys.cravingHistory,
    queryFn: async () => {
      try {
        return await listCravingPredictions(12);
      } catch {
        return [];
      }
    },
    enabled: queriesEnabled,
  });

  const liveCravingQuery = useQuery({
    queryKey: queryKeys.cravingLive,
    queryFn: async () => {
      try {
        return await fetchLiveCravingPrediction();
      } catch {
        return createFallbackCravingPrediction();
      }
    },
    enabled: queriesEnabled,
  });

  const createSmokeDnaMutation = useMutation({
    mutationFn: () => createSmokeDna(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.smokeDna });
    },
  });

  const createCravingMutation = useMutation({
    mutationFn: () => createCravingPrediction({ predictionWindow: "30m" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cravingHistory });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cravingLive });
    },
  });

  useEffect(() => {
    if (!queriesEnabled || !dashboardQuery.data || !analyticsQuery.data?.analytics) {
      return;
    }
    if (smokeDnaBootstrappedRef.current || smokeDnaQuery.isLoading || createSmokeDnaMutation.isPending) {
      return;
    }
    if ((smokeDnaQuery.data?.items.length ?? 0) === 0) {
      smokeDnaBootstrappedRef.current = true;
      createSmokeDnaMutation.mutate();
    }
  }, [analyticsQuery.data?.analytics, createSmokeDnaMutation, dashboardQuery.data, queriesEnabled, smokeDnaQuery.data?.items.length, smokeDnaQuery.isLoading]);

  useEffect(() => {
    if (!queriesEnabled || !dashboardQuery.data || liveCravingQuery.isLoading || createCravingMutation.isPending) {
      return;
    }
    if (cravingBootstrappedRef.current) {
      return;
    }
    if ((cravingHistoryQuery.data?.length ?? 0) === 0) {
      cravingBootstrappedRef.current = true;
      createCravingMutation.mutate();
    }
  }, [createCravingMutation, cravingHistoryQuery.data?.length, dashboardQuery.data, liveCravingQuery.isLoading, queriesEnabled]);

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data?.analytics;
  const activity = activityQuery.data?.activity ?? [];
  const smokeDna = smokeDnaQuery.data?.items[0];
  const monthlyReplay = monthlyReplayQuery.data;
  const yearlyReplay = yearlyReplayQuery.data;
  const replayHistory = replayHistoryQuery.data ?? [];
  const cravingHistory = cravingHistoryQuery.data ?? [];
  const liveCraving = liveCravingQuery.data;

  const profileLabel = smokeDna?.smokerType ?? resolveSmokingProfile(dashboard, analytics);
  const hourlyCraving = useMemo(
    () => (liveCraving ? buildPredictionSeries(liveCraving) : buildHourlyCravingData(dashboard, analytics)),
    [analytics, dashboard, liveCraving],
  );
  const weeklyReplay = useMemo(() => buildWeeklyReplay(analytics), [analytics]);
  const replayHeatmap = useMemo(() => {
    if (monthlyReplay?.analytics.calendarHeatmap.length) {
      const peak = Math.max(...monthlyReplay.analytics.calendarHeatmap.map((entry) => entry.total), 1);
      return Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 7 }, (_, column) => {
          const entry = monthlyReplay.analytics.calendarHeatmap[row * 7 + column];
          const intensity = entry ? Math.round((entry.total / peak) * 100) : 0;
          return { key: `${row}-${column}`, intensity };
        }),
      );
    }
    return buildHeatmap(analytics);
  }, [analytics, monthlyReplay]);

  return {
    dashboard,
    analytics,
    activity,
    smokeDna,
    monthlyReplay,
    yearlyReplay,
    replayHistory,
    cravingHistory,
    liveCraving,
    profileLabel,
    hourlyCraving,
    weeklyReplay,
    replayHeatmap,
    isReady: queriesEnabled,
    isLoading:
      dashboardQuery.isLoading ||
      analyticsQuery.isLoading ||
      smokeDnaQuery.isLoading ||
      monthlyReplayQuery.isLoading ||
      yearlyReplayQuery.isLoading ||
      liveCravingQuery.isLoading ||
      false,
    error:
      (dashboardQuery.error instanceof Error && dashboardQuery.error.message) ||
      (analyticsQuery.error instanceof Error && analyticsQuery.error.message) ||
      (smokeDnaQuery.error instanceof Error && smokeDnaQuery.error.message) ||
      (monthlyReplayQuery.error instanceof Error && monthlyReplayQuery.error.message) ||
      (yearlyReplayQuery.error instanceof Error && yearlyReplayQuery.error.message) ||
      (liveCravingQuery.error instanceof Error && liveCravingQuery.error.message) ||
      "",
  };
}
