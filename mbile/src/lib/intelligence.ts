import type { ScanRecord } from "@/lib/intelligence-store";

export interface DashboardPayload {
  user: { id: number; name: string; email: string; cigarettePrice: number; visibilityEnabled: boolean };
  dailyStatus: { regretLevel: number; stabilityLevel: number; focusLevel: string; focusScore: number; score: number; recoveryStage: string };
  smokeFree: { startedAt: string | null; seconds: number };
  streak: { current: number; highest: number };
  level: {
    current: number;
    name: string;
    rewardTitle: string;
    next: { level: number; name: string; requiredPoints: number } | null;
    progressPercent: number;
  };
  lungs: { percent: number; stage: string };
  savings: { today: number; weekly: number; total: number; avoidedToday: number; avoidedTotal: number };
  stats: {
    todayCount: number;
    quitsCount: number;
    totalCigarettes: number;
    moneyBurned: number;
    blockedBuys: number;
    focusLevel: string;
    dailySmokingAverage: number;
    cigarettePrice: number;
    longestSmokeFreeSeconds: number;
  };
  notifications: Array<{ type: string; title: string; description: string; level?: number }>;
}

export interface RoastAnalyticsPayload {
  annualSpend: number;
  dailyAverage: number;
  monthlyProjection: number;
  worstDay: { day: string; total: number } | null;
  peakSingleDay: number;
  highestDailySpend: number;
  blockedPurchases: number;
  monthlyCigarettes: number[];
  cigarettePrice: number;
  currencySymbol: string;
  todaySavings: number;
  weeklySavings: number;
  totalSavings: number;
  currentStreak: number;
  lungsRecoveryPercent: number;
  recoveryStage: string;
  cigarettesAvoidedTotal: number;
}

export interface ActivityRow {
  id: number;
  title: string;
  description: string;
  created_at: string;
}

export function buildHourlyCravingData(dashboard?: DashboardPayload, analytics?: RoastAnalyticsPayload) {
  const todayCount = dashboard?.stats.todayCount ?? 0;
  const average = dashboard?.stats.dailySmokingAverage ?? analytics?.dailyAverage ?? 0;
  const ratio = average > 0 ? todayCount / average : 0.5;
  const lateBias = Math.min(1, (dashboard?.dailyStatus.regretLevel ?? 45) / 100);
  const stabilityDrop = 1 - ((dashboard?.dailyStatus.stabilityLevel ?? 60) / 100);

  return Array.from({ length: 24 }, (_, hour) => {
    const eveningBoost = hour >= 21 ? 24 : hour >= 18 ? 14 : hour >= 13 ? 10 : 4;
    const mealBoost = [9, 14, 21].includes(hour) ? 10 : 0;
    const stressBoost = Math.round(stabilityDrop * 24);
    const baseline = 18 + Math.round(ratio * 20) + eveningBoost + mealBoost + stressBoost;
    const value = Math.max(8, Math.min(98, baseline + Math.round((Math.sin(hour / 3) + lateBias) * 8)));

    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      intensity: value,
    };
  });
}

export function buildWeeklyReplay(analytics?: RoastAnalyticsPayload) {
  const peak = analytics?.peakSingleDay ?? 0;
  const average = analytics?.dailyAverage ?? 0;
  const scale = Math.max(peak, average, 1);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return days.map((day, index) => {
    const weekendBoost = index >= 4 ? 1.2 : 0.95;
    const value = Math.max(0, Math.round(scale * weekendBoost * (0.72 + index * 0.05)));
    return { day, value };
  });
}

export function buildHeatmap(analytics?: RoastAnalyticsPayload) {
  const monthly = analytics?.monthlyCigarettes ?? Array.from({ length: 12 }, () => 0);
  const peak = Math.max(...monthly, 1);

  return Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 7 }, (_, column) => {
      const monthIndex = (row * 7 + column) % monthly.length;
      const intensity = Math.round((monthly[monthIndex] / peak) * 100);
      return {
        key: `${row}-${column}`,
        intensity,
      };
    }),
  );
}

export function resolveSmokingProfile(dashboard?: DashboardPayload, analytics?: RoastAnalyticsPayload) {
  const today = dashboard?.stats.todayCount ?? 0;
  const average = dashboard?.stats.dailySmokingAverage ?? analytics?.dailyAverage ?? 0;
  const streak = analytics?.currentStreak ?? dashboard?.streak.current ?? 0;
  const regret = dashboard?.dailyStatus.regretLevel ?? 0;

  if (today >= average + 4 || average >= 14) {
    return "Heavy User";
  }
  if (regret >= 60) {
    return "Stress Smoker";
  }
  if (streak === 0 && average > 0 && average <= 7) {
    return "Routine Smoker";
  }
  if ((analytics?.peakSingleDay ?? 0) >= 10) {
    return "Night Smoker";
  }

  return "Social Smoker";
}

export function buildScannerInsight(code: string, cigarettePrice: number): Omit<ScanRecord, "id" | "scannedAt"> {
  const normalized = code.trim();
  const digits = normalized.replace(/\D/g, "");
  const checksum = digits.split("").reduce((sum, value) => sum + Number(value), 0);
  const nicotineMg = digits ? Number((0.8 + (checksum % 9) * 0.1).toFixed(1)) : null;
  const tarMg = digits ? 8 + (checksum % 7) * 2 : null;
  const priceEstimate = cigarettePrice ? Math.round(cigarettePrice * 20) : null;
  const brands = ["Gold Flake", "Marlboro", "Classic", "Kings", "Navy Cut"];
  const brand = digits ? brands[checksum % brands.length] : null;
  const damageScore = Math.max(42, Math.min(97, 48 + (tarMg ?? 0) * 2 + (nicotineMg ?? 0) * 6));

  return {
    code: normalized,
    format: digits.length >= 12 ? "EAN / UPC" : "QR / Text",
    source: "Live camera scan",
    brand,
    priceEstimate,
    nicotineMg,
    tarMg,
    damageScore,
    chemicals: ["Nicotine", "Tar", "Carbon Monoxide", "Benzene"],
  };
}

export function buildVoiceReply(command: string, context: {
  dashboard?: DashboardPayload;
  analytics?: RoastAnalyticsPayload;
  profileLabel: string;
}) {
  const normalized = command.toLowerCase();

  if (normalized.includes("track") && normalized.includes("cigarette")) {
    return "Logging one cigarette now. Keep the data honest so the recovery model stays sharp.";
  }
  if (normalized.includes("nearby") || normalized.includes("store")) {
    return "Opening Nearby Stores so you can check options around your live location.";
  }
  if (normalized.includes("spent") && normalized.includes("today")) {
    return `You have burned ${context.analytics?.currencySymbol ?? "Rs"}${context.dashboard?.stats.moneyBurned ?? 0} today.`;
  }
  if (normalized.includes("dna")) {
    return `Your Smoke DNA currently reads as ${context.profileLabel}.`;
  }
  if (normalized.includes("predict") || normalized.includes("craving")) {
    return "Opening Craving AI. Your next craving window is being recalculated now.";
  }

  return "Nova understood the request, but that command is still outside the current voice toolkit.";
}
