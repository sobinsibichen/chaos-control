import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const STORAGE_KEY = "last-puff-mobile-state";

const defaultState = {
  auth: {
    isAuthenticated: false,
    rememberMe: true,
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

const useAppStore = create()(
  persist(
    (set) => ({
      ...defaultState,
      bootstrapped: false,
      hydrate: async () => {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (!raw) {
          set({ bootstrapped: true });
          return;
        }

        const parsed = JSON.parse(raw);

        set({
          ...defaultState,
          bootstrapped: true,
          auth: {
            ...defaultState.auth,
            ...parsed.auth,
            user: (parsed.auth && parsed.auth.user) || defaultState.auth.user,
          },
          settings: { ...defaultState.settings, ...parsed.settings },
          stats: { ...defaultState.stats, ...parsed.stats },
          social: {
            ...defaultState.social,
            ...parsed.social,
            conversations: {
              ...defaultState.social.conversations,
              ...(parsed.social && parsed.social.conversations),
            },
          },
          damage: { ...defaultState.damage, ...parsed.damage },
        });
      },
      login: (payload) =>
        set((state) => ({
          ...state,
          auth: {
            isAuthenticated: true,
            rememberMe: payload.rememberMe,
            user: {
              username: payload.username,
              email: payload.email,
              avatar: payload.username.slice(0, 1).toUpperCase(),
            },
          },
        })),
      logout: () =>
        set((state) => ({
          ...state,
          auth: { ...state.auth, isAuthenticated: false },
        })),
      updateSettings: (partial) =>
        set((state) => ({
          ...state,
          settings: { ...state.settings, ...partial },
        })),
      recordPuff: () =>
        set((state) => {
          const monthlyCigarettes = [...state.stats.monthlyCigarettes];
          monthlyCigarettes[monthlyCigarettes.length - 1] += 1;

          const dailyCigarettes = [...state.stats.dailyCigarettes];
          dailyCigarettes[dailyCigarettes.length - 1] += 1;

          return {
            ...state,
            stats: {
              ...state.stats,
              cigarettesToday: state.stats.cigarettesToday + 1,
              lifetimeCigarettes: state.stats.lifetimeCigarettes + 1,
              fakeQuits: state.stats.fakeQuits + 1,
              monthlyCigarettes,
              dailyCigarettes,
            },
          };
        }),
      setRadarUsers: (users) =>
        set((state) => ({
          ...state,
          social: {
            ...state.social,
            radarUsers: users,
            lastScannedAt: users.length > 0 ? Date.now() : null,
          },
        })),
      clearRadarUsers: () =>
        set((state) => ({
          ...state,
          social: {
            ...state.social,
            radarUsers: [],
            lastScannedAt: null,
          },
        })),
      addMessage: (userId, sender, text, timestamp = Date.now()) =>
        set((state) => {
          const messages = state.social.conversations[userId] || [];

          return {
            ...state,
            social: {
              ...state.social,
              conversations: {
                ...state.social.conversations,
                [userId]: [
                  ...messages,
                  {
                    id: `${sender}-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
                    sender,
                    text,
                    timestamp,
                  },
                ],
              },
            },
          };
        }),
      failUnlockAttempt: () =>
        set((state) => ({
          ...state,
          damage: {
            ...state.damage,
            unlockedApps: false,
            unlockFailures: state.damage.unlockFailures + 1,
          },
        })),
      unlockApps: () =>
        set((state) => ({
          ...state,
          damage: {
            ...state.damage,
            unlockedApps: true,
            unlockSuccessAt: Date.now(),
          },
        })),
      relockApps: () =>
        set((state) => ({
          ...state,
          damage: {
            ...state.damage,
            unlockedApps: false,
          },
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        auth: state.auth,
        settings: state.settings,
        stats: state.stats,
        social: state.social,
        damage: state.damage,
      }),
    },
  ),
);

export { useAppStore, defaultState };
