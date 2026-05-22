import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Brain, Cigarette, Flame, Search, ShoppingBag, Skull, TrendingDown, Wine, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { AIOrb } from "@/components/lp/AIOrb";
import { AppShell } from "@/components/lp/AppShell";
import { CircularMeter } from "@/components/lp/CircularMeter";
import { GlassCard } from "@/components/lp/GlassCard";
import { SmokeParticles } from "@/components/lp/Smoke";
import { StatTile } from "@/components/lp/StatTile";
import { appStore, useAppStore } from "@/lib/app-store";
import { getChaosMetrics } from "@/lib/chaos-metrics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Last Puff - Redirecting" },
      { name: "description", content: "A futuristic chaos management system for smokers, drinkers and emotionally unstable late-night users." },
    ],
  }),
  component: IndexRedirect,
});

const messages = [
  "You have quit smoking 43 times this month.",
  "Your lungs are requesting software updates.",
  "Amazon purchase blocked successfully. You're welcome.",
  "Emotional damage detected. Initiating cope protocol.",
  "This cigarette is emotionally sponsored.",
];

function IndexRedirect() {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);

  useEffect(() => {
    void navigate({ to: isAuthenticated ? "/home" : "/login", replace: true });
  }, [isAuthenticated, navigate]);

  return null;
}

export function DashboardPage() {
  const state = useAppStore((value) => value);
  const metrics = getChaosMetrics(state);
  const [smoking, setSmoking] = useState(false);
  const msg = messages[state.stats.cigarettesToday % messages.length] ?? messages[0];

  const onPuff = () => {
    appStore.recordPuff();
    setSmoking(true);
    window.setTimeout(() => setSmoking(false), 4000);
  };

  return (
    <AppShell>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="text-base font-semibold text-foreground">Hello, {state.auth.user?.username.split(" ")[0] ?? "there"}.</div>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
        </div>
        <button className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 bg-card shadow-sm">
          <span className="text-sm font-semibold text-foreground">{state.auth.user?.avatar ?? "V"}</span>
        </button>
      </div>

      <div className="glass mb-6 flex items-center gap-3 rounded-full border border-foreground/10 px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          readOnly
          value=""
          placeholder="Search your bad decisions..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Today's Overview</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Your Progress</h1>
      </div>

      <div className="mb-6">
        <AIOrb message={msg} />
      </div>

      <GlassCard glow="orange" className="mb-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Daily Status</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">You're tracking well.</div>
          </div>
          <div className="rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mr-1.5" />
            Live
          </div>
        </div>
        <div className="flex items-center gap-5">
          <CircularMeter value={87} label="SCORE" sub="steady" />
          <div className="flex-1 space-y-4">
            {[
              { label: "Regret Level", value: `${metrics.regretScore}%`, accent: "text-orange-400" },
              { label: "Stability", value: `${Math.max(8, 100 - metrics.regretScore)}%`, accent: "text-cyan-400" },
              { label: "Status", value: "Managed", accent: "text-primary" },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{item.label}</div>
                <div className={`mt-1 text-lg font-semibold ${item.accent}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="relative mb-6">
        {smoking && <SmokeParticles count={8} />}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Track Cigarette</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">Log a cigarette</div>
          </div>
          <Cigarette className="mt-1 h-5 w-5 animate-float text-primary" />
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onPuff}
          className="relative w-full overflow-hidden rounded-2xl bg-primary px-5 py-3 text-sm font-semibold tracking-wide text-primary-foreground shadow-[0_16px_34px_rgba(15,23,42,0.16)] transition-all hover:bg-primary/90"
        >
          <span className="relative">Record Cigarette</span>
        </motion.button>

        <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "Today", value: state.stats.cigarettesToday, accent: "text-amber-600" },
          { label: "Quits", value: state.stats.fakeQuits, accent: "text-fuchsia-600" },
          { label: "Total", value: state.stats.lifetimeCigarettes.toLocaleString("en-IN"), accent: "text-sky-600" },
        ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-foreground/10 bg-card px-3 py-3 text-center shadow-sm">
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{item.label}</div>
              <div className={`mt-2 text-lg font-semibold ${item.accent}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="mb-6 grid grid-cols-2 gap-3.5">
        <StatTile icon={Flame} label="Money Burned" value={metrics.format(metrics.moneyBurnedToday)} sub="today" accent="orange" delay={0.05} />
        <StatTile icon={Wine} label="Drinks" value={state.stats.drinksToday.toString()} sub="logged" accent="purple" delay={0.1} />
        <StatTile icon={ShoppingBag} label="Blocked Buys" value={state.stats.blockedBuys.toString()} sub={`${metrics.format(metrics.purchaseDamage)} avoided`} accent="green" delay={0.15} />
        <StatTile icon={Skull} label="Drunk Texts" value={state.stats.drunkTexts.toString()} sub="risk" accent="red" delay={0.2} />
        <StatTile icon={Brain} label="Focus" value="HIGH" sub={`${metrics.currencySymbol}${state.settings.cigarettePrice}/cig`} accent="pink" delay={0.25} />
        <StatTile icon={TrendingDown} label="Savings" value={metrics.format(metrics.savedIfSkippedToday)} sub="potential" accent="cyan" delay={0.3} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Recent Activity</div>
        <span className="text-xs text-muted-foreground">Last 3 events</span>
      </div>
      <div className="space-y-3">
        {[
          { t: "2 min ago", txt: "Blocked Amazon: 'Bluetooth speaker #4'", c: "text-emerald-600", i: ShoppingBag },
          { t: "18 min ago", txt: `You logged your ${state.stats.cigarettesToday}th cigarette.`, c: "text-amber-600", i: Cigarette },
          { t: "1h ago", txt: "Prevented drunk-typing attempt", c: "text-rose-600", i: Zap },
        ].map((row, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.08 }}
            className="glass flex items-center gap-3 rounded-2xl border border-foreground/10 p-4"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5 ${row.c}`}>
              <row.i className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{row.txt}</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{row.t}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}
