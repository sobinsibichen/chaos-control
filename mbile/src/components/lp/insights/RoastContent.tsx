import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BanknoteArrowDown, Flame, IndianRupee, ShieldBan, Skull, WalletCards, Wind } from "lucide-react";
import { AnimatedNumber } from "@/components/lp/AnimatedNumber";
import { GlassCard } from "@/components/lp/GlassCard";
import { TopRegretCard } from "@/components/lp/analytics/TopRegretCard";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/lib/app-store";
import { queryKeys } from "@/lib/query-keys";

interface AnalyticsPayload {
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

export function RoastContent() {
  const hydrated = useAppStore((state) => state.meta.hydrated);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const queriesEnabled = hydrated && isAuthenticated;

  const analyticsQuery = useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => apiRequest<{ success: boolean; analytics: AnalyticsPayload }>("/api/analytics/roast"),
    enabled: queriesEnabled,
    refetchInterval: 60000,
  });

  const highlightsQuery = useQuery({
    queryKey: queryKeys.highlights,
    queryFn: () =>
      apiRequest<{ success: boolean; highlights: AnalyticsPayload & { blockedLogs: Array<{ id: number; app_name: string; message: string | null }> } }>("/api/analytics/highlights"),
    enabled: queriesEnabled,
    refetchInterval: 60000,
  });

  const analytics = analyticsQuery.data?.analytics;
  const highlights = highlightsQuery.data?.highlights;
  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  const chart = analytics?.monthlyCigarettes ?? new Array(12).fill(0);
  const currency = analytics?.currencySymbol ?? "Rs";

  const regrets = [
    {
      icon: WalletCards,
      title: "Largest Monthly Burn",
      value: analytics?.monthlyProjection ?? 0,
      subtitle: "What smoking wants every month.",
      accent: "orange" as const,
    },
    {
      icon: Skull,
      title: "Worst Day",
      value: analytics?.worstDay?.day ? new Date(analytics.worstDay.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "No data",
      subtitle: `${analytics?.worstDay?.total ?? 0} cigarettes on your hardest day.`,
      accent: "red" as const,
    },
    {
      icon: Flame,
      title: "Peak Single Day",
      value: analytics?.peakSingleDay ?? 0,
      suffix: " cigs",
      subtitle: "Your old ceiling, visible in numbers.",
      accent: "pink" as const,
    },
    {
      icon: IndianRupee,
      title: "Highest Daily Burn",
      value: analytics?.highestDailySpend ?? 0,
      subtitle: "One rough day, fully itemized.",
      accent: "purple" as const,
    },
    {
      icon: ShieldBan,
      title: "Blocked Purchases",
      value: analytics?.blockedPurchases ?? 0,
      suffix: " blocked",
      subtitle: highlights?.blockedLogs.length ? "Protection system engaged." : "No blocked purchase logs yet.",
      accent: "green" as const,
    },
    {
      icon: Wind,
      title: "Lungs Recovery",
      value: analytics?.lungsRecoveryPercent ?? 0,
      suffix: "%",
      subtitle: analytics?.recoveryStage ?? "Oxygen improving",
      accent: "cyan" as const,
    },
  ];

  return (
    <>
      <GlassCard glow="orange" className="mb-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-foreground">Total Burn</div>
            <div className="mt-1 flex items-center text-3xl font-bold">
              <AnimatedNumber value={analytics?.annualSpend ?? 0} prefix={currency} />
            </div>
            <div className="mt-1 text-[11px] text-foreground">At {currency}{analytics?.cigarettePrice ?? 0} per cigarette</div>
          </div>
          <Flame className="h-6 w-6 animate-float text-rose-600" />
        </div>
        <div className="grid h-32 grid-cols-12 items-end gap-1.5">
          {chart.map((value, index) => (
            <motion.div
              key={`${value}-${index}`}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(...chart) ? (value / Math.max(...chart)) * 100 : 0}%` }}
              transition={{ delay: index * 0.04, duration: 0.6, ease: "easeOut" }}
              className="col-span-1 rounded-t-md bg-gradient-to-t from-amber-500 via-stone-500 to-stone-900 opacity-85"
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-12 gap-1.5 text-center text-[9px] font-medium uppercase tracking-[0.15em] text-foreground">
          {months.map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </GlassCard>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-foreground">Key Metrics</div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { icon: BanknoteArrowDown, label: "Daily Average", value: analytics?.dailyAverage ?? 0, iconAccent: "text-amber-600" },
          { icon: WalletCards, label: "Monthly Proj.", value: analytics?.monthlyProjection ?? 0, iconAccent: "text-fuchsia-600" },
          { icon: Flame, label: "Today Saved", value: analytics?.todaySavings ?? 0, iconAccent: "text-emerald-600" },
          { icon: Skull, label: "Risk Score", value: Math.min(99, Math.round((analytics?.peakSingleDay ?? 0) * 4 + ((analytics?.currentStreak ?? 0) > 0 ? 0 : 20))), iconAccent: "text-rose-600", suffix: "%" },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.08 }}
            className="glass relative overflow-hidden rounded-2xl border border-foreground/10 p-4"
          >
            <item.icon className={`h-5 w-5 ${item.iconAccent}`} />
            <div className="mt-3 text-2xl font-bold text-foreground">
              <AnimatedNumber value={item.value} prefix={item.label.includes("Risk") ? "" : currency} suffix={item.suffix} />
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-foreground">{item.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { label: "Weekly Saved", value: analytics?.weeklySavings ?? 0, accent: "text-sky-600" },
          { label: "Total Saved", value: analytics?.totalSavings ?? 0, accent: "text-emerald-600" },
          { label: "Cigs Avoided", value: analytics?.cigarettesAvoidedTotal ?? 0, accent: "text-amber-600", suffix: "" },
          { label: "Streak", value: analytics?.currentStreak ?? 0, accent: "text-rose-600", suffix: "" },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass rounded-2xl border border-foreground/10 p-4"
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{item.label}</div>
            <div className={`mt-2 text-xl font-semibold ${item.accent}`}>
              <AnimatedNumber value={item.value} prefix={item.label.includes("Saved") ? currency : ""} suffix={item.suffix} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-foreground">Highlights</div>
        <div className="mt-1 text-lg font-semibold text-foreground">Notable events</div>
      </div>
      <div className="space-y-3">
        {regrets.map((regret, index) => (
          <TopRegretCard key={regret.title} index={index} {...regret} />
        ))}
      </div>
    </>
  );
}
