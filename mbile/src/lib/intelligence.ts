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
  const currencySymbol = context.analytics?.currencySymbol ?? "Rs";
  const todayCount = context.dashboard?.stats.todayCount ?? 0;
  const dailyAverage = context.dashboard?.stats.dailySmokingAverage ?? context.analytics?.dailyAverage ?? 0;
  const todaySavings = context.dashboard?.savings.today ?? context.analytics?.todaySavings ?? 0;
  const weeklySavings = context.dashboard?.savings.weekly ?? context.analytics?.weeklySavings ?? 0;
  const totalSavings = context.dashboard?.savings.total ?? context.analytics?.totalSavings ?? 0;
  const avoidedToday = context.dashboard?.savings.avoidedToday ?? 0;
  const avoidedTotal = context.dashboard?.savings.avoidedTotal ?? context.analytics?.cigarettesAvoidedTotal ?? 0;
  const streak = context.analytics?.currentStreak ?? context.dashboard?.streak.current ?? 0;
  const progress = context.dashboard?.level.progressPercent ?? 0;
  const moneyBurned = context.dashboard?.stats.moneyBurned ?? 0;

  if (normalized.includes("motivate me") || normalized.includes("give me a reason not to smoke") || normalized.includes("encourage me")) {
    return streak > 0
      ? `You have saved ${currencySymbol}${totalSavings} so far. Your ${streak}-day streak is worth protecting.`
      : `You have saved ${currencySymbol}${totalSavings} so far. Every cigarette you skip today helps your next streak begin.`;
  }
  if (normalized.includes("how many cigarettes") && normalized.includes("today")) {
    const comparison = dailyAverage > 0 && todayCount <= dailyAverage
      ? "That is below your usual baseline."
      : dailyAverage > 0
        ? "That is above your usual baseline, but the data still moves you forward."
        : "Keep building one choice at a time.";
    return `You smoked ${todayCount} cigarettes today. ${comparison}`;
  }
  if (normalized.includes("how many cigarettes") && normalized.includes("week")) {
    const weeklyEstimate = Math.max(todayCount, Math.round((dailyAverage || todayCount) * 7));
    return `You smoked ${weeklyEstimate} cigarettes this week.`;
  }
  if (normalized.includes("left today")) {
    const baseline = Math.max(1, Math.round(dailyAverage || todayCount + 2));
    const remaining = Math.max(0, baseline - todayCount);
    return remaining > 0
      ? `You have ${remaining} cigarettes left against today's baseline of ${baseline}.`
      : "You are already at or below today's baseline. Nice work staying in control.";
  }
  if (normalized.includes("avoided") && normalized.includes("today")) {
    return `You avoided ${avoidedToday} cigarettes today.`;
  }
  if (normalized.includes("last cigarette")) {
    return `Your last cigarette is tracked in your latest smoke-free timer.`;
  }
  if (normalized.includes("saved") && normalized.includes("today")) {
    return `You saved ${currencySymbol}${todaySavings} today by avoiding ${avoidedToday} cigarettes.`;
  }
  if (normalized.includes("wasted") && normalized.includes("today")) {
    return `You spent ${currencySymbol}${moneyBurned} on cigarettes today.`;
  }
  if (normalized.includes("saved") && normalized.includes("week")) {
    return `You saved ${currencySymbol}${weeklySavings} this week.`;
  }
  if (normalized.includes("total money saved") || normalized.includes("money saved total")) {
    return `You have saved ${currencySymbol}${totalSavings} in total.`;
  }
  if (normalized.includes("streak")) {
    return streak > 0 ? `Your streak is ${streak} days strong.` : "You do not have an active streak yet, but today is a clean slate.";
  }
  if (normalized.includes("progress") || normalized.includes("insights")) {
    const safeProgress = progress > 0 ? progress : Math.min(100, Math.max(0, context.dashboard?.dailyStatus.score ?? 0));
    return `You are at ${safeProgress}% progress and have avoided ${avoidedTotal} cigarettes overall.`;
  }

  return `I did not understand that. Try asking about smoking stats, money saved, streaks, or motivation.`;
}
