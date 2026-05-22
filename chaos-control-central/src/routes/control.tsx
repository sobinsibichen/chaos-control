import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BrainCircuit, MessageSquare, ShieldAlert, ShoppingCart, TriangleAlert, Heart, Bitcoin, Pizza, Clock3, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { MentalStabilityChallenge } from "@/components/lp/damage/MentalStabilityChallenge";
import { appStore, useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/control")({
  head: () => ({ meta: [{ title: "Damage Control - Last Puff" }] }),
  component: ControlPage,
});

const blocked = [
  { app: "Amazon", icon: ShoppingCart, why: "You don't need another speaker.", color: "text-orange-600" },
  { app: "Zomato", icon: Pizza, why: "It's 2:47am. Sleep is better.", color: "text-rose-600" },
  { app: "Tinder", icon: Heart, why: "You'll regret those messages.", color: "text-fuchsia-600" },
  { app: "Binance", icon: Bitcoin, why: "Drunk trading = broke tomorrow.", color: "text-emerald-600" },
  { app: "Ex", icon: MessageSquare, why: "High regret probability. Don't.", color: "text-indigo-600" },
];

function ControlPage() {
  const unlockedApps = useAppStore((state) => state.damage.unlockedApps);
  const unlockFailures = useAppStore((state) => state.damage.unlockFailures);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [blockTime, setBlockTime] = useState("22:00");
  const [selectedApps, setSelectedApps] = useState<string[]>(["Amazon", "Zomato"]);

  const toggleSelectedApp = (app: string) => {
    setSelectedApps((current) =>
      current.includes(app) ? current.filter((item) => item !== app) : [...current, app],
    );
  };

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Protection</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">App Controls</h1>
      </div>

      <GlassCard glow="red" className="relative mb-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-foreground/10 bg-card shadow-sm">
            <ShieldAlert className="h-6 w-6 text-rose-600" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Status</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {unlockedApps ? "Protection Disabled" : "Protection Active"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {unlockedApps ? "Apps are accessible. Proceed with caution." : "5 apps blocked. You're safe."}
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mb-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5">
            <Clock3 className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Auto-Block Schedule</div>
            <div className="mt-1 text-lg font-semibold text-foreground">Set a daily block time</div>
            <div className="mt-1 text-xs text-muted-foreground">Choose a time and the apps you want to auto-block every day.</div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Block Time</div>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={blockTime}
                onChange={(event) => setBlockTime(event.target.value)}
                className="w-full rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-sm text-foreground outline-none"
              />
              <div className="rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-sm font-semibold text-foreground">
                Daily
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Choose Apps</div>
              <LayoutGrid className="h-4 w-4 text-sky-600" />
            </div>
            <div className="space-y-2">
              {blocked.map((item) => {
                const active = selectedApps.includes(item.app);
                const Icon = item.icon;
                return (
                  <button
                    key={item.app}
                    onClick={() => toggleSelectedApp(item.app)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/10 bg-background text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-background/10" : "bg-foreground/5"} ${item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{item.app}</div>
                      <div className={`mt-1 text-[11px] ${active ? "text-background/75" : "text-muted-foreground"}`}>
                        Tap to block or unblock this app
                      </div>
                    </div>
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-background bg-background text-foreground" : "border-foreground/10 bg-card text-foreground"}`}>
                      {active ? "✓" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-background px-4 py-3 shadow-sm">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Selected Apps</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{selectedApps.length} chosen</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Time</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{blockTime}</div>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Blocked Applications</div>
      </div>
      <div className="space-y-2.5">
        {blocked.map((item, index) => (
          <motion.div
            key={item.app}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <GlassCard className="!p-4">
              <div className="flex items-center gap-3">
                <div className={`relative flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/5 ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                  <div
                    className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-background text-[10px] font-bold ${
                      unlockedApps ? "bg-emerald-400 text-background" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {unlockedApps ? "✓" : "🔒"}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{item.app}</div>
                  <div className="text-[11px] text-muted-foreground">{item.why}</div>
                </div>
                <button
                  onClick={() => {
                    if (unlockedApps) {
                      appStore.relockApps();
                      return;
                    }
                    setChallengeOpen(true);
                  }}
                  className={`rounded-2xl px-3 py-1.5 text-[11px] font-medium transition-all ${
                    unlockedApps
                      ? "border border-emerald-400/30 bg-emerald-50 text-emerald-600"
                      : "border border-primary/20 bg-primary text-primary-foreground shadow-sm"
                  }`}
                >
                  {unlockedApps ? "Unlock" : "Verify"}
                </button>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard glow="orange" className="mt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5">
            <BrainCircuit className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Unlock Verification</div>
            <div className="mt-1 text-lg font-semibold text-foreground">Mental Stability Challenge</div>
            <p className="mt-1 text-xs text-muted-foreground">Copy text with 100% accuracy. No shortcuts.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-foreground/10 bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Failed</div>
            <div className="mt-2 text-2xl font-bold text-red-400">{unlockFailures}</div>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Required</div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">100%</div>
          </div>
        </div>

        <button
          onClick={() => setChallengeOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_16px_34px_rgba(15,23,42,0.16)] transition-all hover:bg-primary/90"
        >
          <TriangleAlert className="h-4 w-4 text-amber-500" />
          Start Challenge
        </button>
      </GlassCard>

      <MentalStabilityChallenge open={challengeOpen} onClose={() => setChallengeOpen(false)} />
    </AppShell>
  );
}
