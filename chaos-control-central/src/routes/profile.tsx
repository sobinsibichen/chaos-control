import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Brain, Cigarette, Flame, IndianRupee, Settings, ShieldCheck, TimerReset, Trophy, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { apiRequest } from "@/lib/api";
import { appStore, useAppStore } from "@/lib/app-store";
import { logoutUser } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { requireAuth } from "@/lib/route-guards";
import { formatLongDuration, formatSmokeFree, useSmokeFreeTicker } from "@/lib/time";

export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Profile - Last Puff" }] }),
  component: Profile,
});

const iconMap = {
  Brain,
  Cigarette,
  ShieldCheck,
  TimerReset,
  Trophy,
  Flame,
};

interface ProfilePayload {
  user: { id: number; name: string; email: string; avatar: string; cigarettePrice: number; visibilityEnabled: boolean; dailySmokingAverage: number };
  level: number;
  levelName: string;
  rewardTitle: string;
  currentLevelXp: number;
  xpToNextLevel: number;
  levelProgressPercent: number;
  commitment: string;
  streak: { current: number; highest: number };
  smokeFree: { startedAt: string | null; longestSeconds: number };
  lungs: { percent: number; stage: string };
  savings: { today: number; weekly: number; total: number };
  stats: { quitCount: number; savings: number; blockedBuys: number; focusLevel: string; totalCigarettesAvoided: number; dailySmokingAverage: number };
}

interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: keyof typeof iconMap;
  xp_reward: number;
  level_required: number | null;
  unlocked: boolean;
}

function Profile() {
  const queryClient = useQueryClient();
  const authUser = useAppStore((value) => value.auth.user);
  const [draftPrice, setDraftPrice] = useState(authUser?.cigarettePrice?.toString() || "20");
  const [draftAverage, setDraftAverage] = useState("10");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiRequest<{ success: boolean; profile: ProfilePayload }>("/api/profile"),
    refetchInterval: 60000,
  });

  const achievementsQuery = useQuery({
    queryKey: queryKeys.achievements,
    queryFn: () =>
      apiRequest<{ success: boolean; achievements: Achievement[] }>("/api/profile/achievements"),
    refetchInterval: 60000,
  });

  const profile = profileQuery.data?.profile;
  const achievements = achievementsQuery.data?.achievements ?? [];
  const smokeFreeSeconds = useSmokeFreeTicker(profile?.smokeFree.startedAt ?? null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setDraftPrice(String(profile.user.cigarettePrice));
    setDraftAverage(String(profile.user.dailySmokingAverage));
    appStore.updateUser({
      id: profile.user.id,
      username: profile.user.name,
      email: profile.user.email,
      avatar: profile.user.avatar,
      cigarettePrice: profile.user.cigarettePrice,
      visibilityEnabled: profile.user.visibilityEnabled,
    });
  }, [profile]);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setSuccessMessage(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const savePreferences = useMutation({
    mutationFn: async () => {
      const cigarettePrice = Number(draftPrice);
      const dailySmokingAverage = Number(draftAverage);

      if (!Number.isFinite(cigarettePrice) || cigarettePrice <= 0) {
        throw new Error("Enter a valid cigarette price.");
      }

      if (!Number.isFinite(dailySmokingAverage) || dailySmokingAverage <= 0) {
        throw new Error("Enter a valid daily smoking average.");
      }

      return apiRequest<{ success: boolean; profile: ProfilePayload }>("/api/profile/preferences", {
        method: "PUT",
        body: JSON.stringify({ cigarettePrice, dailySmokingAverage }),
      });
    },
    onSuccess: ({ profile: nextProfile }) => {
      setErrorMessage("");
      setSuccessMessage("Updated successfully.");
      appStore.updateUser({
        cigarettePrice: nextProfile.user.cigarettePrice,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
    onError: (error) => {
      setSuccessMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Unable to update preferences.");
    },
  });

  const handleLogout = () => {
    void logoutUser();
  };

  const formatMoney = (value: number) => `Rs${Math.round(value).toLocaleString("en-IN")}`;

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

      <GlassCard glow="orange" className="relative mb-6">
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="relative h-16 w-16"
          >
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-foreground/10 bg-card text-2xl shadow-sm">
              {profile?.user.avatar ?? authUser?.avatar ?? "V"}
            </div>
          </motion.div>
          <div>
            <div className="text-lg font-semibold text-foreground">{profile?.user.name ?? authUser?.username ?? "User"}</div>
            <div className="text-xs text-muted-foreground">{profile?.rewardTitle ?? "Tracking your recovery"}</div>
            <div className="mt-1 text-[10px] font-medium text-primary">🔥 STREAK: {profile?.streak.current ?? 0}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-[10px] font-medium">
            <span className="text-muted-foreground">
              Level {profile?.level ?? 1} · {profile?.levelName ?? "Starter"}
            </span>
            <span className="text-primary">{profile?.levelProgressPercent ?? 0}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${profile?.levelProgressPercent ?? 0}%` }}
              transition={{ duration: 1.2 }}
              className="h-full bg-gradient-to-r from-primary via-stone-400 to-stone-700"
            />
          </div>
        </div>
      </GlassCard>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { l: "Commitment", v: profile?.commitment ?? "Loading", c: "text-primary" },
          { l: "Highest Streak", v: `${profile?.streak.highest ?? 0}`, c: "text-emerald-500" },
          { l: "Total Savings", v: formatMoney(profile?.savings.total ?? 0), c: "text-sky-600" },
          { l: "Cigs Avoided", v: `${profile?.stats.totalCigarettesAvoided ?? 0}`, c: "text-rose-500" },
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

      <GlassCard className="mb-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/5">
            <TimerReset className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Live Recovery</div>
            <div className="mt-1 text-lg font-semibold text-foreground">Smoke-free clock</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-foreground/10 bg-card px-3 py-4 text-center shadow-sm">
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Now</div>
            <div className="mt-2 text-base font-semibold text-foreground">{formatSmokeFree(smokeFreeSeconds)}</div>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-card px-3 py-4 text-center shadow-sm">
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Longest</div>
            <div className="mt-2 text-base font-semibold text-foreground">{formatLongDuration(profile?.smokeFree.longestSeconds ?? 0)}</div>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-card px-3 py-4 text-center shadow-sm">
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Lungs</div>
            <div className="mt-2 text-base font-semibold text-foreground">{profile?.lungs.percent ?? 0}%</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Recovery Stage</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{profile?.lungs.stage ?? "Oxygen improving"}</div>
            </div>
            <Wind className="h-5 w-5 text-sky-600" />
          </div>
        </div>
      </GlassCard>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Smoking Preferences</div>
      </div>
      <GlassCard glow="orange" className="mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/5">
            <IndianRupee className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold text-foreground">Live Savings Inputs</div>
            <p className="mt-1 text-xs text-muted-foreground">
              These values drive your avoided cigarettes, money saved, and recovery pacing everywhere in the app.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex items-center rounded-2xl border border-foreground/10 bg-card px-4 shadow-sm">
            <span className="text-lg font-semibold text-primary">Rs</span>
            <input
              inputMode="numeric"
              value={draftPrice}
              onChange={(event) => {
                setDraftPrice(event.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className="w-full bg-transparent px-3 py-3 text-sm outline-none"
              placeholder="20"
            />
          </div>

          <div className="flex items-center rounded-2xl border border-foreground/10 bg-card px-4 shadow-sm">
            <Cigarette className="h-4 w-4 text-muted-foreground" />
            <input
              inputMode="numeric"
              value={draftAverage}
              onChange={(event) => {
                setDraftAverage(event.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className="w-full bg-transparent px-3 py-3 text-sm outline-none"
              placeholder="How many cigarettes do you smoke daily?"
            />
          </div>

          <button
            onClick={() => savePreferences.mutate()}
            disabled={savePreferences.isPending}
            className="rounded-lg bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            {savePreferences.isPending ? "Saving..." : "Update"}
          </button>
        </div>
        {successMessage ? <div className="mt-3 text-sm text-emerald-600">{successMessage}</div> : null}
        {errorMessage ? <div className="mt-3 text-sm text-red-500">{errorMessage}</div> : null}
      </GlassCard>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { l: "Today Saved", v: formatMoney(profile?.savings.today ?? 0), c: "text-amber-600" },
          { l: "Weekly Saved", v: formatMoney(profile?.savings.weekly ?? 0), c: "text-fuchsia-600" },
          { l: "Focus", v: profile?.stats.focusLevel ?? "HIGH", c: "text-sky-600" },
          { l: "Quit Attempts", v: `${profile?.stats.quitCount ?? 0}`, c: "text-emerald-600" },
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
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Your Achievements</div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {achievements.map((badge, index) => {
          const Icon = iconMap[badge.icon] || Trophy;

          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileTap={{ scale: 0.96 }}
              className="glass relative overflow-hidden rounded-2xl border border-foreground/10 p-3"
            >
              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 ${badge.unlocked ? "text-amber-400" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold leading-tight text-foreground">{badge.title}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{badge.description}</div>
            </motion.div>
          );
        })}
      </div>

      <GlassCard className="border border-red-400/20 text-center">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Account</div>
        <div className="text-sm text-foreground">Everything here updates live from your recovery data.</div>
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
