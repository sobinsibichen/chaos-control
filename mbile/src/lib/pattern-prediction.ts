import type { CigaretteLogRecord } from "@/lib/cigaretteHistoryApi";
import type { CravingPredictionRecord } from "@/lib/cravingApi";
import type { DashboardPayload, RoastAnalyticsPayload, ActivityRow } from "@/lib/intelligence";
import type { SmokeDnaRecord } from "@/lib/intelligenceApi";
import type { SmokeReplayRecord } from "@/lib/replayApi";

export interface PatternCard {
  title: string;
  value: string;
  detail: string;
  confidence: "Low" | "Medium" | "High";
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
  cigaretteHistory: CigaretteLogRecord[];
}

const NOT_ENOUGH = "Not enough data yet";
const LIMITED = "Limited prediction accuracy";
const MS_PER_DAY = 86_400_000;
const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function clamp(value: number, min = 0, max = 100) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(date);
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function confidenceFor(historyDays: number): PatternCard["confidence"] {
  if (historyDays > 30) return "High";
  if (historyDays >= 7) return "Medium";
  return "Low";
}

function normalizeLogs(logs: CigaretteLogRecord[]) {
  return logs
    .map((log) => ({
      ...log,
      cigarettesCount: Math.max(0, Number(log.cigarettesCount) || 0),
      pricePerUnit: Math.max(0, Number(log.pricePerUnit) || 0),
      date: new Date(log.loggedAt),
    }))
    .filter((log) => log.cigarettesCount > 0 && Number.isFinite(log.date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

function dailySeries(logs: ReturnType<typeof normalizeLogs>, today: Date) {
  if (!logs.length) return [];
  const first = startOfDay(logs[0].date);
  const last = startOfDay(today);
  const totals = new Map<string, number>();
  logs.forEach((log) => {
    const key = dateKey(log.date);
    totals.set(key, (totals.get(key) ?? 0) + log.cigarettesCount);
  });

  const days = Math.floor((last.getTime() - first.getTime()) / MS_PER_DAY);
  return Array.from({ length: days + 1 }, (_, index) => {
    const date = new Date(first.getTime() + index * MS_PER_DAY);
    return { date, count: totals.get(dateKey(date)) ?? 0 };
  });
}

function averageIntervalMinutes(logs: ReturnType<typeof normalizeLogs>) {
  if (logs.length < 2) return null;
  const intervals = logs.slice(1).map((log, index) => (log.date.getTime() - logs[index].date.getTime()) / 60_000).filter((minutes) => minutes > 0);
  // Formula: average of time differences between consecutive real cigarette log timestamps.
  return intervals.length ? average(intervals) : null;
}

function streakStats(series: Array<{ date: Date; count: number }>) {
  if (!series.length) return { current: 0, best: 0, average: 0, average30: 0 };
  const streaks: number[] = [];
  let running = 0;
  series.forEach((day) => {
    if (day.count === 0) {
      running += 1;
      return;
    }
    if (running > 0) streaks.push(running);
    running = 0;
  });
  if (running > 0) streaks.push(running);

  const current = series[series.length - 1]?.count === 0 ? running : 0;
  const recent30 = series.slice(-30);
  const recentStats = streakStatsWithoutRecursion(recent30);
  return {
    current,
    best: Math.max(0, ...streaks),
    average: Math.round(average(streaks)),
    average30: Math.round(recentStats.average),
  };
}

function streakStatsWithoutRecursion(series: Array<{ count: number }>) {
  const streaks: number[] = [];
  let running = 0;
  series.forEach((day) => {
    if (day.count === 0) {
      running += 1;
    } else {
      if (running > 0) streaks.push(running);
      running = 0;
    }
  });
  if (running > 0) streaks.push(running);
  return { average: average(streaks) };
}

function periodAverage(series: Array<{ count: number }>, size: number, offset = 0) {
  const end = series.length - offset;
  const start = Math.max(0, end - size);
  return average(series.slice(start, end).map((day) => day.count));
}

function trendLabel(current: number, previous: number) {
  if (previous === 0 && current === 0) return "Stable";
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 100;
  if (change <= -10) return "Improving";
  if (change >= 10) return "Increasing";
  return "Stable";
}

function hourlyRiskFromLogs(logs: ReturnType<typeof normalizeLogs>) {
  const totals = Array.from({ length: 24 }, () => 0);
  logs.forEach((log) => {
    totals[log.date.getHours()] += log.cigarettesCount;
  });
  const peak = Math.max(1, ...totals);
  return totals.map((total, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    // Formula: hour intensity is that hour's historical count divided by the user's peak hourly count.
    intensity: Math.round((total / peak) * 100),
  }));
}

function mostAndLeastHourly(logs: ReturnType<typeof normalizeLogs>) {
  const totals = Array.from({ length: 24 }, () => 0);
  logs.forEach((log) => {
    totals[log.date.getHours()] += log.cigarettesCount;
  });
  const active = totals.map((count, hour) => ({ hour, count })).filter((item) => item.count > 0);
  return {
    most: active.sort((a, b) => b.count - a.count)[0] ?? null,
    least: active.sort((a, b) => a.count - b.count)[0] ?? null,
  };
}

function dayAverages(series: Array<{ date: Date; count: number }>) {
  const byDay = new Map<number, number[]>();
  series.forEach((entry) => {
    const day = entry.date.getDay();
    byDay.set(day, [...(byDay.get(day) ?? []), entry.count]);
  });
  const rows = [...byDay.entries()].map(([day, values]) => ({ day, average: average(values) }));
  return {
    most: rows.sort((a, b) => b.average - a.average)[0] ?? null,
    least: rows.sort((a, b) => a.average - b.average)[0] ?? null,
  };
}

function sameWeekdayRange(series: Array<{ date: Date; count: number }>, today: Date) {
  const todayKey = dateKey(today);
  const weekday = today.getDay();
  const matches = series.filter((entry) => entry.date.getDay() === weekday && dateKey(entry.date) !== todayKey).map((entry) => entry.count);
  if (matches.length < 3) return null;
  return { min: Math.min(...matches), max: Math.max(...matches), avg: average(matches), samples: matches.length };
}

function riskLevel(score: number) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function buildRiskScore(input: {
  logs: ReturnType<typeof normalizeLogs>;
  series: Array<{ date: Date; count: number }>;
  hourlyRisk: Array<{ hour: number; intensity: number }>;
  averageInterval: number | null;
  now: Date;
  currentStreak: number;
}) {
  if (input.logs.length < 3) return 0;
  const currentHourRisk = input.hourlyRisk[input.now.getHours()]?.intensity ?? 0;
  const sameWeekday = input.series.filter((entry) => entry.date.getDay() === input.now.getDay()).map((entry) => entry.count);
  const weekdayWeight = clamp((average(sameWeekday) / Math.max(1, Math.max(...input.series.map((entry) => entry.count)))) * 100);
  const lastLog = input.logs[input.logs.length - 1];
  const minutesSinceLast = (input.now.getTime() - lastLog.date.getTime()) / 60_000;
  const intervalWeight = input.averageInterval ? clamp(100 - Math.abs(minutesSinceLast - input.averageInterval) / input.averageInterval * 100) : 0;
  const streakProtection = clamp(input.currentStreak * 8, 0, 35);
  // Formula: risk is a weighted blend of current-hour history, weekday history, closeness to average interval, minus streak protection.
  return clamp(currentHourRisk * 0.4 + weekdayWeight * 0.25 + intervalWeight * 0.25 + 10 - streakProtection);
}

function moodTrigger(logs: ReturnType<typeof normalizeLogs>) {
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    const mood = log.mood.trim();
    if (!mood || mood.toLowerCase() === "tracked") return;
    counts.set(mood, (counts.get(mood) ?? 0) + log.cigarettesCount);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
}

export function buildPatternPredictionEngine(input: EngineInput): PatternPredictionEngine {
  const logs = normalizeLogs(input.cigaretteHistory);
  const now = new Date();
  const series = dailySeries(logs, now);
  const values = series.map((entry) => entry.count);
  const historyDays = series.length;
  const confidence = confidenceFor(historyDays);
  const hasMinimumLogs = logs.length >= 3;
  const hasPredictionData = hasMinimumLogs && historyDays >= 1;
  const totalCigarettes = logs.reduce((sum, log) => sum + log.cigarettesCount, 0);
  const price = average(logs.map((log) => log.pricePerUnit).filter((value) => value > 0)) || input.dashboard?.stats.cigarettePrice || input.analytics?.cigarettePrice || 0;
  const avgInterval = averageIntervalMinutes(logs);
  const streak = streakStats(series);
  const hourlyRisk = hourlyRiskFromLogs(logs);
  const hourly = mostAndLeastHourly(logs);
  const days = dayAverages(series);
  const recent7 = periodAverage(series, 7);
  const previous7 = periodAverage(series, 7, 7);
  const recent14 = periodAverage(series, 14);
  const recent30 = periodAverage(series, 30);
  const trend = trendLabel(recent7, previous7);
  const improvementPercent = previous7 > 0 ? Math.round(((previous7 - recent7) / previous7) * 100) : 0;
  const sameWeekday = sameWeekdayRange(series, now);
  const riskScore = buildRiskScore({ logs, series, hourlyRisk, averageInterval: avgInterval, now, currentStreak: streak.current });
  const monthRows = series.filter((entry) => entry.date.getFullYear() === now.getFullYear() && entry.date.getMonth() === now.getMonth());
  const elapsedMonthDays = Math.max(1, now.getDate());
  const currentMonthAverage = monthRows.reduce((sum, entry) => sum + entry.count, 0) / elapsedMonthDays;
  const remainingDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  // Formula: monthly forecast is current-month daily average multiplied by remaining calendar days, with one standard-error style range.
  const monthlyRemaining = currentMonthAverage * remainingDays;
  const monthlySpread = Math.max(1, Math.round(monthlyRemaining * 0.15));
  const cravingWindow = avgInterval && logs.length ? {
    start: addMinutes(logs[logs.length - 1].date, Math.max(0, avgInterval - 15)),
    end: addMinutes(logs[logs.length - 1].date, avgInterval + 15),
  } : null;
  const trigger = moodTrigger(logs);

  const patternCards: PatternCard[] = [
    {
      title: "Peak Risk Time",
      value: hasMinimumLogs && hourly.most ? `${formatHour(hourly.most.hour)} - ${formatHour((hourly.most.hour + 1) % 24)}` : NOT_ENOUGH,
      detail: hasMinimumLogs && hourly.most
        ? `Most active hour: ${hourly.most.count} cigarettes. Least active logged hour: ${hourly.least ? formatHour(hourly.least.hour) : NOT_ENOUGH}.`
        : "At least 3 smoking logs are required.",
      confidence,
    },
    {
      title: "Weekend Smoking Increase",
      value: hasMinimumLogs && days.most ? `${dayNames[days.most.day]}` : NOT_ENOUGH,
      detail: hasMinimumLogs && days.most
        ? `Most active day is ${dayNames[days.most.day]} (${days.most.average.toFixed(1)}/day); least active is ${days.least ? dayNames[days.least.day] : NOT_ENOUGH}.`
        : "At least 3 smoking logs are required.",
      confidence,
    },
    {
      title: "Longest Smoke-Free Window",
      value: hasMinimumLogs ? `${streak.best} days` : NOT_ENOUGH,
      detail: hasMinimumLogs
        ? `Current streak: ${streak.current} days. Average streak: ${streak.average} days. Last 30-day average: ${streak.average30} days.`
        : "At least 3 smoking logs are required.",
      confidence,
    },
    {
      title: "Most Common Trigger",
      value: hasMinimumLogs && trigger ? trigger[0] : NOT_ENOUGH,
      detail: hasMinimumLogs && trigger
        ? `${trigger[1]} cigarettes were logged with this mood/trigger.`
        : "Mood or trigger labels in smoking logs are required.",
      confidence,
    },
    {
      title: "Improvement Trend",
      value: historyDays >= 14 ? trend : NOT_ENOUGH,
      detail: historyDays >= 14
        ? `7-day avg ${recent7.toFixed(1)}, 14-day avg ${recent14.toFixed(1)}, 30-day avg ${recent30.toFixed(1)}.`
        : "Fourteen days of smoking history are needed for trend comparison.",
      confidence,
    },
  ];

  const forecastCards: ForecastCard[] = [
    {
      title: "Tomorrow",
      value: hasMinimumLogs && sameWeekday ? `${Math.round(sameWeekday.min)}-${Math.round(sameWeekday.max)} cigarettes` : NOT_ENOUGH,
      detail: hasMinimumLogs && sameWeekday
        ? `${dayNames[now.getDay()]} forecast range from ${sameWeekday.samples} previous ${dayNames[now.getDay()]} records. Confidence: ${confidence}.`
        : "Need at least 3 prior records for this weekday.",
      available: Boolean(hasMinimumLogs && sameWeekday),
    },
    {
      title: "7-Day Forecast",
      value: hasMinimumLogs && cravingWindow ? `${formatClock(cravingWindow.start)} - ${formatClock(cravingWindow.end)}` : NOT_ENOUGH,
      detail: hasMinimumLogs && cravingWindow && avgInterval
        ? `Likely craving window from average interval (${Math.round(avgInterval)} minutes). Confidence: ${confidence}.`
        : "At least 2 timestamped smoking logs are required.",
      available: Boolean(hasMinimumLogs && cravingWindow),
    },
    {
      title: "30-Day Forecast",
      value: hasMinimumLogs ? `${Math.round(monthlyRemaining)} +/- ${monthlySpread}` : NOT_ENOUGH,
      detail: hasMinimumLogs
        ? `Current month average ${currentMonthAverage.toFixed(1)}/day x ${remainingDays} remaining days. Confidence: ${confidence}.`
        : "At least 3 smoking logs are required.",
      available: hasMinimumLogs,
    },
    {
      title: "Relapse Risk",
      value: hasMinimumLogs ? `${riskLevel(riskScore)} Risk` : NOT_ENOUGH,
      detail: hasMinimumLogs
        ? `Derived from current hour, weekday behavior, time since last cigarette, and current streak. Confidence: ${confidence}.`
        : "At least 3 smoking logs are required.",
      available: hasMinimumLogs,
    },
    {
      title: "Quit Success",
      value: historyDays >= 14 ? trend : NOT_ENOUGH,
      detail: historyDays >= 14
        ? `Mathematical trend only: current 7-day period is ${trend.toLowerCase()} versus the previous 7 days.`
        : "Fourteen days of smoking history are needed for trend confidence.",
      available: historyDays >= 14,
    },
    {
      title: "30-Day Savings",
      value: hasMinimumLogs && price > 0 ? `${input.analytics?.currencySymbol ?? "Rs"}${Math.round(monthlyRemaining * price)} +/- ${input.analytics?.currencySymbol ?? "Rs"}${Math.round(monthlySpread * price)}` : NOT_ENOUGH,
      detail: hasMinimumLogs && price > 0
        ? `Spending forecast uses actual average cigarette cost (${(input.analytics?.currencySymbol ?? "Rs")}${price.toFixed(0)}). Confidence: ${confidence}.`
        : "Cigarette price and smoking logs are required.",
      available: Boolean(hasMinimumLogs && price > 0),
    },
    {
      title: "Health Milestone",
      value: NOT_ENOUGH,
      detail: "Health milestone prediction is not derived from smoking log statistics, so no value is fabricated here.",
      available: false,
    },
    {
      title: "Goal Timeline",
      value: NOT_ENOUGH,
      detail: "Goal timeline needs a supported long-term downward trend before a range can be shown.",
      available: false,
    },
  ];

  const profile = !hasMinimumLogs
    ? "Building Baseline"
    : hourly.most && (hourly.most.hour >= 20 || hourly.most.hour <= 2)
      ? "Night Smoker"
      : trend === "Improving"
        ? "Improving Quitter"
        : "Habit Smoker";

  const aiInsights = [
    hasMinimumLogs ? `Your logs contain ${totalCigarettes} cigarettes across ${historyDays} calendar days.` : NOT_ENOUGH,
    hasMinimumLogs && avgInterval ? `Average interval between logged cigarettes is ${Math.round(avgInterval)} minutes.` : "Average interval needs at least 2 timestamped smoking logs.",
    historyDays >= 14 ? `Trend status is ${trend}: last 7 days ${recent7.toFixed(1)}/day vs previous 7 days ${previous7.toFixed(1)}/day.` : "Trend needs 14 days of smoking history.",
    hasMinimumLogs && hourly.most ? `Most active hour is ${formatHour(hourly.most.hour)} based only on cigarette logs.` : "Peak hour needs more logs.",
  ];

  return {
    behaviorProfile: profile,
    dataDays: historyDays,
    hasPredictionData,
    insufficientMessage: hasMinimumLogs ? (historyDays < 7 ? LIMITED : "Predictions use cigarette log history only.") : NOT_ENOUGH,
    patternCards,
    forecastCards,
    aiInsights,
    hourlyRisk,
    trendSeries: series.slice(-14).map((entry) => ({
      label: shortDays[entry.date.getDay()],
      cigarettes: entry.count,
    })).concat(hasMinimumLogs ? Array.from({ length: 3 }, (_, index) => ({
      label: `P${index + 1}`,
      cigarettes: 0,
      projected: Number(currentMonthAverage.toFixed(1)),
    })) : []),
    scores: {
      relapseRisk: Math.round(riskScore),
      quitSuccess: historyDays >= 14 ? (trend === "Improving" ? 75 : trend === "Stable" ? 50 : 25) : 0,
      improvementPercent,
      triggerLoad: trigger ? clamp((trigger[1] / Math.max(1, totalCigarettes)) * 100) : 0,
    },
    explanation: hasMinimumLogs
      ? `Calculated only from ${logs.length} real smoking log${logs.length === 1 ? "" : "s"}. Confidence: ${confidence}.`
      : NOT_ENOUGH,
  };
}
