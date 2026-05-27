import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Award, Cigarette, IndianRupee, Settings, Sparkles, TimerReset, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient, apiRequest } from "@/lib/api";
import { appStore, useAppStore } from "@/lib/app-store";
import { queryKeys } from "@/lib/query-keys";
import { formatLongDuration, formatSmokeFree, useSmokeFreeTicker } from "@/lib/time";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - Last Puff" }] }),
  component: Profile,
});

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
  finalRewards: {
    isFinalLevel: boolean;
    badge: { name: string; status: string; unlockedAt: string; metadata: Record<string, unknown> } | null;
    certificate: { certificateId: string; verificationCode: string; createdAt: string; metadata: Record<string, unknown> } | null;
    report: {
      finalLevel: number;
      smokeFreeHours: number;
      totalCigarettesAvoided: number;
      totalMoneySaved: number;
      achievementsUnlocked: number;
    } | null;
  };
}

type RoadPoint = { level: number; x: number; y: number; labelDx: number; labelDy: number };

const fallbackLevelGuide = [
  { level: 1, name: "Bronze I", requiredPoints: 0, rewardTitle: "First clean breath", finalCertificate: false },
  { level: 2, name: "Bronze II", requiredPoints: 25, rewardTitle: "Momentum is starting", finalCertificate: false },
  { level: 3, name: "Silver I", requiredPoints: 55, rewardTitle: "Early discipline secured", finalCertificate: false },
  { level: 4, name: "Silver II", requiredPoints: 90, rewardTitle: "Cravings losing ground", finalCertificate: false },
  { level: 5, name: "Gold I", requiredPoints: 130, rewardTitle: "Recovery is visible now", finalCertificate: false },
  { level: 6, name: "Gold II", requiredPoints: 175, rewardTitle: "Pressure handled with control", finalCertificate: false },
  { level: 7, name: "Platinum I", requiredPoints: 230, rewardTitle: "Identity shifting for real", finalCertificate: false },
  { level: 8, name: "Platinum II", requiredPoints: 290, rewardTitle: "Recovery engine running strong", finalCertificate: false },
  { level: 9, name: "Elite I", requiredPoints: 360, rewardTitle: "Your new routine feels stable", finalCertificate: false },
  { level: 10, name: "Elite II", requiredPoints: 440, rewardTitle: "Discipline has compound interest", finalCertificate: false },
  { level: 11, name: "Master I", requiredPoints: 530, rewardTitle: "Health rebound is undeniable", finalCertificate: false },
  { level: 12, name: "Master II", requiredPoints: 630, rewardTitle: "Freedom is getting louder", finalCertificate: false },
  { level: 13, name: "Final Recovery I", requiredPoints: 740, rewardTitle: "Old habits are losing ownership", finalCertificate: false },
  { level: 14, name: "Final Recovery II", requiredPoints: 860, rewardTitle: "Life is reorganizing around recovery", finalCertificate: false },
  { level: 15, name: "Final Recovery", requiredPoints: 1000, rewardTitle: "Smoking gone from your life", finalCertificate: true },
];

const roadmapPoints: RoadPoint[] = [
  { level: 1, x: 54, y: 336, labelDx: -8, labelDy: 38 },
  { level: 2, x: 134, y: 336, labelDx: -12, labelDy: 38 },
  { level: 3, x: 214, y: 336, labelDx: -12, labelDy: 38 },
  { level: 4, x: 294, y: 336, labelDx: -12, labelDy: 38 },
  { level: 5, x: 294, y: 248, labelDx: 18, labelDy: 6 },
  { level: 6, x: 214, y: 248, labelDx: -14, labelDy: 38 },
  { level: 7, x: 134, y: 248, labelDx: -12, labelDy: 38 },
  { level: 8, x: 54, y: 248, labelDx: -12, labelDy: 38 },
  { level: 9, x: 54, y: 160, labelDx: -14, labelDy: -26 },
  { level: 10, x: 134, y: 160, labelDx: -16, labelDy: -26 },
  { level: 11, x: 214, y: 160, labelDx: -16, labelDy: -26 },
  { level: 12, x: 294, y: 160, labelDx: -16, labelDy: -26 },
  { level: 13, x: 294, y: 72, labelDx: -18, labelDy: -26 },
  { level: 14, x: 214, y: 72, labelDx: -18, labelDy: -26 },
  { level: 15, x: 134, y: 72, labelDx: -18, labelDy: -26 },
];

const roadmapPath = `
  M 54 336
  L 268 336
  Q 318 336 318 286
  L 318 298
  Q 318 248 268 248
  L 80 248
  Q 30 248 30 198
  L 30 210
  Q 30 160 80 160
  L 268 160
  Q 318 160 318 110
  L 318 122
  Q 318 72 268 72
  L 134 72
`;

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
    refetchInterval: 60000,
  });

  const profile = profileQuery.data?.profile;
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
    appStore.logout();
  };

  const downloadCertificate = async () => {
    const response = await apiClient.get("/api/profile/certificate", {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "last-puff-certificate.pdf";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const formatMoney = (value: number) => `Rs${Math.round(value).toLocaleString("en-IN")}`;
  const currentLevel = profile?.level ?? 1;
  const currentPoints = profile?.currentLevelXp ?? 0;
  const levelGuide = profile?.levelGuide?.length ? profile.levelGuide : fallbackLevelGuide;
  const nextLevel = levelGuide.find((level) => level.level > currentLevel) ?? null;

  const roadmapProgress = useMemo(
    () =>
      roadmapPoints.map((point) => ({
        ...point,
        unlocked: point.level <= currentLevel,
        current: point.level === currentLevel,
      })),
    [currentLevel],
  );

  return (
    <AppShell>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Account</div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Your Profile</h1>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-card transition-colors hover:border-foreground/20">
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
            <div className="flex h-full w-full items-center justify-center rounded-[1.35rem] border border-foreground/10 bg-card text-2xl shadow-sm">
              {profile?.user.avatar ?? authUser?.avatar ?? "V"}
            </div>
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-foreground">{profile?.user.name ?? authUser?.username ?? "User"}</div>
            <div className="text-xs text-muted-foreground">{profile?.rewardTitle ?? "Tracking your recovery"}</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-primary">Streak: {profile?.streak.current ?? 0}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700">
                <Sparkles className="h-3 w-3" />
                {currentPoints} Points
              </div>
              <button
                onClick={() => setPointsGuideOpen(true)}
                className="rounded-full border border-foreground/10 bg-card px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
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

      <Dialog open={pointsGuideOpen} onOpenChange={setPointsGuideOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-[1.6rem] border border-foreground/10 bg-[#fcfaf6] p-0 shadow-[0_24px_64px_rgba(15,23,42,0.22)] sm:max-w-xl">
          <div className="max-h-[88vh] overflow-y-auto rounded-[1.6rem] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_55%),linear-gradient(180deg,#fffdf8_0%,#f7f1e7_100%)] p-4 sm:p-6">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle className="text-xl text-foreground">Points and Levels</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Your score grows when you stay below your daily baseline. If you smoke above it, points are removed and your level can drop.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.3rem] border border-foreground/10 bg-white/85 p-4 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Current Score</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{currentPoints} pts</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {nextLevel ? `${Math.max(nextLevel.requiredPoints - currentPoints, 0)} more points for Level ${nextLevel.level}.` : "You are already at the final level."}
                </div>
              </div>
              <div className="rounded-[1.3rem] border border-foreground/10 bg-white/85 p-4 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Level 15 Reward</div>
                <div className="mt-2 text-lg font-semibold text-foreground">Premium Certificate</div>
                <div className="mt-2 text-xs text-muted-foreground">Reach the last level to unlock the certificate and final recovery rewards.</div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.3rem] border border-foreground/10 bg-white/85 p-4 shadow-sm">
              <div className="text-sm font-semibold text-foreground">How the score works</div>
              <div className="mt-2 text-xs leading-6 text-muted-foreground">
                Each cigarette avoided below your baseline adds progress. Smoke-free time adds bonus momentum. Smoking above baseline subtracts from your total score and can reduce your level.
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Full Level Structure</div>
              <div className="grid gap-3">
                {levelGuide.map((level) => {
                  const isCurrent = level.level === currentLevel;
                  const isUnlocked = level.level <= currentLevel;
                  const neededPoints = Math.max(level.requiredPoints - currentPoints, 0);

                  return (
                    <div
                      key={level.level}
                      className={`rounded-[1.25rem] border p-4 shadow-sm ${
                        isCurrent
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : isUnlocked
                            ? "border-amber-400/25 bg-amber-400/10"
                            : "border-foreground/10 bg-white/85"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">
                            Level {level.level} · {level.name}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{level.rewardTitle}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground">{level.requiredPoints} pts</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                            {level.finalCertificate ? "Certificate" : isCurrent ? "Current" : isUnlocked ? "Unlocked" : `${neededPoints} left`}
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

      <div className="mb-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Your Level Roadmap</div>
      </div>
      <GlassCard className="mb-6 overflow-hidden border border-black/10 px-4 py-4">
        <div className="rounded-[1.65rem] border border-black/10 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.24),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(34,197,94,0.14),_transparent_40%),linear-gradient(180deg,#fffdf7_0%,#f3ead8_100%)] p-4 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-foreground">15-Level Recovery Road</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">A live roadmap of your current level. Green means completed. Yellow means still ahead.</div>
            </div>
            <div className="rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground shadow-sm">
              L{currentLevel}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-700">
              Completed
            </div>
            <div className="rounded-full bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700">
              Upcoming
            </div>
            <div className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">
              Level 15 = Certificate
            </div>
          </div>

          <div className="mt-4 rounded-[1.55rem] border border-black/10 bg-[linear-gradient(180deg,#fffcf4_0%,#f8eedc_100%)] p-2 shadow-inner">
            <svg viewBox="0 0 348 404" className="h-[390px] w-full">
              <defs>
                <filter id="roadShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.12" />
                </filter>
                <filter id="circleGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="premiumGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
                </radialGradient>
              </defs>

              <circle cx="308" cy="70" r="42" fill="url(#premiumGlow)" opacity="0.45" />
              <circle cx="48" cy="332" r="50" fill="url(#premiumGlow)" opacity="0.3" />

              <motion.path
                d={roadmapPath}
                fill="none"
                stroke="#111111"
                strokeWidth="22"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#roadShadow)"
              />
              <motion.path
                d={roadmapPath}
                fill="none"
                stroke="#2b2b2b"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="12 10"
                animate={{ strokeDashoffset: [0, -44] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                opacity="0.65"
              />

              {roadmapProgress.map((point, index) => (
                <g key={point.level}>
                  {point.current ? (
                    <motion.circle
                      cx={point.x}
                      cy={point.y}
                      r="28"
                      fill="#22c55e"
                      opacity="0.18"
                      animate={{ scale: [1, 1.12, 1], opacity: [0.12, 0.22, 0.12] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : null}
                  <motion.circle
                    cx={point.x}
                    cy={point.y}
                    r="20"
                    fill={point.unlocked ? "#22c55e" : "#facc15"}
                    stroke="#111111"
                    strokeWidth="3.5"
                    filter="url(#circleGlow)"
                    animate={point.current ? { scale: [1, 1.08, 1] } : { y: [0, index % 2 === 0 ? -1.5 : 1.5, 0] }}
                    transition={point.current ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : { duration: 3 + (index % 3) * 0.35, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <text
                    x={point.x}
                    y={point.y + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="800"
                    fill="#111111"
                  >
                    {point.level}
                  </text>
                  <text
                    x={point.x + point.labelDx}
                    y={point.y + point.labelDy}
                    fontSize="9"
                    fontWeight="700"
                    fill="#4b5563"
                  >
                    L{point.level}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </GlassCard>

      {profile?.finalRewards?.isFinalLevel ? (
        <GlassCard glow="orange" className="mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/5">
              <Award className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Final Rewards</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{profile.finalRewards.badge?.name ?? "Freedom Badge"}</div>
              <div className="mt-1 text-xs text-muted-foreground">Premium badge, final certificate, and complete recovery report are now unlocked.</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Certificate ID</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{profile.finalRewards.certificate?.certificateId ?? "Ready to issue"}</div>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Verification</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{profile.finalRewards.certificate?.verificationCode ?? "Generated on download"}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Recovery Summary</div>
            <div className="mt-2 text-sm text-foreground">
              {profile.finalRewards.report?.achievementsUnlocked ?? 0} achievements unlocked, {profile.finalRewards.report?.totalCigarettesAvoided ?? 0} cigarettes avoided, and {formatMoney(profile.finalRewards.report?.totalMoneySaved ?? 0)} saved.
            </div>
          </div>

          <button
            onClick={() => void downloadCertificate()}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Download Premium Certificate
          </button>
        </GlassCard>
      ) : null}

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
