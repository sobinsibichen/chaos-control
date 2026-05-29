import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Brain, Cigarette, Flame, IndianRupee, Settings, ShieldCheck, Sparkles, TimerReset, Trophy, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  levelGuide: { level: number; name: string; requiredPoints: number; rewardTitle: string; finalCertificate: boolean }[];
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
  const [pointsGuideOpen, setPointsGuideOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiRequest<{ success: boolean; profile: ProfilePayload }>("/api/profile"),
  });

  const achievementsQuery = useQuery({
    queryKey: queryKeys.achievements,
    queryFn: () => apiRequest<{ success: boolean; achievements: Achievement[] }>("/api/profile/achievements"),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements });
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
        <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-foreground/10 bg-white transition-colors hover:border-foreground/20">
          <Settings className="h-4 w-4 text-foreground" />
        </button>
      </div>

      <GlassCard className="relative mb-6">
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="relative h-16 w-16"
          >
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-foreground/10 bg-white text-2xl shadow-sm">
              {profile?.user.avatar ?? authUser?.avatar ?? "V"}
            </div>
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-foreground">{profile?.user.name ?? authUser?.username ?? "User"}</div>
            <div className="text-xs text-muted-foreground">{profile?.rewardTitle ?? "Tracking your recovery"}</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-foreground">Streak: {profile?.streak.current ?? 0}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">
                <Sparkles className="h-3 w-3" />
                {profile?.currentLevelXp ?? 0} Points
              </div>
              <button
                onClick={() => setPointsGuideOpen(true)}
                className="rounded-full border border-foreground/10 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:border-foreground/20"
              >
                View Levels
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-[10px] font-medium">
            <span className="text-muted-foreground">
              Level {profile?.level ?? 1} · {profile?.levelName ?? "Starter"}
            </span>
            <span className="text-foreground">{profile?.levelProgressPercent ?? 0}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${profile?.levelProgressPercent ?? 0}%` }}
              transition={{ duration: 1.2 }}
              className="h-full bg-black"
            />
          </div>
        </div>
      </GlassCard>

      <Dialog open={pointsGuideOpen} onOpenChange={setPointsGuideOpen}>
        <DialogContent className="max-w-xl rounded-[1.75rem] border border-foreground/10 bg-white p-0 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
          <div className="rounded-[1.75rem] bg-white p-6">
            <DialogHeader className="pr-10 text-left">
              <DialogTitle className="text-xl text-foreground">Level Roadmap</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Smoke less than your daily baseline to gain points. Smoke above it and points are removed. Reach the final level to unlock the certificate.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-3 rounded-[1.5rem] border border-foreground/10 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">How points move</div>
                  <div className="mt-1 text-xs text-muted-foreground">Each cigarette avoided below your baseline helps. Smoke-free hours add bonus momentum. Smoking above your baseline removes from your total score and can drop your level.</div>
                </div>
                <div className="rounded-2xl border border-foreground/10 bg-white px-3 py-2 text-right text-[11px] font-semibold text-foreground">
                  + below baseline
                  <br />
                  + smoke-free time
                  <br />
                  - above baseline
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Level Ladder</div>
              <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                {(profile?.levelGuide ?? []).map((level) => {
                  const isCurrent = level.level === profile?.level;

                  return (
                    <div
                      key={level.level}
                      className={`rounded-[1.4rem] border p-4 shadow-sm transition-colors ${isCurrent ? "border-foreground bg-black/5" : "border-foreground/10 bg-white"}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            Level {level.level} · {level.name}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{level.rewardTitle}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground">{level.requiredPoints} pts</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                            {level.finalCertificate ? "Certificate" : isCurrent ? "Current" : "Target"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { l: "Commitment", v: profile?.commitment ?? "Loading", c: "text-foreground" },
          { l: "Highest Streak", v: `${profile?.streak.highest ?? 0}`, c: "text-foreground" },
          { l: "Total Savings", v: formatMoney(profile?.savings.total ?? 0), c: "text-foreground" },
          { l: "Cigs Avoided", v: `${profile?.stats.totalCigarettesAvoided ?? 0}`, c: "text-foreground" },
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
            <TimerReset className="h-5 w-5 text-foreground" />
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
            <Wind className="h-5 w-5 text-foreground" />
          </div>
        </div>
      </GlassCard>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Smoking Preferences</div>
      </div>
      <GlassCard className="mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/5">
            <IndianRupee className="h-5 w-5 text-foreground" />
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
            <span className="text-lg font-semibold text-foreground">Rs</span>
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
            className="rounded-lg bg-black px-4 py-3 text-xs font-semibold text-white transition-all hover:bg-black/90"
          >
            {savePreferences.isPending ? "Saving..." : "Update"}
          </button>
        </div>
        {successMessage ? <div className="mt-3 text-sm text-foreground">{successMessage}</div> : null}
        {errorMessage ? <div className="mt-3 text-sm text-foreground">{errorMessage}</div> : null}
      </GlassCard>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { l: "Today Saved", v: formatMoney(profile?.savings.today ?? 0), c: "text-foreground" },
          { l: "Weekly Saved", v: formatMoney(profile?.savings.weekly ?? 0), c: "text-foreground" },
          { l: "Focus", v: profile?.stats.focusLevel ?? "HIGH", c: "text-foreground" },
          { l: "Quit Attempts", v: `${profile?.stats.quitCount ?? 0}`, c: "text-foreground" },
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
      {achievements.length ? (
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
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold leading-tight text-foreground">{badge.title}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{badge.description}</div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <GlassCard className="mb-6 border border-foreground/10">
          <div className="text-sm font-semibold text-foreground">No achievements yet</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Achievements will appear here when you smoke less than your daily baseline and level up from that progress.
          </div>
        </GlassCard>
      )}

      <GlassCard className="border border-foreground/10 text-center">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Account</div>
        <div className="text-sm text-foreground">Everything here updates live from your recovery data.</div>
        <button
          onClick={handleLogout}
          className="mt-3 w-full rounded-2xl border border-foreground/10 bg-white py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-black/5"
        >
          Logout
        </button>
      </GlassCard>
    </AppShell>
  );
}
