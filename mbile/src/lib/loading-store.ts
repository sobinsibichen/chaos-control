import { create } from "zustand";

const DEFAULT_LOADING_MESSAGE = "Loading...";
const LOADING_DELAY_MS = 300;

type LoadingId = string;

interface LoadingEntry {
  id: LoadingId;
  message: string;
}

interface LoadingState {
  activeRequests: number;
  isVisible: boolean;
  message: string;
  startLoading: (message?: string) => LoadingId;
  stopLoading: (id?: LoadingId) => void;
  showLoading: (message?: string) => LoadingId;
  hideLoading: (id?: LoadingId) => void;
  resetLoading: () => void;
}

let delayTimer: ReturnType<typeof setTimeout> | null = null;
const entries = new Map<LoadingId, LoadingEntry>();

function createLoadingId() {
  return `loading-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function latestMessage() {
  const latest = Array.from(entries.values()).at(-1);
  return latest?.message || DEFAULT_LOADING_MESSAGE;
}

function clearDelayTimer() {
  if (!delayTimer) {
    return;
  }

  clearTimeout(delayTimer);
  delayTimer = null;
}

export const useLoadingStore = create<LoadingState>((set, get) => ({
  activeRequests: 0,
  isVisible: false,
  message: DEFAULT_LOADING_MESSAGE,
  startLoading(message = DEFAULT_LOADING_MESSAGE) {
    const id = createLoadingId();
    entries.set(id, { id, message });

    set({
      activeRequests: entries.size,
      message: latestMessage(),
    });

    if (!get().isVisible && !delayTimer) {
      delayTimer = setTimeout(() => {
        delayTimer = null;
        if (entries.size > 0) {
          set({
            isVisible: true,
            activeRequests: entries.size,
            message: latestMessage(),
          });
        }
      }, LOADING_DELAY_MS);
    }

    return id;
  },
  stopLoading(id) {
    if (id) {
      entries.delete(id);
    } else {
      const latestId = Array.from(entries.keys()).at(-1);
      if (latestId) {
        entries.delete(latestId);
      }
    }

    if (entries.size === 0) {
      clearDelayTimer();
      set({
        activeRequests: 0,
        isVisible: false,
        message: DEFAULT_LOADING_MESSAGE,
      });
      return;
    }

    set({
      activeRequests: entries.size,
      message: latestMessage(),
    });
  },
  showLoading(message) {
    return get().startLoading(message);
  },
  hideLoading(id) {
    get().stopLoading(id);
  },
  resetLoading() {
    entries.clear();
    clearDelayTimer();
    set({
      activeRequests: 0,
      isVisible: false,
      message: DEFAULT_LOADING_MESSAGE,
    });
  },
}));

export const loadingStore = {
  startLoading: (message?: string) => useLoadingStore.getState().startLoading(message),
  stopLoading: (id?: LoadingId) => useLoadingStore.getState().stopLoading(id),
  showLoading: (message?: string) => useLoadingStore.getState().showLoading(message),
  hideLoading: (id?: LoadingId) => useLoadingStore.getState().hideLoading(id),
  resetLoading: () => useLoadingStore.getState().resetLoading(),
};

export async function withLoader<T>(
  operation: Promise<T> | (() => Promise<T>),
  message?: string,
): Promise<T> {
  const loadingId = loadingStore.startLoading(message);

  try {
    return await (typeof operation === "function" ? operation() : operation);
  } finally {
    loadingStore.stopLoading(loadingId);
  }
}
