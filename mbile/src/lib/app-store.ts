import { useEffect, useSyncExternalStore } from "react";
import { clearSession, getStoredToken, getStoredUser, storeSession, type SessionUser } from "@/lib/session";

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
  streak?: number;
  level?: number;
  smokeFreeSeconds?: number;
  smokeFreeLabel?: string;
  onlineStatus?: "ONLINE" | "RECENTLY ACTIVE" | "OFFLINE" | string;
}

export interface ChatMessage {
  id: string;
  sender: "me" | "them";
  text: string;
  timestamp: number;
}

export interface AppState {
  meta: {
    hydrated: boolean;
  };
  auth: {
    isAuthenticated: boolean;
    rememberMe: boolean;
    token: string | null;
    user: SessionUser | null;
  };
  settings: {
    cigarettePrice: number;
    currencySymbol: string;
    visibleOnRadar: boolean;
    animatedBackgroundEnabled: boolean;
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
  meta: {
    hydrated: false,
  },
  auth: {
    isAuthenticated: false,
    rememberMe: true,
    token: null,
    user: null,
  },
  settings: {
    cigarettePrice: 20,
    currencySymbol: "₹",
    visibleOnRadar: false,
    animatedBackgroundEnabled: true,
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
    meta: {
      hydrated: partial.meta?.hydrated ?? defaultState.meta.hydrated,
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

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      social: nextState.social,
      damage: nextState.damage,
      settings: nextState.settings,
    }),
  );
}

function hydrate() {
  if (hydrated || typeof window === "undefined") {
    return;
  }

  const persisted = safeParseState(window.localStorage.getItem(STORAGE_KEY));

  if (persisted) {
    state = mergeState(persisted);
  }

  const token = getStoredToken();
  const user = getStoredUser();
  console.info("[auth-debug] hydrating session", {
    hasToken: Boolean(token),
    hasUser: Boolean(user),
    userId: user?.id,
  });
  state = {
    ...state,
    meta: {
      hydrated: true,
    },
    auth: {
      ...state.auth,
      isAuthenticated: Boolean(token && user),
      token,
      user,
    },
  };

  hydrated = true;
  emit();
}

function setState(updater: AppState | ((current: AppState) => AppState)) {
  const nextState = typeof updater === "function" ? updater(state) : updater;
  state = nextState;
  if (nextState.meta.hydrated) {
    hydrated = true;
  }
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
  login(payload: { id?: number | string; username: string; email: string; rememberMe: boolean; token: string; cigarettePrice?: number; visibilityEnabled?: boolean }) {
    const user: SessionUser = {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      avatar: payload.username.slice(0, 1).toUpperCase(),
      cigarettePrice: payload.cigarettePrice,
      visibilityEnabled: payload.visibilityEnabled,
    };
    storeSession(payload.token, user);
    console.info("[auth-debug] appStore.login", {
      userId: payload.id,
      email: payload.email,
      rememberMe: payload.rememberMe,
      tokenPreview: `${payload.token.slice(0, 12)}...`,
    });
    setState((current) => ({
      ...current,
      meta: {
        hydrated: true,
      },
      auth: {
        isAuthenticated: true,
        rememberMe: payload.rememberMe,
        token: payload.token,
        user,
      },
    }));
  },
  updateUser(user: Partial<NonNullable<AppState["auth"]["user"]>>) {
    setState((current) => {
      if (!current.auth.user) {
        return current;
      }

      const nextUser = {
        ...current.auth.user,
        ...user,
      };
      if (current.auth.token) {
        storeSession(current.auth.token, nextUser);
      }

      return {
        ...current,
        auth: {
          ...current.auth,
          user: nextUser,
        },
      };
    });
  },
  logout() {
    clearSession();
    console.info("[auth-debug] appStore.logout");
    setState((current) => ({
      ...current,
      meta: {
        hydrated: true,
      },
      auth: {
        isAuthenticated: false,
        rememberMe: true,
        token: null,
        user: null,
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
