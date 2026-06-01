import type { ActivityRow, DashboardPayload } from "@/lib/intelligence";
import type { SmokeDnaRecord } from "@/lib/intelligenceApi";
import type { CravingPredictionRecord } from "@/lib/cravingApi";
import type { SmokeReplayRecord } from "@/lib/replayApi";

export type InsightsTab = "Roast" | "Smoke DNA" | "Craving AI" | "Voice";

export interface InsightsSharedData {
  dashboard: DashboardPayload | undefined;
  analytics: import("@/lib/intelligence").RoastAnalyticsPayload | undefined;
  smokeDna: SmokeDnaRecord | undefined;
  monthlyReplay: SmokeReplayRecord | undefined;
  yearlyReplay: SmokeReplayRecord | undefined;
  replayHistory: SmokeReplayRecord[];
  cravingHistory: CravingPredictionRecord[];
  liveCraving: CravingPredictionRecord | undefined;
  profileLabel: string;
  activity: ActivityRow[];
  hourlyCraving: Array<{ hour: number; label: string; intensity: number }>;
  weeklyReplay: Array<{ day: string; value: number }>;
  replayHeatmap: Array<Array<{ key: string; intensity: number }>>;
}
