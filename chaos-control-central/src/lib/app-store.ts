import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "last-puff-app-state";

export interface NearbySmoker {
  id: string;
  username: string;
  avatar: string;
  distanceMeters: number;
  status: string;
  mood: string;
  chaosLevel: number;
  online: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "me" | "them";
  text: string;
  timestamp: number;
}

export interface AppState {
  auth: {
    isAuthenticated: boolean;
    rememberMe: boolean;
    token: string | null;
    user: {
      username: string;
      email: string;
      avatar: string;
    } | null;
  };
  settings: {
    cigarettePrice: number;
    currencySymbol: string;
    visibleOnRadar: boolean;
  };
  stats: {
    cigarettesToday: number;
    fakeQuits: number;
    lifetimeCigarettes: number;
    drinksToday: number;
    blockedBuys: number;
    drunkTexts: number;
    sleepDebtHours: number;
    exMessages: number;
    blockedShoppingAttempts: number;
    worstSleepNightHours: number;
    monthlyCigarettes: number[];
    dailyCigarettes: number[];
  };
  social: {
    radarUsers: NearbySmoker[];
    lastScannedAt: number | null;
    conversations: Record<string, ChatMessage[]>;
  };
  damage: {
    unlockedApps: boolean;
    unlockFailures: number;
    unlockSuccessAt: number | null;
  };
}

const defaultState: AppState = {
  auth: {
    isAuthenticated: false,
    rememberMe: true,
    token: null,
    user: {
      username: "Vanessa Chaos",
      email: "hello@lastpuff.app",
      avatar: "V",
    },
  },
  settings: {
    cigarettePrice: 20,
    currencySymbol: "₹",
    visibleOnRadar: false,
  },
  stats: {
    cigarettesToday: 7,
    fakeQuits: 43,
    lifetimeCigarettes: 12437,
    drinksToday: 3.5,
    blockedBuys: 14,
    drunkTexts: 2,
    sleepDebtHours: 27,
    exMessages: 9,
    blockedShoppingAttempts: 14,
    worstSleepNightHours: 31,
    monthlyCigarettes: [312, 288, 340, 318, 355, 371, 330, 408, 392, 425, 447, 468],
    dailyCigarettes: [9, 7, 11, 18, 15, 12, 21],
  },
  social: {
    radarUsers: [],
    lastScannedAt: null,
    conversations: {},
  },
  damage: {
    unlockedApps: false,
    unlockFailures: 0,
    unlockSuccessAt: null,
  },
};

let state = defaultState;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function safeParseState(raw: string | null): Partial<AppState> | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<AppState>;
  } catch {
    return null;
  }
}

function mergeState(partial: Partial<AppState>): AppState {
  return {
    auth: {
      ...defaultState.auth,
      ...partial.auth,
      user: partial.auth?.user ?? defaultState.auth.user,
    },
    settings: { ...defaultState.settings, ...partial.settings },
    stats: { ...defaultState.stats, ...partial.stats },
    social: {
      ...defaultState.social,
      ...partial.social,
      conversations: { ...defaultState.social.conversations, ...partial.social?.conversations },
    },
    damage: { ...defaultState.damage, ...partial.damage },
  };
}

function persist(nextState: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function hydrate() {
  if (hydrated || typeof window === "undefined") {
    return;
  }

  const persisted = safeParseState(window.localStorage.getItem(STORAGE_KEY));

  if (persisted) {
    state = mergeState(persisted);
  }

  hydrated = true;
  emit();
}

function setState(updater: AppState | ((current: AppState) => AppState)) {
  const nextState = typeof updater === "function" ? updater(state) : updater;
  state = nextState;
  persist(nextState);
  emit();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAppStore<T>(selector: (value: AppState) => T): T {
  useEffect(() => {
    hydrate();
  }, []);

  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selector(state),
    () => selector(defaultState),
  );
}

export const appStore = {
  hydrate,
  getState: () => state,
  login(payload: { username: string; email: string; rememberMe: boolean; token?: string | null }) {
    setState((current) => ({
      ...current,
      auth: {
        isAuthenticated: true,
        rememberMe: payload.rememberMe,
        token: payload.token ?? null,
        user: {
          username: payload.username,
          email: payload.email,
          avatar: payload.username.slice(0, 1).toUpperCase(),
        },
      },
      stats: {
        cigarettesToday: 0,
        fakeQuits: 0,
        lifetimeCigarettes: 0,
        drinksToday: 0,
        blockedBuys: 0,
        drunkTexts: 0,
        sleepDebtHours: 0,
        exMessages: 0,
        blockedShoppingAttempts: 0,
        worstSleepNightHours: 0,
        monthlyCigarettes: [0],
        dailyCigarettes: [0],
      },
    }));
  },
  logout() {
    setState((current) => ({
      ...current,
      auth: {
        ...current.auth,
        isAuthenticated: false,
        token: null,
      },
    }));
  },
  updateSettings(partial: Partial<AppState["settings"]>) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...partial,
      },
    }));
  },
  recordPuff() {
    setState((current) => {
      const monthlyCigarettes = [...current.stats.monthlyCigarettes];
      monthlyCigarettes[monthlyCigarettes.length - 1] += 1;

      const dailyCigarettes = [...current.stats.dailyCigarettes];
      dailyCigarettes[dailyCigarettes.length - 1] += 1;

      return {
        ...current,
        stats: {
          ...current.stats,
          cigarettesToday: current.stats.cigarettesToday + 1,
          lifetimeCigarettes: current.stats.lifetimeCigarettes + 1,
          fakeQuits: current.stats.fakeQuits + 1,
          monthlyCigarettes,
          dailyCigarettes,
        },
      };
    });
  },
  setRadarUsers(users: NearbySmoker[]) {
    setState((current) => ({
      ...current,
      social: {
        ...current.social,
        radarUsers: users,
        lastScannedAt: users.length > 0 ? Date.now() : null,
      },
    }));
  },
  clearRadarUsers() {
    setState((current) => ({
      ...current,
      social: {
        ...current.social,
        radarUsers: [],
        lastScannedAt: null,
      },
    }));
  },
  addMessage(userId: string, sender: ChatMessage["sender"], text: string, timestamp = Date.now()) {
    setState((current) => {
      const messages = current.social.conversations[userId] ?? [];

      return {
        ...current,
        social: {
          ...current.social,
          conversations: {
            ...current.social.conversations,
            [userId]: [
              ...messages,
              {
                id: makeId(sender),
                sender,
                text,
                timestamp,
              },
            ],
          },
        },
      };
    });
  },
  failUnlockAttempt() {
    setState((current) => ({
      ...current,
      damage: {
        ...current.damage,
        unlockedApps: false,
        unlockFailures: current.damage.unlockFailures + 1,
      },
    }));
  },
  unlockApps() {
    setState((current) => ({
      ...current,
      damage: {
        ...current.damage,
        unlockedApps: true,
        unlockSuccessAt: Date.now(),
      },
    }));
  },
  relockApps() {
    setState((current) => ({
      ...current,
      damage: {
        ...current.damage,
        unlockedApps: false,
      },
    }));
  },
};
