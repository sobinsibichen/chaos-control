import { apiRequest, type ApiResponse } from "@/lib/api";

interface ReplayRequestOptions {
  skipLoading?: boolean;
}

export interface ReplayAnalytics {
  cigarettesConsumed: number;
  moneyBurned: number;
  peakCravingHour: string | null;
  highestSmokingDay: string | null;
  streak: number;
  calendarHeatmap: Array<{ day: string; total: number }>;
  cigarettesAvoidedTotal: number;
}

export interface SmokeReplayRecord {
  id: number;
  replayPeriod: string;
  replayKey: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  analytics: ReplayAnalytics;
  highlights: string[];
  createdAt: string;
  updatedAt: string;
}

type SmokeReplayRow = {
  id: number;
  replay_period: string;
  replay_key: string;
  title: string;
  period_start: string;
  period_end: string;
  analytics: ReplayAnalytics;
  highlights: string[];
  created_at: string;
  updated_at: string;
};

function mapReplay(row: SmokeReplayRow): SmokeReplayRecord {
  return {
    id: row.id,
    replayPeriod: row.replay_period,
    replayKey: row.replay_key,
    title: row.title,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    analytics: row.analytics,
    highlights: row.highlights ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchMonthlyReplay(year: number, month: number, options: ReplayRequestOptions = {}) {
  const response = await apiRequest<ApiResponse<SmokeReplayRow>>(`/api/smoke-replay/monthly?year=${year}&month=${month}`, options);
  return mapReplay(response.data);
}

export async function fetchYearlyReplay(year: number, options: ReplayRequestOptions = {}) {
  const response = await apiRequest<ApiResponse<SmokeReplayRow>>(`/api/smoke-replay/yearly?year=${year}`, options);
  return mapReplay(response.data);
}

export async function listSmokeReplay(limit = 12, options: ReplayRequestOptions = {}) {
  const response = await apiRequest<ApiResponse<{ items: SmokeReplayRow[]; pagination: unknown }>>(`/api/smoke-replay?limit=${limit}`, options);
  return response.data.items.map(mapReplay);
}

export function createFallbackReplayRecord(): SmokeReplayRecord {
  return {
    id: 0,
    replayPeriod: "monthly",
    replayKey: "fallback",
    title: "Replay unavailable",
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
    analytics: {
      cigarettesConsumed: 0,
      moneyBurned: 0,
      peakCravingHour: null,
      highestSmokingDay: null,
      streak: 0,
      calendarHeatmap: Array.from({ length: 12 }, (_, index) => ({ day: `Day ${index + 1}`, total: 0 })),
      cigarettesAvoidedTotal: 0,
    },
    highlights: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
