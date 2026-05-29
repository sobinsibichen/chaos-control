import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ScanRecord {
  id: string;
  code: string;
  scannedAt: string;
  format: string;
  source: string;
  brand: string | null;
  priceEstimate: number | null;
  nicotineMg: number | null;
  tarMg: number | null;
  damageScore: number;
  chemicals: string[];
}

export interface ReplayBookmark {
  key: string;
  viewedAt: string;
}

interface IntelligenceState {
  scanHistory: ScanRecord[];
  replayBookmarks: ReplayBookmark[];
  saveScan: (record: ScanRecord) => void;
  markReplayViewed: (key: string) => void;
}

export const useIntelligenceStore = create<IntelligenceState>()(
  persist(
    (set) => ({
      scanHistory: [],
      replayBookmarks: [],
      saveScan: (record) =>
        set((state) => ({
          scanHistory: [record, ...state.scanHistory].slice(0, 24),
        })),
      markReplayViewed: (key) =>
        set((state) => ({
          replayBookmarks: [
            { key, viewedAt: new Date().toISOString() },
            ...state.replayBookmarks.filter((item) => item.key !== key),
          ].slice(0, 20),
        })),
    }),
    {
      name: "last-puff-intelligence",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scanHistory: state.scanHistory,
        replayBookmarks: state.replayBookmarks,
      }),
    },
  ),
);
