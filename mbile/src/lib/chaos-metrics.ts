import type { AppState } from "./app-store";

export function formatCurrency(value: number, currencySymbol = "₹") {
  return `${currencySymbol}${Math.round(value).toLocaleString("en-IN")}`;
}

export function getChaosMetrics(state: AppState) {
  const { cigarettePrice, currencySymbol } = state.settings;
  const { stats, damage } = state;

  const moneyBurnedToday = stats.cigarettesToday * cigarettePrice;
  const moneyBurnedYear = stats.monthlyCigarettes.reduce((sum, value) => sum + value, 0) * cigarettePrice;
  const lifetimeBurned = stats.lifetimeCigarettes * cigarettePrice;
  const averageDailySpend = Math.round((stats.dailyCigarettes.reduce((sum, value) => sum + value, 0) / stats.dailyCigarettes.length) * cigarettePrice);
  const worstDailySpend = Math.max(...stats.dailyCigarettes) * cigarettePrice;
  const regretScore = Math.min(99, Math.round(moneyBurnedToday / 3 + stats.drunkTexts * 7 + stats.exMessages * 2));
  const projectedMonthlyBurn = stats.cigarettesToday * 30 * cigarettePrice;
  const savedIfSkippedToday = averageDailySpend;
  const purchaseDamage = stats.blockedShoppingAttempts * cigarettePrice;

  return {
    currencySymbol,
    moneyBurnedToday,
    moneyBurnedYear,
    lifetimeBurned,
    averageDailySpend,
    worstDailySpend,
    regretScore,
    projectedMonthlyBurn,
    savedIfSkippedToday,
    purchaseDamage,
    unlockedApps: damage.unlockedApps,
    format: (value: number) => formatCurrency(value, currencySymbol),
  };
}
