import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import {
  BarChart as ReBarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrainCircuit, Mic, MicOff, Radar as RadarIcon, Sparkles, Waves } from "lucide-react";
import toast from "react-hot-toast";
import { AnimatedNumber } from "@/components/lp/AnimatedNumber";
import { AppShell } from "@/components/lp/AppShell";
import { CircularMeter } from "@/components/lp/CircularMeter";
import { GlassCard } from "@/components/lp/GlassCard";
import { apiRequest } from "@/lib/api";
import { createCravingPrediction } from "@/lib/cravingApi";
import { buildVoiceReply } from "@/lib/intelligence";
import { createVoiceCommand } from "@/lib/intelligenceApi";
import { queryKeys } from "@/lib/query-keys";
import { useIntelligenceData } from "@/hooks/useIntelligenceData";

const tabs = ["Smoke DNA", "Smoke Replay", "Craving AI", "Voice Companion"] as const;
type IntelligenceTab = (typeof tabs)[number];

function HeatCell({ intensity }: { intensity: number }) {
  return (
    <div
      className="aspect-square rounded-xl"
      style={{
        background:
          intensity > 75
            ? "linear-gradient(180deg, rgba(15,23,42,0.95), rgba(51,65,85,0.95))"
            : intensity > 45
              ? "linear-gradient(180deg, rgba(100,116,139,0.85), rgba(148,163,184,0.85))"
              : "rgba(226,232,240,0.9)",
      }}
    />
  );
}

function IntelligenceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-[2rem] bg-foreground/5" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-36 rounded-[2rem] bg-foreground/5" />
        <div className="h-36 rounded-[2rem] bg-foreground/5" />
      </div>
      <div className="h-64 rounded-[2rem] bg-foreground/5" />
      <div className="h-40 rounded-[2rem] bg-foreground/5" />
    </div>
  );
}

export function IntelligenceHub() {
  const [activeTab, setActiveTab] = useState<IntelligenceTab>("Smoke DNA");
  const [replayIndex, setReplayIndex] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    dashboard,
    analytics,
    smokeDna,
    monthlyReplay,
    yearlyReplay,
    cravingHistory,
    liveCraving,
    voiceHistory,
    profileLabel,
    hourlyCraving,
    weeklyReplay,
    replayHeatmap,
    isLoading,
    error,
  } = useIntelligenceData();

  const {
    transcript,
    resetTranscript,
    listening,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const replaySlides = useMemo(
    () => [
      {
        key: "month",
        eyebrow: "Monthly replay",
        title: monthlyReplay?.title ?? "Your Replay",
        body: `${monthlyReplay?.analytics.cigarettesConsumed ?? analytics?.monthlyProjection ?? 0} cigarettes and ${analytics?.currencySymbol ?? "Rs"}${monthlyReplay?.analytics.moneyBurned ?? 0} burned this month.`,
      },
      {
        key: "money",
        eyebrow: "Yearly replay",
        title: `${analytics?.currencySymbol ?? "Rs"}${yearlyReplay?.analytics.moneyBurned ?? analytics?.annualSpend ?? 0} spent`,
        body: `Peak craving hour: ${yearlyReplay?.analytics.peakCravingHour ?? "unavailable"} with ${yearlyReplay?.analytics.cigarettesConsumed ?? 0} cigarettes tracked this year.`,
      },
      {
        key: "pattern",
        eyebrow: "Pattern spike",
        title: `${profileLabel} behavior detected`,
        body: smokeDna?.insights[0] ?? "Live Smoke DNA insights are being prepared from your backend data.",
      },
    ],
    [analytics, monthlyReplay, profileLabel, smokeDna?.insights, yearlyReplay],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setReplayIndex((current) => (current + 1) % replaySlides.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [replaySlides.length]);

  const voiceMutation = useMutation({
    mutationFn: async (command: string) => {
      const reply = buildVoiceReply(command, {
        dashboard,
        analytics,
        profileLabel,
      });

      const normalized = command.toLowerCase();
      let commandIntent = "general";

      if (normalized.includes("track") && normalized.includes("cigarette")) {
        commandIntent = "track-cigarette";
        await apiRequest("/api/cigarettes/log", {
          method: "POST",
          body: JSON.stringify({ cigarettesCount: 1, mood: "voice-tracked" }),
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
          queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
          queryClient.invalidateQueries({ queryKey: queryKeys.analytics }),
          queryClient.invalidateQueries({ queryKey: queryKeys.smokeReplayHistory }),
          queryClient.invalidateQueries({ queryKey: queryKeys.smokeReplayMonthly(new Date().getFullYear(), new Date().getMonth() + 1) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.smokeReplayYearly(new Date().getFullYear()) }),
        ]);
      } else if (normalized.includes("nearby") || normalized.includes("store")) {
        commandIntent = "nearby-stores";
        await navigate({ to: "/social" });
      } else if (normalized.includes("dna")) {
        commandIntent = "smoke-dna";
        setActiveTab("Smoke DNA");
      } else if (normalized.includes("predict") || normalized.includes("craving")) {
        commandIntent = "craving-ai";
        setActiveTab("Craving AI");
        await createCravingPrediction({ predictionWindow: "30m" });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.cravingHistory }),
          queryClient.invalidateQueries({ queryKey: queryKeys.cravingLive }),
        ]);
      }

      const saved = await createVoiceCommand({
        commandText: command,
        aiResponse: reply,
        commandIntent,
        executionStatus: "completed",
        metadata: {
          source: "voice-companion",
          activeTab,
        },
      });

      return { reply, saved };
    },
    onSuccess: ({ reply }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.voiceCommands });
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
      toast.success("Nova responded");
      resetTranscript();
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Nova could not complete that request.");
    },
  });

  const executeVoiceCommand = (command: string) => {
    const trimmed = command.trim();
    if (!trimmed) {
      toast.error("Say something first.");
      return;
    }
    voiceMutation.mutate(trimmed);
  };

  const radarData = useMemo(
    () => [
      { metric: "Stress", value: smokeDna?.moodCorrelation.stressed ?? Math.min(100, (dashboard?.dailyStatus.regretLevel ?? 40) + 12) },
      { metric: "Routine", value: smokeDna?.habitScore ?? Math.min(100, (dashboard?.stats.dailySmokingAverage ?? 4) * 8) },
      { metric: "Night", value: Math.max(...hourlyCraving.slice(18).map((item) => item.intensity)) },
      { metric: "Social", value: smokeDna?.moodCorrelation.social ?? Math.min(100, 35 + (dashboard?.stats.blockedBuys ?? 0) * 4) },
      { metric: "Heavy", value: smokeDna?.smokingIntensity ?? Math.min(100, (analytics?.peakSingleDay ?? 0) * 8) },
    ],
    [analytics?.peakSingleDay, dashboard?.dailyStatus.regretLevel, dashboard?.stats.blockedBuys, dashboard?.stats.dailySmokingAverage, hourlyCraving, smokeDna],
  );

  const dangerousWindow = useMemo(
    () => hourlyCraving.reduce((peak, current) => (current.intensity > peak.intensity ? current : peak), hourlyCraving[0] ?? { label: "22:00", intensity: 0 }),
    [hourlyCraving],
  );

  const insightCards = smokeDna?.insights?.length
    ? smokeDna.insights
    : [
        `Stress is linked to ${Math.min(89, (dashboard?.dailyStatus.regretLevel ?? 40) + 19)}% of your smoking sessions.`,
        liveCraving?.insightText ?? "Your cravings peak after meals and late at night.",
        `${dashboard?.stats.blockedBuys ?? 0} blocked purchases suggest impulse protection is actively helping.`,
      ];

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Intelligence</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">AI Smoking Intelligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">Behavior analytics, replay storytelling, craving forecasts, and your voice companion.</p>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <GlassCard className="mb-6 border border-foreground/10">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${active ? "text-primary-foreground" : "text-foreground"}`}
              >
                {active ? (
                  <motion.span
                    layoutId="intelligence-tab"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                ) : null}
                <span className="relative z-10">{tab}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {isLoading ? <IntelligenceSkeleton /> : null}

      {!isLoading ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
          >
            {activeTab === "Smoke DNA" ? (
              <div className="space-y-4">
                <GlassCard glow="orange" className="border border-foreground/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Smoking personality</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">{profileLabel}</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {smokeDna?.insights[0] ?? `You smoke ${(Math.max(...hourlyCraving.slice(21).map((item) => item.intensity)) - (hourlyCraving[9]?.intensity ?? 0)).toFixed(0)}% more after 9PM.`}
                      </p>
                    </div>
                    <Sparkles className="h-6 w-6 text-amber-500 animate-float" />
                  </div>
                </GlassCard>

                <div className="grid grid-cols-2 gap-3">
                  <GlassCard className="border border-foreground/10">
                    <CircularMeter value={dashboard?.dailyStatus.focusScore ?? smokeDna?.habitScore ?? 0} label="FOCUS" sub="discipline" size={130} color="oklch(0.68 0.16 75)" />
                  </GlassCard>
                  <GlassCard className="border border-foreground/10">
                    <CircularMeter value={dashboard?.dailyStatus.stabilityLevel ?? 0} label="MOOD" sub="stability" size={130} color="oklch(0.6 0.15 220)" />
                  </GlassCard>
                </div>

                <GlassCard className="border border-foreground/10">
                  <div className="mb-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Smoke DNA Radar</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">Behavior fingerprint</div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(15,23,42,0.12)" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: "#475569", fontSize: 11 }} />
                        <Radar dataKey="value" stroke="#111827" fill="#111827" fillOpacity={0.24} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                <GlassCard className="border border-foreground/10">
                  <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">AI Insight Cards</div>
                  <div className="grid gap-3">
                    {insightCards.map((insight, index) => (
                      <motion.div
                        key={insight}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className="rounded-2xl border border-foreground/10 bg-background px-4 py-4"
                      >
                        <div className="text-sm text-foreground">{insight}</div>
                      </motion.div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            ) : null}

            {activeTab === "Smoke Replay" ? (
              <div className="space-y-4">
                <GlassCard glow="orange" className="min-h-[16rem] border border-foreground/10">
                  <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{replaySlides[replayIndex]?.eyebrow}</div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={replaySlides[replayIndex]?.key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.35 }}
                      className="mt-5"
                    >
                      <div className="text-3xl font-semibold tracking-tight text-foreground">{replaySlides[replayIndex]?.title}</div>
                      <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">{replaySlides[replayIndex]?.body}</p>
                    </motion.div>
                  </AnimatePresence>
                  <div className="mt-6 flex gap-2">
                    {replaySlides.map((slide, index) => (
                      <button
                        key={slide.key}
                        onClick={() => setReplayIndex(index)}
                        className={`h-2 rounded-full transition-all ${replayIndex === index ? "w-10 bg-primary" : "w-4 bg-foreground/15"}`}
                      />
                    ))}
                  </div>
                </GlassCard>

                <div className="grid grid-cols-2 gap-3">
                  <GlassCard className="border border-foreground/10">
                    <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Cigarettes</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground"><AnimatedNumber value={monthlyReplay?.analytics.cigarettesConsumed ?? 0} /></div>
                  </GlassCard>
                  <GlassCard className="border border-foreground/10">
                    <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Money Burned</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      <AnimatedNumber value={yearlyReplay?.analytics.moneyBurned ?? 0} prefix={analytics?.currencySymbol ?? "Rs"} />
                    </div>
                  </GlassCard>
                </div>

                <GlassCard className="border border-foreground/10">
                  <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Weekly replay</div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReBarChart data={weeklyReplay}>
                        <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.08)" />
                        <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip />
                        <Bar dataKey="value" radius={[12, 12, 4, 4]} fill="#111827" />
                      </ReBarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                <GlassCard className="border border-foreground/10">
                  <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Smoking calendar heatmap</div>
                  <div className="grid grid-cols-7 gap-2">
                    {replayHeatmap.flat().map((cell) => (
                      <HeatCell key={cell.key} intensity={cell.intensity} />
                    ))}
                  </div>
                </GlassCard>

                {replayHistory.length ? (
                  <GlassCard className="border border-foreground/10">
                    <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Saved replays</div>
                    <div className="space-y-3">
                      {replayHistory.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-foreground/10 bg-background px-4 py-4">
                          <div className="text-sm font-semibold text-foreground">{item.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{item.periodStart} to {item.periodEnd}</div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                ) : null}
              </div>
            ) : null}

            {activeTab === "Craving AI" ? (
              <div className="space-y-4">
                <GlassCard glow="red" className="border border-foreground/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Prediction engine</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">High craving probability</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {liveCraving?.insightText ?? `Danger window detected around ${dangerousWindow.label}. Probability elevated for the next 30 minutes.`}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
                      <RadarIcon className="h-5 w-5 text-red-500 animate-danger-pulse" />
                    </div>
                  </div>
                </GlassCard>

                <div className="grid grid-cols-2 gap-3">
                  <GlassCard className="border border-foreground/10">
                    <CircularMeter value={liveCraving?.cravingProbability ?? dangerousWindow.intensity} label="RISK" sub="next craving" size={130} color="oklch(0.65 0.18 30)" />
                  </GlassCard>
                  <GlassCard className="border border-foreground/10">
                    <CircularMeter value={liveCraving?.intensityScore ?? Math.min(100, (dashboard?.dailyStatus.regretLevel ?? 0) + 18)} label="STRESS" sub="trigger load" size={130} color="oklch(0.62 0.16 15)" />
                  </GlassCard>
                </div>

                <GlassCard className="border border-foreground/10">
                  <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Craving forecast by hour</div>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hourlyCraving}>
                        <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.08)" />
                        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} interval={3} axisLine={false} tickLine={false} />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="intensity" stroke="#111827" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                <GlassCard className="border border-foreground/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-background p-4">
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Dangerous hours</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">{dangerousWindow.label} - 23:30</div>
                    </div>
                    <div className="rounded-2xl bg-background p-4">
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Primary trigger</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">{liveCraving?.triggerPrediction.primary ?? "Routine loop"}</div>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="border border-foreground/10">
                  <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Prediction history</div>
                  <div className="space-y-3">
                    {cravingHistory.length ? cravingHistory.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-foreground/10 bg-background px-4 py-4">
                        <div className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">{new Date(item.createdAt).toLocaleString("en-IN")}</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">{item.insightText}</div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-foreground/10 bg-background px-4 py-6 text-sm text-muted-foreground">
                        No saved craving predictions yet.
                      </div>
                    )}
                  </div>
                </GlassCard>
              </div>
            ) : null}

            {activeTab === "Voice Companion" ? (
              <div className="space-y-4">
                <GlassCard glow="cyan" className="border border-foreground/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Nova</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">Voice Companion</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Ask Nova to track a cigarette, jump to nearby stores, open your Smoke DNA, or predict cravings.
                      </p>
                    </div>
                    <BrainCircuit className="h-6 w-6 text-sky-600 animate-float" />
                  </div>

                  <div className="mt-5 rounded-[1.75rem] border border-foreground/10 bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Listening</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{listening ? "Nova is listening" : "Tap the mic to speak"}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (listening) {
                            SpeechRecognition.stopListening();
                          } else {
                            SpeechRecognition.startListening({ continuous: false, language: "en-IN" }).catch(() => {
                              toast.error("Voice recognition is unavailable on this device.");
                            });
                          }
                        }}
                        disabled={!browserSupportsSpeechRecognition}
                        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${listening ? "bg-primary text-primary-foreground shadow-[0_0_0_12px_rgba(15,23,42,0.08)]" : "bg-background text-foreground"}`}
                      >
                        {listening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-foreground/10 bg-card px-4 py-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                        <Waves className="h-4 w-4" />
                        Live transcript
                      </div>
                      <div className="mt-2 text-sm text-foreground">{transcript || "Try: Track my cigarette"}</div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => executeVoiceCommand(transcript)}
                          className="rounded-full bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground"
                        >
                          {voiceMutation.isPending ? "Saving..." : "Run Command"}
                        </button>
                        <button
                          onClick={() => resetTranscript()}
                          className="rounded-full border border-foreground/10 bg-background px-4 py-3 text-xs font-semibold text-foreground"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="border border-foreground/10">
                  <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Supported commands</div>
                  <div className="grid gap-2">
                    {[
                      "Track my cigarette",
                      "Show nearby stores",
                      "How much did I spend today?",
                      "Show my smoking DNA",
                      "Predict my cravings",
                    ].map((command) => (
                      <button
                        key={command}
                        onClick={() => executeVoiceCommand(command)}
                        className="rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                      >
                        {command}
                      </button>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="border border-foreground/10">
                  <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Voice history</div>
                  <div className="space-y-3">
                    {voiceHistory.length ? voiceHistory.slice(0, 5).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-foreground/10 bg-background px-4 py-4">
                        <div className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">{item.commandText}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{item.aiResponse}</div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-foreground/10 bg-background px-4 py-6 text-sm text-muted-foreground">
                        No voice commands yet. Nova is waiting.
                      </div>
                    )}
                  </div>
                </GlassCard>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      ) : null}
    </AppShell>
  );
}
