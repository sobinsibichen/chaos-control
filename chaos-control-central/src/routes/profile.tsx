import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Brain, Cigarette, IndianRupee, Moon, Settings, ShieldCheck, Trophy, Wine } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { appStore, useAppStore } from "@/lib/app-store";
import { getChaosMetrics } from "@/lib/chaos-metrics";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - Last Puff" }] }),
  component: Profile,
});

function Profile() {
  const state = useAppStore((value) => value);
  const metrics = getChaosMetrics(state);
  const [draftPrice, setDraftPrice] = useState(state.settings.cigarettePrice.toString());

  const badges = [
    { icon: Moon, name: "Night Owl", desc: "Awake past 4am, 14 times.", color: "text-violet-400" },
    { icon: Cigarette, name: "Smoker's Journey", desc: `Burned ${metrics.format(metrics.lifetimeBurned)} in smoke.`, color: "text-orange-400" },
    { icon: ShieldCheck, name: "Shopping Guardian", desc: `Blocked ${metrics.format(metrics.purchaseDamage)} in regret.`, color: "text-emerald-400" },
    { icon: Brain, name: "Overthinker", desc: "Spiraled for 312 hours.", color: "text-cyan-400" },
    { icon: Wine, name: "Social Butterfly", desc: "Last to leave. Always.", color: "text-rose-400" },
    { icon: Trophy, name: "Persistence", desc: `Still at ${metrics.currencySymbol}${state.settings.cigarettePrice} per cigarette.`, color: "text-amber-400" },
  ];

  const savePrice = () => {
    const nextValue = Number(draftPrice);

    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      return;
    }

    appStore.updateSettings({ cigarettePrice: nextValue });
  };

  const handleLogout = () => {
    appStore.logout();
  };

  return (
    <AppShell>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Account</div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Your Profile</h1>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-foreground/10 bg-card transition-colors hover:border-foreground/20">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <GlassCard glow="purple" className="relative mb-6">
          <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="relative h-16 w-16"
          >
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-foreground/10 bg-card text-2xl shadow-sm">
              {state.auth.user?.avatar ?? "V"}
            </div>
          </motion.div>
          <div>
            <div className="text-lg font-semibold text-foreground">{state.auth.user?.username ?? "User"}</div>
            <div className="text-xs text-muted-foreground">Tracking your journey</div>
            <div className="mt-1 text-[10px] font-medium text-primary">Level 47 - Active</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-[10px] font-medium">
            <span className="text-muted-foreground">Progress to Level 48</span>
            <span className="text-primary">2,847 / 5,000 XP</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "57%" }}
              transition={{ duration: 1.2 }}
              className="h-full bg-gradient-to-r from-primary via-violet-400 to-rose-400"
            />
          </div>
        </div>
      </GlassCard>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { l: "Track Status", v: "Active", c: "text-primary" },
          { l: "Commitment", v: "Strong", c: "text-emerald-400" },
          { l: "Savings Blocked", v: metrics.format(metrics.purchaseDamage), c: "text-cyan-400" },
          { l: "Quits Logged", v: `${state.stats.fakeQuits}x`, c: "text-rose-400" },
        ].map((item, index) => (
          <motion.div
            key={item.l}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass rounded-2xl border border-foreground/10 p-4"
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{item.l}</div>
            <div className={`mt-1 text-lg font-semibold ${item.c}`}>{item.v}</div>
          </motion.div>
        ))}
      </div>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Cigarette Pricing</div>
      </div>
      <GlassCard glow="orange" className="mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/5">
            <IndianRupee className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold text-foreground">Price Per Cigarette</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Updates all financial calculations: money burned, savings, and annual projections. It follows the cigarettes you log on Home.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <div className="flex flex-1 items-center rounded-2xl border border-foreground/10 bg-card px-4 shadow-sm">
            <span className="text-lg font-semibold text-primary">{metrics.currencySymbol}</span>
            <input
              inputMode="numeric"
              value={draftPrice}
              onChange={(event) => setDraftPrice(event.target.value)}
              className="w-full bg-transparent px-3 py-3 text-sm outline-none"
              placeholder="20"
            />
          </div>
          <button
            onClick={savePrice}
            className="rounded-lg bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Update
          </button>
        </div>

      </GlassCard>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Your Achievements</div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {badges.map((badge, index) => (
          <motion.div
            key={badge.name}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.96 }}
            className="glass relative overflow-hidden rounded-2xl border border-foreground/10 p-3"
          >
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 ${badge.color}`}>
              <badge.icon className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold leading-tight text-foreground">{badge.name}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{badge.desc}</div>
          </motion.div>
        ))}
      </div>

      <GlassCard className="border border-red-400/20 text-center">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Account</div>
        <div className="text-sm text-foreground">Active since day 1. No regrets yet.</div>
        <button
          onClick={handleLogout}
          className="mt-3 w-full rounded-2xl border border-red-400/30 bg-red-400/10 py-2.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-400/20"
        >
          Logout
        </button>
      </GlassCard>
    </AppShell>
  );
}
