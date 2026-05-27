import { apiRequest, type ApiResponse } from "@/lib/api";

export interface ScannerHistoryRecord {
  id: number;
  codeValue: string;
  codeFormat: string;
  source: string;
  brand: string | null;
  packPrice: number | null;
  nicotineMg: number | null;
  tarMg: number | null;
  damageScore: number;
  chemicals: string[];
  createdAt: string;
}

type ScannerHistoryRow = {
  id: number;
  code_value: string;
  code_format: string;
  source: string;
  brand: string | null;
  pack_price: number | null;
  nicotine_mg: number | null;
  tar_mg: number | null;
  damage_score: number;
  chemicals: string[];
  created_at: string;
};

function mapScannerRow(row: ScannerHistoryRow): ScannerHistoryRecord {
  return {
    id: row.id,
    codeValue: row.code_value,
    codeFormat: row.code_format,
    source: row.source,
    brand: row.brand,
    packPrice: row.pack_price,
    nicotineMg: row.nicotine_mg,
    tarMg: row.tar_mg,
    damageScore: row.damage_score,
    chemicals: row.chemicals ?? [],
    createdAt: row.created_at,
  };
}

export async function listScannerHistory(limit = 12) {
  const response = await apiRequest<ApiResponse<{ items: ScannerHistoryRow[]; pagination: unknown }>>(`/api/scanner-history?limit=${limit}`);
  return response.data.items.map(mapScannerRow);
}

export async function createScannerHistory(payload: {
  codeValue: string;
  codeFormat: string;
  source: string;
  brand?: string | null;
  packPrice?: number | null;
  nicotineMg?: number | null;
  tarMg?: number | null;
  damageScore: number;
  chemicals?: string[];
}) {
  const response = await apiRequest<ApiResponse<ScannerHistoryRow>>("/api/scanner-history", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapScannerRow(response.data);
}
