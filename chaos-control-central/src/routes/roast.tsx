import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BanknoteArrowDown, Flame, IndianRupee, MessageSquareWarning, MoonStar, ShieldBan, Skull, WalletCards } from "lucide-react";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { TopRegretCard } from "@/components/lp/analytics/TopRegretCard";
import { AnimatedNumber } from "@/components/lp/AnimatedNumber";
import { getChaosMetrics } from "@/lib/chaos-metrics";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/roast")({
  head: () => ({ meta: [{ title: "Roast Analytics - Last Puff" }] }),
  component: RoastPage,
});

function RoastPage() {
  const state = useAppStore((value) => value);
  const metrics = getChaosMetrics(state);
  const chart = state.stats.monthlyCigarettes;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const regrets = [
    {
      icon: WalletCards,
      title: "Largest Monthly Expense",
      value: metrics.projectedMonthlyBurn,
      subtitle: "Your wallet has regrets.",
      accent: "orange" as const,
    },
    {
      icon: Skull,
      title: "Worst Day",
      value: "Saturday, Nov 23",
      subtitle: `${state.stats.drunkTexts} drunk messages, ${state.stats.cigarettesToday + 16} cigarettes.`,
      accent: "red" as const,
    },
    {
      icon: Flame,
      title: "Peak Single Day",
      value: Math.max(...state.stats.dailyCigarettes),
      suffix: " cigs",
      subtitle: "That one day your health quit.",
      accent: "pink" as const,
    },
    {
      icon: IndianRupee,
      title: "Highest Daily Spend",
      value: metrics.worstDailySpend,
      subtitle: "One sunrise, multiple regrets.",
      accent: "purple" as const,
    },
    {
      icon: ShieldBan,
      title: "Blocked Purchases",
      value: state.stats.blockedShoppingAttempts,
      suffix: " blocked",
      subtitle: "Protection system engaged.",
      accent: "green" as const,
    },
    {
      icon: MoonStar,
      title: "Worst Sleep",
      value: state.stats.worstSleepNightHours,
      suffix: " hours",
      subtitle: "Insomnia's greatest achievement.",
      accent: "cyan" as const,
    },
    {
      icon: MessageSquareWarning,
      title: "Messages to Ex",
      value: state.stats.exMessages,
      suffix: " sent",
      subtitle: "Timestamp can't be unseen.",
      accent: "red" as const,
    },
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-foreground">Analytics</div>
        <h1 className="text-2xl font-semibold text-foreground mt-2">Your Statistics</h1>
      </div>

      <GlassCard glow="orange" className="mb-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-foreground">Annual Spend</div>
            <div className="flex items-center text-3xl font-bold mt-1">
              <AnimatedNumber value={metrics.moneyBurnedYear} prefix={metrics.currencySymbol} />
            </div>
            <div className="mt-1 text-[11px] text-foreground">At {metrics.currencySymbol}{state.settings.cigarettePrice} per unit</div>
          </div>
          <Flame className="h-6 w-6 animate-float text-rose-600" />
        </div>
        <div className="grid h-32 grid-cols-12 items-end gap-1.5">
          {chart.map((value, index) => (
            <motion.div
              key={`${value}-${index}`}
              initial={{ height: 0 }}
              animate={{ height: `${(value / Math.max(...chart)) * 100}%` }}
              transition={{ delay: index * 0.04, duration: 0.6, ease: "easeOut" }}
              className="col-span-1 rounded-t-md bg-gradient-to-t from-amber-500 via-fuchsia-500 to-sky-500 opacity-85"
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
          { icon: BanknoteArrowDown, label: "Daily Average", value: metrics.averageDailySpend, iconAccent: "text-amber-600" },
          { icon: WalletCards, label: "Monthly Proj.", value: metrics.projectedMonthlyBurn, iconAccent: "text-fuchsia-600" },
          { icon: Flame, label: "Skip Savings", value: metrics.savedIfSkippedToday, iconAccent: "text-emerald-600" },
          { icon: Skull, label: "Risk Score", value: metrics.regretScore, iconAccent: "text-rose-600", suffix: "%" },
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
              <AnimatedNumber value={item.value} prefix={item.label.includes("Risk") ? "" : metrics.currencySymbol} suffix={item.suffix} />
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-foreground">{item.label}</div>
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
    </AppShell>
  );
}
