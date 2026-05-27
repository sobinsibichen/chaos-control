import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { createCravingPrediction, fetchLiveCravingPrediction, listCravingPredictions, type CravingPredictionRecord } from "@/lib/cravingApi";
import { createSmokeDna, listSmokeDna, listVoiceCommands } from "@/lib/intelligenceApi";
import { buildHeatmap, buildHourlyCravingData, buildWeeklyReplay, resolveSmokingProfile, type ActivityRow, type DashboardPayload, type RoastAnalyticsPayload } from "@/lib/intelligence";
import { queryKeys } from "@/lib/query-keys";
import { fetchMonthlyReplay, fetchYearlyReplay, listSmokeReplay } from "@/lib/replayApi";

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
  const smokeDnaBootstrappedRef = useRef(false);
  const cravingBootstrappedRef = useRef(false);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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

  const smokeDnaQuery = useQuery({
    queryKey: queryKeys.smokeDna,
    queryFn: () => listSmokeDna(6),
  });

  const replayHistoryQuery = useQuery({
    queryKey: queryKeys.smokeReplayHistory,
    queryFn: () => listSmokeReplay(8),
  });

  const monthlyReplayQuery = useQuery({
    queryKey: queryKeys.smokeReplayMonthly(currentYear, currentMonth),
    queryFn: () => fetchMonthlyReplay(currentYear, currentMonth),
  });

  const yearlyReplayQuery = useQuery({
    queryKey: queryKeys.smokeReplayYearly(currentYear),
    queryFn: () => fetchYearlyReplay(currentYear),
  });

  const cravingHistoryQuery = useQuery({
    queryKey: queryKeys.cravingHistory,
    queryFn: () => listCravingPredictions(12),
  });

  const liveCravingQuery = useQuery({
    queryKey: queryKeys.cravingLive,
    queryFn: fetchLiveCravingPrediction,
    refetchInterval: 60000,
  });

  const voiceQuery = useQuery({
    queryKey: queryKeys.voiceCommands,
    queryFn: () => listVoiceCommands(20),
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
    if (!dashboardQuery.data || !analyticsQuery.data?.analytics) {
      return;
    }
    if (smokeDnaBootstrappedRef.current || smokeDnaQuery.isLoading || createSmokeDnaMutation.isPending) {
      return;
    }
    if ((smokeDnaQuery.data?.items.length ?? 0) === 0) {
      smokeDnaBootstrappedRef.current = true;
      createSmokeDnaMutation.mutate();
    }
  }, [analyticsQuery.data?.analytics, createSmokeDnaMutation, dashboardQuery.data, smokeDnaQuery.data?.items.length, smokeDnaQuery.isLoading]);

  useEffect(() => {
    if (!dashboardQuery.data || liveCravingQuery.isLoading || createCravingMutation.isPending) {
      return;
    }
    if (cravingBootstrappedRef.current) {
      return;
    }
    if ((cravingHistoryQuery.data?.length ?? 0) === 0) {
      cravingBootstrappedRef.current = true;
      createCravingMutation.mutate();
    }
  }, [createCravingMutation, cravingHistoryQuery.data?.length, dashboardQuery.data, liveCravingQuery.isLoading]);

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data?.analytics;
  const activity = activityQuery.data?.activity ?? [];
  const smokeDna = smokeDnaQuery.data?.items[0];
  const monthlyReplay = monthlyReplayQuery.data;
  const yearlyReplay = yearlyReplayQuery.data;
  const replayHistory = replayHistoryQuery.data ?? [];
  const cravingHistory = cravingHistoryQuery.data ?? [];
  const liveCraving = liveCravingQuery.data;
  const voiceHistory = voiceQuery.data?.items ?? [];

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
    voiceHistory,
    profileLabel,
    hourlyCraving,
    weeklyReplay,
    replayHeatmap,
    isLoading:
      dashboardQuery.isLoading ||
      analyticsQuery.isLoading ||
      smokeDnaQuery.isLoading ||
      monthlyReplayQuery.isLoading ||
      yearlyReplayQuery.isLoading ||
      liveCravingQuery.isLoading ||
      voiceQuery.isLoading,
    error:
      (dashboardQuery.error instanceof Error && dashboardQuery.error.message) ||
      (analyticsQuery.error instanceof Error && analyticsQuery.error.message) ||
      (smokeDnaQuery.error instanceof Error && smokeDnaQuery.error.message) ||
      (monthlyReplayQuery.error instanceof Error && monthlyReplayQuery.error.message) ||
      (yearlyReplayQuery.error instanceof Error && yearlyReplayQuery.error.message) ||
      (liveCravingQuery.error instanceof Error && liveCravingQuery.error.message) ||
      (voiceQuery.error instanceof Error && voiceQuery.error.message) ||
      "",
  };
}
