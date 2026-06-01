import { apiRequest, type ApiResponse } from "@/lib/api";

export interface CravingHour {
  hour: number;
  score: number;
}

export interface CravingPredictionRecord {
  id: number;
  predictionWindow: string;
  cravingProbability: number;
  intensityScore: number;
  dangerousHours: CravingHour[];
  triggerPrediction: {
    primary: string;
    mood: string;
    timeBias: number;
  };
  insightText: string;
  generatedFrom: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

type CravingPredictionRow = {
  id: number;
  prediction_window: string;
  craving_probability: number;
  intensity_score: number;
  dangerous_hours: CravingHour[];
  trigger_prediction: {
    primary: string;
    mood: string;
    timeBias: number;
  };
  insight_text: string;
  generated_from: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

function mapPrediction(row: CravingPredictionRow): CravingPredictionRecord {
  const triggerPrediction = row.trigger_prediction ?? {
    primary: "Routine loop",
    mood: "neutral",
    timeBias: new Date(row.created_at ?? Date.now()).getHours(),
  };

  return {
    id: row.id,
    predictionWindow: row.prediction_window,
    cravingProbability: row.craving_probability,
    intensityScore: row.intensity_score,
    dangerousHours: row.dangerous_hours ?? [],
    triggerPrediction,
    insightText: row.insight_text,
    generatedFrom: row.generated_from ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCravingPredictions(limit = 12) {
  const response = await apiRequest<ApiResponse<{ items: CravingPredictionRow[]; pagination: unknown }>>(
    `/api/craving-predictions?limit=${limit}`,
  );
  return response.data.items.map(mapPrediction);
}

export async function fetchLiveCravingPrediction() {
  const response = await apiRequest<ApiResponse<Omit<CravingPredictionRow, "id" | "created_at">>>("/api/craving-predictions/live");
  const triggerPrediction = response.data.trigger_prediction ?? {
    primary: "Routine loop",
    mood: "neutral",
    timeBias: new Date().getHours(),
  };

  return {
    id: 0,
    predictionWindow: response.data.prediction_window,
    cravingProbability: response.data.craving_probability,
    intensityScore: response.data.intensity_score,
    dangerousHours: response.data.dangerous_hours ?? [],
    triggerPrediction,
    insightText: response.data.insight_text,
    generatedFrom: response.data.generated_from ?? {},
    createdAt: new Date().toISOString(),
  } satisfies CravingPredictionRecord;
}

export function createFallbackCravingPrediction(): CravingPredictionRecord {
  return {
    id: 0,
    predictionWindow: "30m",
    cravingProbability: 0,
    intensityScore: 0,
    dangerousHours: Array.from({ length: 24 }, (_, hour) => ({ hour, score: 0 })),
    triggerPrediction: {
      primary: "Routine loop",
      mood: "neutral",
      timeBias: 0,
    },
    insightText: "Craving insights will appear once enough data is available.",
    generatedFrom: {},
    createdAt: new Date().toISOString(),
  };
}

export async function createCravingPrediction(payload: {
  predictionWindow?: string;
  stressLevel?: number | null;
  mood?: string | null;
  triggerContext?: string | null;
}) {
  const response = await apiRequest<ApiResponse<CravingPredictionRow>>("/api/craving-predictions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapPrediction(response.data);
}
