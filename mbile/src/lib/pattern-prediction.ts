import type { CravingPredictionRecord } from "@/lib/cravingApi";
import type { DashboardPayload, RoastAnalyticsPayload, ActivityRow } from "@/lib/intelligence";
import type { SmokeDnaRecord } from "@/lib/intelligenceApi";
import type { SmokeReplayRecord } from "@/lib/replayApi";

export interface PatternCard {
  title: string;
  value: string;
  detail: string;
  confidence: "Live" | "Limited" | "Strong";
}

export interface ForecastCard {
  title: string;
  value: string;
  detail: string;
  available: boolean;
}

export interface PatternPredictionEngine {
  behaviorProfile: string;
  dataDays: number;
  hasPredictionData: boolean;
  insufficientMessage: string;
  patternCards: PatternCard[];
  forecastCards: ForecastCard[];
  aiInsights: string[];
  hourlyRisk: Array<{ hour: number; label: string; intensity: number }>;
  trendSeries: Array<{ label: string; cigarettes: number; projected?: number }>;
  scores: {
    relapseRisk: number;
    quitSuccess: number;
    improvementPercent: number;
    triggerLoad: number;
  };
  explanation: string;
}

interface EngineInput {
  dashboard?: DashboardPayload;
  analytics?: RoastAnalyticsPayload;
  smokeDna?: SmokeDnaRecord;
  monthlyReplay?: SmokeReplayRecord;
  yearlyReplay?: SmokeReplayRecord;
  replayHistory: SmokeReplayRecord[];
  cravingHistory: CravingPredictionRecord[];
  liveCraving?: CravingPredictionRecord;
  activity: ActivityRow[];
  hourlyCraving: Array<{ hour: number; label: string; intensity: number }>;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(date);
}

function weightedMovingAverage(values: number[]) {
  if (!values.length) return 0;
  const weights = values.map((_, index) => index + 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
}

function linearRegressionSlope(values: number[]) {
  if (values.length < 2) return 0;
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / n;
  const numerator = values.reduce((sum, y, x) => sum + (x - meanX) * (y - meanY), 0);
  const denominator = values.reduce((sum, _, x) => sum + (x - meanX) ** 2, 0);
  return denominator ? numerator / denominator : 0;
}

function parseActivityCount(activity: ActivityRow) {
  const text = `${activity.title} ${activity.description}`.toLowerCase();
  if (!/(smok|cigarette|craving|puff|quit|avoided)/.test(text)) return 0;
  const numberMatch = text.match(/\b(\d{1,3})\b/);
  if (numberMatch && /(smok|cigarette|puff)/.test(text)) return Number(numberMatch[1]);
  if (/(smok|cigarette|puff)/.test(text)) return 1;
  return 0;
}

function calendarDailyCounts(input: EngineInput) {
  const fromMonthly = input.monthlyReplay?.analytics.calendarHeatmap
    ?.map((entry, index) => ({
      date: new Date(entry.day || Date.now() - (input.monthlyReplay!.analytics.calendarHeatmap.length - index) * 86_400_000),
      count: Math.max(0, Number(entry.total) || 0),
    }))
    .filter((entry) => Number.isFinite(entry.date.getTime())) ?? [];

  if (fromMonthly.length) return fromMonthly;

  const fromActivity = input.activity
    .map((item) => ({ date: new Date(item.created_at), count: parseActivityCount(item) }))
    .filter((entry) => Number.isFinite(entry.date.getTime()) && entry.count > 0);

  if (fromActivity.length) return fromActivity;

  const today = input.dashboard?.stats.todayCount ?? 0;
  return today > 0 ? [{ date: new Date(), count: today }] : [];
}

function getTriggerStats(input: EngineInput) {
  const scores = new Map<string, number>();
  input.smokeDna?.triggerPatterns.forEach((item) => {
    scores.set(item.trigger, (scores.get(item.trigger) ?? 0) + item.score);
  });
  input.cravingHistory.forEach((item) => {
    const trigger = item.triggerPrediction?.primary;
    if (trigger) scores.set(trigger, (scores.get(trigger) ?? 0) + item.cravingProbability);
  });
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, score]) => sum + score, 0);
  const top = sorted[0] ?? ["No trigger logged", 0];
  return {
    top: top[0],
    topShare: total > 0 ? Math.round((top[1] / total) * 100) : 0,
    total,
  };
}

function classifyProfile(input: EngineInput, peakHour: number, improvementPercent: number, triggerTop: string) {
  const avg = input.dashboard?.stats.dailySmokingAverage ?? input.analytics?.dailyAverage ?? 0;
  const stress = input.smokeDna?.moodCorrelation.stressed ?? input.dashboard?.dailyStatus.regretLevel ?? 0;
  const social = input.smokeDna?.moodCorrelation.social ?? 0;
  if (improvementPercent >= 12) return "Improving Quitter";
  if (peakHour >= 20 || peakHour <= 2) return "Night Smoker";
  if (/stress|anxiety|pressure|work/i.test(triggerTop) || stress >= 55) return "Stress Smoker";
  if (/social|friend|party|drink/i.test(triggerTop) || social >= 45) return "Social Smoker";
  if (avg > 0) return "Habit Smoker";
  return "Building Baseline";
}

function buildHealthMilestone(smokeFreeSeconds: number) {
  const hours = smokeFreeSeconds / 3600;
  if (hours >= 24 * 14) return "Two-week recovery window: circulation and breathing comfort should keep improving.";
  if (hours >= 72) return "72-hour milestone reached: bronchial recovery is underway.";
  if (hours >= 24) return "24-hour milestone reached: carbon monoxide levels have had time to fall.";
  if (hours >= 12) return "12-hour milestone reached: oxygen balance is moving in the right direction.";
  return "Next health milestone: reach 12 smoke-free hours.";
}

export function buildPatternPredictionEngine(input: EngineInput): PatternPredictionEngine {
  const dailyCounts = calendarDailyCounts(input).sort((a, b) => a.date.getTime() - b.date.getTime());
  const values = dailyCounts.map((entry) => entry.count);
  const dataDays = dailyCounts.length;
  const hasPredictionData = dataDays >= 7;
  const recent7 = values.slice(-7);
  const previous7 = values.slice(-14, -7);
  const recentAverage = recent7.length ? recent7.reduce((sum, value) => sum + value, 0) / recent7.length : (input.analytics?.dailyAverage ?? 0);
  const previousAverage = previous7.length ? previous7.reduce((sum, value) => sum + value, 0) / previous7.length : recentAverage;
  const improvementPercent = previousAverage > 0 ? Math.round(((previousAverage - recentAverage) / previousAverage) * 100) : 0;
  const slope = linearRegressionSlope(values.slice(-30));
  const tomorrow = Math.max(0, weightedMovingAverage(recent7.length ? recent7 : values) + slope);
  const forecast7 = Array.from({ length: 7 }, (_, index) => Math.max(0, tomorrow + slope * index));
  const forecast30 = Array.from({ length: 30 }, (_, index) => Math.max(0, tomorrow + slope * index));
  const price = input.dashboard?.stats.cigarettePrice ?? input.analytics?.cigarettePrice ?? 0;
  const baseline = Math.max(input.analytics?.dailyAverage ?? 0, input.dashboard?.stats.dailySmokingAverage ?? 0, recentAverage);
  const projectedSavings = Math.max(0, Math.round((baseline * 30 - forecast30.reduce((sum, value) => sum + value, 0)) * price));
  const hourlyRisk = input.hourlyCraving.length ? input.hourlyCraving : Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${hour}:00`, intensity: 0 }));
  const peak = hourlyRisk.reduce((best, item) => (item.intensity > best.intensity ? item : best), hourlyRisk[0] ?? { hour: 0, label: "00:00", intensity: 0 });
  const triggerStats = getTriggerStats(input);
  const smokeFreeSeconds = input.dashboard?.smokeFree.seconds ?? 0;
  const longestSeconds = Math.max(smokeFreeSeconds, input.dashboard?.stats.longestSmokeFreeSeconds ?? 0);
  const weekendAverage = dailyCounts.filter((entry) => [0, 6].includes(entry.date.getDay())).reduce((sum, entry) => sum + entry.count, 0) /
    Math.max(1, dailyCounts.filter((entry) => [0, 6].includes(entry.date.getDay())).length);
  const weekdayAverage = dailyCounts.filter((entry) => ![0, 6].includes(entry.date.getDay())).reduce((sum, entry) => sum + entry.count, 0) /
    Math.max(1, dailyCounts.filter((entry) => ![0, 6].includes(entry.date.getDay())).length);
  const strongestDay = dailyCounts.reduce<Record<number, { total: number; days: number }>>((map, entry) => {
    const day = entry.date.getDay();
    map[day] = map[day] ?? { total: 0, days: 0 };
    map[day].total += entry.count;
    map[day].days += 1;
    return map;
  }, {});
  const bestDay = Object.entries(strongestDay).sort((a, b) => (a[1].total / a[1].days) - (b[1].total / b[1].days))[0]?.[0];
  const triggerLoad = clamp(triggerStats.topShare || input.liveCraving?.intensityScore || 0);
  const relapseRisk = clamp(
    (input.liveCraving?.cravingProbability ?? peak.intensity) * 0.36 +
      Math.max(0, slope * 8) * 0.18 +
      Math.max(0, (input.dashboard?.stats.todayCount ?? 0) - baseline) * 5 +
      Math.max(0, 45 - (input.dashboard?.streak.current ?? 0) * 3) +
      triggerLoad * 0.18,
  );
  const quitSuccess = clamp(100 - relapseRisk + Math.max(0, improvementPercent) * 0.45 + Math.min(20, (input.dashboard?.streak.current ?? 0) * 2));
  const profile = classifyProfile(input, peak.hour, improvementPercent, triggerStats.top);
  const averageSmokeFreeHours = baseline > 0 ? 24 / baseline : smokeFreeSeconds / 3600;
  const timelineDays = slope < -0.05 && tomorrow > 1 ? Math.ceil((tomorrow - 1) / Math.abs(slope)) : null;

  const patternCards: PatternCard[] = [
    {
      title: "Peak Risk Time",
      value: `${formatHour(peak.hour)} - ${formatHour((peak.hour + 2) % 24)}`,
      detail: `${Math.round(peak.intensity)}% risk from logged craving and usage signals.`,
      confidence: input.liveCraving || input.cravingHistory.length ? "Live" : "Limited",
    },
    {
      title: "Weekend Smoking Increase",
      value: `${Math.max(0, Math.round(((weekendAverage - weekdayAverage) / Math.max(weekdayAverage, 1)) * 100))}%`,
      detail: weekendAverage > weekdayAverage ? "Weekend logs are higher than weekday logs." : "Weekends are not currently higher than weekdays.",
      confidence: dataDays >= 14 ? "Strong" : "Limited",
    },
    {
      title: "Longest Smoke-Free Window",
      value: `${Math.floor(longestSeconds / 3600)}h`,
      detail: `Average smoke-free gap is about ${averageSmokeFreeHours.toFixed(1)}h from your baseline.`,
      confidence: longestSeconds > 0 ? "Live" : "Limited",
    },
    {
      title: "Most Common Trigger",
      value: triggerStats.top,
      detail: triggerStats.topShare ? `${triggerStats.topShare}% of trigger weight points here.` : "Trigger history is still building.",
      confidence: triggerStats.total > 0 ? "Live" : "Limited",
    },
    {
      title: "Improvement Trend",
      value: `${improvementPercent >= 0 ? "-" : "+"}${Math.abs(improvementPercent)}%`,
      detail: "Compares the last 7 logged days against the previous 7.",
      confidence: dataDays >= 14 ? "Strong" : "Limited",
    },
  ];

  const forecastCards: ForecastCard[] = [
    {
      title: "Tomorrow",
      value: hasPredictionData ? `${tomorrow.toFixed(1)} cigarettes` : "Needs data",
      detail: hasPredictionData ? "Weighted moving average plus trend slope." : "Need at least 7 days of data for accurate predictions.",
      available: hasPredictionData,
    },
    {
      title: "7-Day Forecast",
      value: hasPredictionData ? `${Math.round(forecast7.reduce((sum, value) => sum + value, 0))} cigarettes` : "Needs data",
      detail: hasPredictionData ? "Linear trend projected across the next week." : "Need at least 7 days of data for accurate predictions.",
      available: hasPredictionData,
    },
    {
      title: "30-Day Forecast",
      value: hasPredictionData ? `${Math.round(forecast30.reduce((sum, value) => sum + value, 0))} cigarettes` : "Needs data",
      detail: hasPredictionData ? "Regression-based month projection from recent history." : "Need at least 7 days of data for accurate predictions.",
      available: hasPredictionData,
    },
    {
      title: "Relapse Risk",
      value: hasPredictionData ? `${Math.round(relapseRisk)}%` : "Needs data",
      detail: "Uses craving risk, trigger load, streak, today count, and trend direction.",
      available: hasPredictionData,
    },
    {
      title: "Quit Success",
      value: hasPredictionData ? `${Math.round(quitSuccess)}%` : "Needs data",
      detail: "Higher when trend drops, streak grows, and trigger load falls.",
      available: hasPredictionData,
    },
    {
      title: "30-Day Savings",
      value: hasPredictionData ? `${input.analytics?.currencySymbol ?? "Rs"}${projectedSavings}` : "Needs data",
      detail: "Projected against your current smoking baseline and cigarette price.",
      available: hasPredictionData,
    },
    {
      title: "Health Milestone",
      value: input.dashboard?.dailyStatus.recoveryStage ?? input.analytics?.recoveryStage ?? "Recovery",
      detail: buildHealthMilestone(smokeFreeSeconds),
      available: smokeFreeSeconds > 0,
    },
    {
      title: "Goal Timeline",
      value: hasPredictionData && timelineDays ? `${timelineDays} days` : "Not predictable yet",
      detail: timelineDays ? "Estimated time to reach one or fewer cigarettes per day." : "A downward trend is needed before estimating the goal timeline.",
      available: Boolean(hasPredictionData && timelineDays),
    },
  ];

  const aiInsights = [
    improvementPercent > 0
      ? `Your smoking has decreased by ${improvementPercent}% over the most recent comparison window.`
      : improvementPercent < 0
        ? `Your smoking has increased by ${Math.abs(improvementPercent)}% over the most recent comparison window.`
        : "Your recent smoking trend is currently flat.",
    `Most smoking risk occurs between ${formatHour(peak.hour)} and ${formatHour((peak.hour + 2) % 24)}.`,
    bestDay ? `You are strongest on ${dayNames[Number(bestDay)]}.` : "Your strongest day will appear after more dated logs.",
    triggerStats.topShare ? `${triggerStats.top} accounts for ${triggerStats.topShare}% of logged trigger weight.` : "Trigger scoring needs more craving or Smoke DNA records.",
  ];

  return {
    behaviorProfile: profile,
    dataDays,
    hasPredictionData,
    insufficientMessage: "Need at least 7 days of data for accurate predictions.",
    patternCards,
    forecastCards,
    aiInsights,
    hourlyRisk,
    trendSeries: dailyCounts.slice(-14).map((entry) => ({
      label: shortDays[entry.date.getDay()],
      cigarettes: entry.count,
    })).concat(hasPredictionData ? forecast7.slice(0, 3).map((value, index) => ({
      label: `P${index + 1}`,
      cigarettes: 0,
      projected: Number(value.toFixed(1)),
    })) : []),
    scores: {
      relapseRisk: Math.round(relapseRisk),
      quitSuccess: Math.round(quitSuccess),
      improvementPercent,
      triggerLoad: Math.round(triggerLoad),
    },
    explanation: "Calculated from dashboard stats, smoke replay history, craving predictions, Smoke DNA triggers, and recent activity logs.",
  };
}
