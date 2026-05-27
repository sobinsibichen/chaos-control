import type { DashboardPayload } from "@/lib/intelligence";
import type { SmokeDnaRecord, VoiceCommandRecord } from "@/lib/intelligenceApi";
import type { CravingPredictionRecord } from "@/lib/cravingApi";
import type { SmokeReplayRecord } from "@/lib/replayApi";

export type InsightsTab = "Roast" | "Smoke DNA" | "Smoke Replay" | "Craving AI" | "Voice";

export interface InsightsSharedData {
  dashboard: DashboardPayload | undefined;
  analytics: import("@/lib/intelligence").RoastAnalyticsPayload | undefined;
  smokeDna: SmokeDnaRecord | undefined;
  monthlyReplay: SmokeReplayRecord | undefined;
  yearlyReplay: SmokeReplayRecord | undefined;
  replayHistory: SmokeReplayRecord[];
  cravingHistory: CravingPredictionRecord[];
  liveCraving: CravingPredictionRecord | undefined;
  voiceHistory: VoiceCommandRecord[];
  profileLabel: string;
  hourlyCraving: Array<{ hour: number; label: string; intensity: number }>;
  weeklyReplay: Array<{ day: string; value: number }>;
  replayHeatmap: Array<Array<{ key: string; intensity: number }>>;
}
