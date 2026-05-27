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

export interface VoiceCommandRecord {
  id: string;
  command: string;
  response: string;
  createdAt: string;
}

export interface ReplayBookmark {
  key: string;
  viewedAt: string;
}

interface IntelligenceState {
  scanHistory: ScanRecord[];
  voiceHistory: VoiceCommandRecord[];
  replayBookmarks: ReplayBookmark[];
  saveScan: (record: ScanRecord) => void;
  saveVoiceCommand: (record: VoiceCommandRecord) => void;
  markReplayViewed: (key: string) => void;
}

export const useIntelligenceStore = create<IntelligenceState>()(
  persist(
    (set) => ({
      scanHistory: [],
      voiceHistory: [],
      replayBookmarks: [],
      saveScan: (record) =>
        set((state) => ({
          scanHistory: [record, ...state.scanHistory].slice(0, 24),
        })),
      saveVoiceCommand: (record) =>
        set((state) => ({
          voiceHistory: [record, ...state.voiceHistory].slice(0, 30),
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
        voiceHistory: state.voiceHistory,
        replayBookmarks: state.replayBookmarks,
      }),
    },
  ),
);
