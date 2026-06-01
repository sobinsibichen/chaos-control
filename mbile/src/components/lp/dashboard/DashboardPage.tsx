import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Brain, Cigarette, Flame, Mic, Radar, Search, ShieldCheck, Sparkles, TimerReset, TrendingDown, Trophy, Wind, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AIOrb } from "@/components/lp/AIOrb";
import { AppShell } from "@/components/lp/AppShell";
import { CircularMeter } from "@/components/lp/CircularMeter";
import { GlassCard } from "@/components/lp/GlassCard";
import { StatTile } from "@/components/lp/StatTile";
import { apiRequest } from "@/lib/api";
import { appStore, useAppStore } from "@/lib/app-store";
import { readLocalQueryCache, writeLocalQueryCache } from "@/lib/local-query-cache";
import { queryKeys } from "@/lib/query-keys";
import { sampleMemory, useRenderCounter, useScreenPerformance } from "@/lib/performance";
import { formatSmokeFree, useSmokeFreeTicker } from "@/lib/time";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

const funnyMessages = [
  "Your lighter is crying.",
  "Nicotine has left the chat.",
  "Philip Morris dislikes this.",
  "Your lungs just smiled.",
  "Breaking up with cigarettes?",
  "Villain redemption arc started.",
  "Your future self approves.",
  "The old habit is losing signal.",
];

interface DashboardPayload {
  user: { id: number; name: string; email: string; cigarettePrice: number; visibilityEnabled: boolean };
  dailyStatus: { regretLevel: number; stabilityLevel: number; focusLevel: string; focusScore: number; score: number; recoveryStage: string };
  smokeFree: { startedAt: string | null; seconds: number };
  streak: { current: number; highest: number };
  level: {
    current: number;
    name: string;
    rewardTitle: string;
    next: { level: number; name: string; requiredPoints: number } | null;
    progressPercent: number;
  };
  lungs: { percent: number; stage: string };
  savings: { today: number; weekly: number; total: number; avoidedToday: number; avoidedTotal: number };
  stats: {
    todayCount: number;
    quitsCount: number;
    totalCigarettes: number;
    moneyBurned: number;
    blockedBuys: number;
    focusLevel: string;
    dailySmokingAverage: number;
    cigarettePrice: number;
    longestSmokeFreeSeconds: number;
  };
  notifications: Array<{ type: string; title: string; description: string; level?: number }>;
  activity?: ActivityRow[];
}

type DashboardResponse = { success: boolean } & DashboardPayload;

interface ActivityRow {
  id: number;
  activity_type: string;
  title: string;
  description: string;
  created_at: string;
}

const ACTIVITY_CACHE_KEY = "last-puff-recent-activity";
const DASHBOARD_CACHE_KEY = "last-puff-dashboard-cache";
const DASHBOARD_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const ACTIVITY_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const activityIconMap = {
  cigarette_logged: Cigarette,
  quit_started: TimerReset,
  smoke_free_milestone: ShieldCheck,
  achievement_unlocked: Trophy,
  level_up: Award,
  smoke_dna_updated: Brain,
  smoke_dna_created: Brain,
  radar_scan: Radar,
  schedule_updated: ShieldCheck,
  blocked_app_toggled: ShieldCheck,
  blocked_apps_saved: ShieldCheck,
  blocked_app_added: ShieldCheck,
  voice_command_created: Mic,
  streak_milestone: Flame,
  recovery_milestone: Wind,
  lung_recovery_milestone: Wind,
  spending_saved_milestone: TrendingDown,
  final_level_unlocked: Trophy,
  final_reward: Award,
  daily_goal_completed: Sparkles,
  weekly_target_completed: Sparkles,
} as const;

function ViewportPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export function DashboardPage() {
  useRenderCounter("DashboardPage");
  const queryClient = useQueryClient();
  const user = useAppStore((value) => value.auth.user);
  const hydrated = useAppStore((value) => value.meta.hydrated);
  const isAuthenticated = useAppStore((value) => value.auth.isAuthenticated);
  const [errorMessage, setErrorMessage] = useState("");
  const [quitStep, setQuitStep] = useState<0 | 1 | 2>(0);
  const [funnyMessage, setFunnyMessage] = useState(funnyMessages[0]);
  const [popup, setPopup] = useState<{ type: "level" | "final"; title: string; description: string } | null>(null);
  const [cachedActivity, setCachedActivity] = useState<ActivityRow[]>([]);
  const previousLevelRef = useRef<number | null>(null);
  useBodyScrollLock(quitStep > 0 || Boolean(popup));
  const cachedDashboardQuery = useMemo(
    () => readLocalQueryCache<DashboardResponse>(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_MAX_AGE_MS),
    [],
  );
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiRequest<DashboardResponse>("/api/stats/dashboard"),
    enabled: hydrated && isAuthenticated,
    refetchInterval: 60000,
    staleTime: 0,
    initialData: cachedDashboardQuery?.data,
    initialDataUpdatedAt: cachedDashboardQuery?.updatedAt,
  });

  useEffect(() => {
    if (dashboardQuery.data) {
      writeLocalQueryCache(DASHBOARD_CACHE_KEY, dashboardQuery.data);
      if (dashboardQuery.data.activity?.length && typeof window !== "undefined") {
        const latest = dashboardQuery.data.activity.slice(0, 5);
        setCachedActivity(latest);
        queryClient.setQueryData(queryKeys.activity, { success: true, activity: latest });
        window.localStorage.setItem(ACTIVITY_CACHE_KEY, JSON.stringify(latest));
      }
    }
  }, [dashboardQuery.data, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(ACTIVITY_CACHE_KEY);
      if (raw) {
        setCachedActivity(JSON.parse(raw) as ActivityRow[]);
      }
    } catch {
      setCachedActivity([]);
    }
  }, []);

  const dashboard = dashboardQuery.data;
  useScreenPerformance("dashboard", Boolean(dashboard));
  const smokeFreeSeconds = useSmokeFreeTicker(dashboard?.smokeFree.startedAt ?? null);

  useEffect(() => {
    if (dashboard) {
      sampleMemory("dashboard-ready");
    }
  }, [dashboard]);

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    appStore.updateUser({
      id: dashboard.user.id,
      username: dashboard.user.name,
      email: dashboard.user.email,
      avatar: dashboard.user.name.slice(0, 1).toUpperCase(),
      cigarettePrice: dashboard.user.cigarettePrice,
      visibilityEnabled: dashboard.user.visibilityEnabled,
    });

    const previousLevel = previousLevelRef.current;
    if (previousLevel !== null && dashboard.level.current > previousLevel) {
      if (dashboard.level.current >= 15) {
        setPopup({
          type: "final",
          title: "SMOKING GONE FROM MY LIFE",
          description: "Level 15 reached. This habit no longer owns the room.",
        });
      } else {
        setPopup({
          type: "level",
          title: `LEVEL ${dashboard.level.current} UNLOCKED`,
          description: dashboard.level.rewardTitle || dashboard.level.name,
        });
      }
    }

    previousLevelRef.current = dashboard.level.current;
  }, [dashboard]);

  const recordMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean; message?: string; dashboard?: DashboardResponse }>("/api/cigarettes/log", {
        method: "POST",
        body: JSON.stringify({ cigarettesCount: 1, mood: "tracked" }),
    }),
    onMutate: async () => {
      setErrorMessage("");
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboard });
      const previous = queryClient.getQueryData<DashboardResponse>(queryKeys.dashboard);

      if (previous) {
        queryClient.setQueryData<DashboardResponse>(queryKeys.dashboard, {
          ...previous,
          smokeFree: { startedAt: null, seconds: 0 },
          streak: { ...previous.streak, current: 0 },
          lungs: { ...previous.lungs, percent: 0 },
          stats: {
            ...previous.stats,
            todayCount: previous.stats.todayCount + 1,
            totalCigarettes: previous.stats.totalCigarettes + 1,
          },
        });
      }

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.dashboard, context.previous);
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to log cigarette.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });

  const quitMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean; message?: string; dashboard?: DashboardResponse }>("/api/cigarettes/quit", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onMutate: async () => {
      setErrorMessage("");
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboard });
      const previous = queryClient.getQueryData<DashboardResponse>(queryKeys.dashboard);

      if (previous) {
        queryClient.setQueryData<DashboardResponse>(queryKeys.dashboard, {
          ...previous,
          smokeFree: { startedAt: new Date().toISOString(), seconds: 0 },
          streak: { ...previous.streak, current: 0 },
        });
      }

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.dashboard, context.previous);
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to start quit attempt.");
    },
    onSuccess: (response) => {
      const nextDashboard = response.dashboard;
      if (nextDashboard) {
        queryClient.setQueryData<DashboardResponse>(queryKeys.dashboard, nextDashboard);
        appStore.updateUser({
          id: nextDashboard.user.id,
          username: nextDashboard.user.name,
          email: nextDashboard.user.email,
          avatar: nextDashboard.user.name.slice(0, 1).toUpperCase(),
          cigarettePrice: nextDashboard.user.cigarettePrice,
          visibilityEnabled: nextDashboard.user.visibilityEnabled,
        });
      }
      setQuitStep(0);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });

  const formatMoney = (value: number) => `Rs${Math.round(value).toLocaleString("en-IN")}`;
  const formatTime = (value: string) => {
    const date = new Date(value);
    const now = Date.now();
    const diffMinutes = Math.max(0, Math.floor((now - date.getTime()) / 60000));
    if (diffMinutes < 1) {
      return "Just now";
    }
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const message =
    dashboard?.streak.current
      ? `Your future self says ${dashboard.streak.current} points looks good on you.`
      : dashboard?.stats.todayCount
        ? "Every cigarette logged is a real datapoint. Recovery starts with honesty."
        : "Quiet day. Keep the streak gentle and alive.";

  const activity = (dashboard?.activity?.length ? dashboard.activity : cachedActivity).slice(0, 5);

  return (
    <AppShell>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="text-base font-semibold text-foreground">Hello, {user?.username.split(" ")[0] ?? "there"}.</div>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
        </div>
        <button className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 bg-card shadow-sm">
          <span className="text-sm font-semibold text-foreground">{user?.avatar ?? "V"}</span>
        </button>
      </div>

      <div className="glass mb-6 flex items-center gap-3 rounded-full border border-foreground/10 px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          readOnly
          value=""
          placeholder="Search your progress..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Today's Overview</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Your Progress</h1>
      </div>

      <div className="mb-6">
        <AIOrb message={message} />
      </div>

      <GlassCard glow="orange" className="mb-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Daily Status</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">{dashboard?.dailyStatus.recoveryStage ?? "Tracking live"}</div>
          </div>
          <div className="rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Live
          </div>
        </div>
        <div className="flex items-center gap-5">
          <CircularMeter value={dashboard?.dailyStatus.focusScore ?? 0} label="FOCUS" sub={dashboard?.dailyStatus.focusLevel?.toLowerCase() ?? "loading"} />
          <div className="flex-1 space-y-4">
            {[
              { label: "Regret Level", value: `${dashboard?.dailyStatus.regretLevel ?? 0}%`, accent: "text-orange-400" },
              { label: "Stability", value: `${dashboard?.dailyStatus.stabilityLevel ?? 0}%`, accent: "text-cyan-400" },
              { label: "Status", value: dashboard?.dailyStatus.focusLevel ?? "Loading", accent: "text-primary" },
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
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Track Cigarette</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">Log a cigarette</div>
          </div>
          <Cigarette className="mt-1 h-5 w-5 animate-float text-primary" />
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => recordMutation.mutate()}
          disabled={recordMutation.isPending}
          className="relative w-full overflow-hidden rounded-2xl bg-primary px-5 py-3 text-sm font-semibold tracking-wide text-primary-foreground shadow-[0_16px_34px_rgba(15,23,42,0.16)] transition-all hover:bg-primary/90"
        >
          <span className="relative">{recordMutation.isPending ? "Saved locally..." : "Record Cigarette"}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            setFunnyMessage(funnyMessages[Math.floor(Math.random() * funnyMessages.length)] || funnyMessages[0]);
            setQuitStep(1);
          }}
          className="mt-3 relative w-full overflow-hidden rounded-2xl bg-black px-5 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_16px_34px_rgba(15,23,42,0.2)] transition-all hover:bg-black/90"
        >
          <span className="relative">I'M QUITTING</span>
        </motion.button>

        {errorMessage ? <div className="mt-3 text-sm text-red-500">{errorMessage}</div> : null}

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Today", value: dashboard?.stats.todayCount ?? 0, accent: "text-amber-600" },
            { label: "Streak", value: dashboard?.streak.current ?? 0, accent: "text-fuchsia-600" },
            { label: "Level", value: dashboard?.level.current ?? 1, accent: "text-sky-600" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-foreground/10 bg-card px-3 py-3 text-center shadow-sm">
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{item.label}</div>
              <div className={`mt-2 text-lg font-semibold ${item.accent}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Smoke Free</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{formatSmokeFree(smokeFreeSeconds)}</div>
          </div>
          <TimerReset className="h-5 w-5 text-primary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Avoided Today</div>
            <div className="mt-2 text-lg font-semibold text-foreground">{dashboard?.savings.avoidedToday ?? 0} cigs</div>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Highest Streak</div>
            <div className="mt-2 text-lg font-semibold text-foreground">{dashboard?.streak.highest ?? 0}</div>
          </div>
        </div>
      </GlassCard>

      <div className="mb-6 grid grid-cols-2 gap-3.5">
        <StatTile icon={Flame} label="Money Burned" value={formatMoney(dashboard?.stats.moneyBurned ?? 0)} sub="all time" accent="orange" delay={0.05} />
        <StatTile icon={TrendingDown} label="Today Savings" value={formatMoney(dashboard?.savings.today ?? 0)} sub="live" accent="cyan" delay={0.1} />
        <StatTile icon={Zap} label="Weekly Savings" value={formatMoney(dashboard?.savings.weekly ?? 0)} sub="tracked" accent="green" delay={0.15} />
        <StatTile icon={Brain} label="Focus" value={dashboard?.dailyStatus.focusLevel ?? "HIGH"} sub={`${dashboard?.stats.cigarettePrice ?? user?.cigarettePrice ?? 20}/cig`} accent="pink" delay={0.2} />
        <StatTile icon={Wind} label="Lungs" value={`${dashboard?.lungs.percent ?? 0}%`} sub={dashboard?.lungs.stage ?? "recovering"} accent="purple" delay={0.25} />
        <StatTile icon={ShieldCheck} label="Blocked Buys" value={String(dashboard?.stats.blockedBuys ?? 0)} sub="protected" accent="red" delay={0.3} />
      </div>

      <GlassCard className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">🫁 Lungs Recovering</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{dashboard?.lungs.stage ?? "Oxygen improving"}</div>
          </div>
          <div className="text-sm font-semibold text-primary">{dashboard?.lungs.percent ?? 0}%</div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-foreground/8">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${dashboard?.lungs.percent ?? 0}%` }}
            transition={{ duration: 1 }}
            className="h-full rounded-full bg-gradient-to-r from-stone-300 via-stone-500 to-stone-900"
          />
        </div>
      </GlassCard>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Recent Activity</div>
        <span className="text-xs text-muted-foreground">Last 5 events</span>
      </div>
      <div className="space-y-3">
        {(activity.length
          ? activity
          : [{ id: 0, activity_type: "empty", title: "No activity yet", description: "Your activity feed will appear here after your first actions.", created_at: new Date().toISOString() }]).map((row, index) => {
          const Icon = activityIconMap[row.activity_type as keyof typeof activityIconMap] || Sparkles;
          return (
          <motion.div
            key={row.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.08 }}
            className="glass flex items-center gap-3 rounded-2xl border border-foreground/10 p-4"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5 ${index === 0 ? "text-emerald-600" : index % 2 === 0 ? "text-amber-600" : "text-rose-600"}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{row.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{row.description}</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{formatTime(row.created_at)}</div>
            </div>
          </motion.div>
        )})}
      </div>

      <ViewportPortal>
        <AnimatePresence>
          {quitStep > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm"
            >
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 20, opacity: 0, scale: 0.96 }}
                className="w-full max-w-sm rounded-[2rem] border border-white/20 bg-white/80 p-6 text-center shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl"
              >
                {quitStep === 1 ? (
                  <>
                    <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">ARE YOU SURE?</div>
                    <div className="mt-3 text-2xl font-semibold text-foreground">This cigarette thinks you'll come back.</div>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setQuitStep(2)}
                        className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
                      >
                        YES
                      </button>
                      <button
                        onClick={() => setQuitStep(0)}
                        className="rounded-2xl border border-foreground/10 bg-card px-4 py-3 text-sm font-semibold text-foreground"
                      >
                        CANCEL
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">ONE MORE CHECK</div>
                    <div className="mt-3 text-2xl font-semibold text-foreground">{funnyMessage}</div>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button
                        onClick={() => quitMutation.mutate()}
                        className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
                      >
                        {quitMutation.isPending ? "Starting..." : "YES I'M DONE"}
                      </button>
                      <button
                        onClick={() => setQuitStep(0)}
                        className="rounded-2xl border border-foreground/10 bg-card px-4 py-3 text-sm font-semibold text-foreground"
                      >
                        maybe later
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {popup ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 z-[70] flex items-center justify-center px-6 ${popup.type === "final" ? "bg-black/65" : "pointer-events-none"}`}
              onClick={() => setPopup(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className={`relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/90 p-8 text-center shadow-[0_24px_64px_rgba(15,23,42,0.2)] backdrop-blur-xl ${popup.type === "final" ? "w-full max-w-md" : "max-w-sm"}`}
              >
                {popup.type === "final" ? (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_55%)]" />
                ) : null}
                <div className="relative">
                  <motion.div
                    animate={popup.type === "final" ? { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.8] } : { scale: [1, 1.04, 1] }}
                    transition={{ duration: 2.4, repeat: Infinity }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black text-white"
                  >
                    <Trophy className="h-7 w-7" />
                  </motion.div>
                  <div className="mt-4 text-2xl font-semibold text-foreground">{popup.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{popup.description}</div>
                  <button
                    onClick={() => setPopup(null)}
                    className="mt-6 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                  >
                    Keep going
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ViewportPortal>
    </AppShell>
  );
}
