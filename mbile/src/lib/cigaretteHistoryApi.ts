import { apiRequest } from "@/lib/api";

export interface CigaretteLogRecord {
  id: number;
  cigarettesCount: number;
  pricePerUnit: number;
  mood: string;
  loggedAt: string;
}

export async function listCigaretteHistory(options: { limit?: number; skipLoading?: boolean } = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 2000, 5000));
  const response = await apiRequest<{ success: boolean; logs: CigaretteLogRecord[] }>(
    `/api/cigarettes/history?limit=${limit}`,
    { skipLoading: options.skipLoading ?? true },
  );

  return response.logs;
}
