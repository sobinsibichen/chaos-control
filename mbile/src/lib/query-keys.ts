type UserScope = string | number | null | undefined;

function userScope(userId: UserScope) {
  return ["user", String(userId ?? "anonymous")] as const;
}

export const queryKeys = {
  dashboard: (userId: UserScope) => ["dashboard", ...userScope(userId)] as const,
  activity: (userId: UserScope) => ["activity", ...userScope(userId)] as const,
  profile: (userId: UserScope) => ["profile", ...userScope(userId)] as const,
  achievements: (userId: UserScope) => ["achievements", ...userScope(userId)] as const,
  analytics: (userId: UserScope) => ["analytics", ...userScope(userId)] as const,
  highlights: (userId: UserScope) => ["highlights", ...userScope(userId)] as const,
  apps: (userId: UserScope) => ["apps", ...userScope(userId)] as const,
  nearby: (userId: UserScope) => ["nearby", ...userScope(userId)] as const,
  smokeDna: (userId: UserScope) => ["intelligence", "smoke-dna", ...userScope(userId)] as const,
  smokeReplayHistory: (userId: UserScope) => ["intelligence", "smoke-replay", "history", ...userScope(userId)] as const,
  smokeReplayMonthly: (userId: UserScope, year: number, month: number) => ["intelligence", "smoke-replay", "monthly", year, month, ...userScope(userId)] as const,
  smokeReplayYearly: (userId: UserScope, year: number) => ["intelligence", "smoke-replay", "yearly", year, ...userScope(userId)] as const,
  cravingHistory: (userId: UserScope) => ["intelligence", "craving-history", ...userScope(userId)] as const,
  cravingLive: (userId: UserScope) => ["intelligence", "craving-live", ...userScope(userId)] as const,
  scannerHistory: (userId: UserScope) => ["control", "scanner-history", ...userScope(userId)] as const,
  ritualSessions: (userId: UserScope) => ["control", "ritual-sessions", ...userScope(userId)] as const,
  emergencySessions: (userId: UserScope) => ["control", "emergency-sessions", ...userScope(userId)] as const,
  favoriteStores: (userId: UserScope) => ["nearby", "favorite-stores", ...userScope(userId)] as const,
};
