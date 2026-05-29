import { apiRequest, type ApiResponse } from "@/lib/api";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PagedPayload<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface SmokeDnaRecord {
  id: number;
  smokerType: string;
  habitScore: number;
  smokingIntensity: number;
  triggerPatterns: Array<{ trigger: string; score: number }>;
  moodCorrelation: Record<string, number>;
  timeOfDayAnalysis: Record<string, number>;
  heatmap: Array<Array<{ day: number; block: number; intensity: number }>>;
  insights: string[];
  rawMetrics: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface RitualSessionRecord {
  id: number;
  mood: string;
  durationSeconds: number;
  breathCycles: number;
  ambientSound: boolean;
  notes: string | null;
  sessionData: Record<string, unknown>;
  createdAt: string;
}

export interface EmergencySessionRecord {
  id: number;
  triggerReason: string;
  durationSeconds: number;
  completed: boolean;
  breathingCompleted: boolean;
  vibrationUsed: boolean;
  motivationShown: string[];
  sessionData: Record<string, unknown>;
  createdAt: string;
}

export interface FavoriteStoreRecord {
  id: number;
  placeId: string;
  storeName: string;
  address: string;
  phoneNumber: string | null;
  mapsUrl: string | null;
  rating: number | null;
  isOpen: boolean | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

type SmokeDnaRow = {
  id: number;
  smoker_type: string;
  habit_score: number;
  smoking_intensity: number;
  trigger_patterns: Array<{ trigger: string; score: number }>;
  mood_correlation: Record<string, number>;
  time_of_day_analysis: Record<string, number>;
  heatmap: Array<Array<{ day: number; block: number; intensity: number }>>;
  insights: string[];
  raw_metrics: Record<string, number>;
  created_at: string;
  updated_at: string;
};

type RitualSessionRow = {
  id: number;
  mood: string;
  duration_seconds: number;
  breath_cycles: number;
  ambient_sound: boolean;
  notes: string | null;
  session_data: Record<string, unknown>;
  created_at: string;
};

type EmergencySessionRow = {
  id: number;
  trigger_reason: string;
  duration_seconds: number;
  completed: boolean;
  breathing_completed: boolean;
  vibration_used: boolean;
  motivation_shown: string[];
  session_data: Record<string, unknown>;
  created_at: string;
};

type FavoriteStoreRow = {
  id: number;
  place_id: string;
  store_name: string;
  address: string;
  phone_number: string | null;
  maps_url: string | null;
  rating: number | null;
  is_open: boolean | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function mapSmokeDna(row: SmokeDnaRow): SmokeDnaRecord {
  return {
    id: row.id,
    smokerType: row.smoker_type,
    habitScore: row.habit_score,
    smokingIntensity: row.smoking_intensity,
    triggerPatterns: row.trigger_patterns ?? [],
    moodCorrelation: row.mood_correlation ?? {},
    timeOfDayAnalysis: row.time_of_day_analysis ?? {},
    heatmap: row.heatmap ?? [],
    insights: row.insights ?? [],
    rawMetrics: row.raw_metrics ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRitualSession(row: RitualSessionRow): RitualSessionRecord {
  return {
    id: row.id,
    mood: row.mood,
    durationSeconds: row.duration_seconds,
    breathCycles: row.breath_cycles,
    ambientSound: row.ambient_sound,
    notes: row.notes,
    sessionData: row.session_data ?? {},
    createdAt: row.created_at,
  };
}

function mapEmergencySession(row: EmergencySessionRow): EmergencySessionRecord {
  return {
    id: row.id,
    triggerReason: row.trigger_reason,
    durationSeconds: row.duration_seconds,
    completed: row.completed,
    breathingCompleted: row.breathing_completed,
    vibrationUsed: row.vibration_used,
    motivationShown: row.motivation_shown ?? [],
    sessionData: row.session_data ?? {},
    createdAt: row.created_at,
  };
}

function mapFavoriteStore(row: FavoriteStoreRow): FavoriteStoreRecord {
  return {
    id: row.id,
    placeId: row.place_id,
    storeName: row.store_name,
    address: row.address,
    phoneNumber: row.phone_number,
    mapsUrl: row.maps_url,
    rating: row.rating,
    isOpen: row.is_open,
    latitude: row.latitude,
    longitude: row.longitude,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function mapPaged<TInput, TOutput>(payload: PagedPayload<TInput>, mapper: (row: TInput) => TOutput): PagedPayload<TOutput> {
  return {
    items: payload.items.map(mapper),
    pagination: payload.pagination,
  };
}

export async function listSmokeDna(limit = 5) {
  const response = await apiRequest<ApiResponse<PagedPayload<SmokeDnaRow>>>(`/api/smoke-dna?limit=${limit}`);
  return mapPaged(response.data, mapSmokeDna);
}

export async function createSmokeDna(payload: Partial<SmokeDnaRecord> = {}) {
  const response = await apiRequest<ApiResponse<SmokeDnaRow>>("/api/smoke-dna", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapSmokeDna(response.data);
}

export async function updateSmokeDna(id: number, payload: Partial<SmokeDnaRecord>) {
  const response = await apiRequest<ApiResponse<SmokeDnaRow>>(`/api/smoke-dna/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return mapSmokeDna(response.data);
}

export async function listRitualSessions(limit = 10) {
  const response = await apiRequest<ApiResponse<PagedPayload<RitualSessionRow>>>(`/api/ritual-sessions?limit=${limit}`);
  return mapPaged(response.data, mapRitualSession);
}

export async function createRitualSession(payload: {
  mood: string;
  durationSeconds: number;
  breathCycles: number;
  ambientSound: boolean;
  notes?: string | null;
  sessionData?: Record<string, unknown>;
}) {
  const response = await apiRequest<ApiResponse<RitualSessionRow>>("/api/ritual-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapRitualSession(response.data);
}

export async function listEmergencySessions(limit = 10) {
  const response = await apiRequest<ApiResponse<PagedPayload<EmergencySessionRow>>>(`/api/emergency-sessions?limit=${limit}`);
  return mapPaged(response.data, mapEmergencySession);
}

export async function createEmergencySession(payload: {
  triggerReason: string;
  durationSeconds: number;
  completed: boolean;
  breathingCompleted: boolean;
  vibrationUsed: boolean;
  motivationShown: string[];
  sessionData?: Record<string, unknown>;
}) {
  const response = await apiRequest<ApiResponse<EmergencySessionRow>>("/api/emergency-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapEmergencySession(response.data);
}

export async function listFavoriteStores(limit = 100) {
  const response = await apiRequest<ApiResponse<PagedPayload<FavoriteStoreRow>>>(`/api/favorite-stores?limit=${limit}`);
  return mapPaged(response.data, mapFavoriteStore);
}

export async function createFavoriteStore(payload: {
  placeId: string;
  storeName: string;
  address: string;
  phoneNumber?: string | null;
  mapsUrl?: string | null;
  rating?: number | null;
  isOpen?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const response = await apiRequest<ApiResponse<FavoriteStoreRow>>("/api/favorite-stores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapFavoriteStore(response.data);
}

export async function deleteFavoriteStore(id: number) {
  const response = await apiRequest<ApiResponse<{ id: number; store_name: string }>>(`/api/favorite-stores/${id}`, {
    method: "DELETE",
  });
  return response.data;
}
