import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { useIntelligenceData } from "@/hooks/useIntelligenceData";
import { syncNativeVoiceAssistantCache } from "@/lib/native/voice-assistant";
import type { InsightsTab } from "./InsightsState";

const RoastTab = lazy(async () => ({ default: (await import("./RoastContent")).RoastContent }));
const SmokeDnaTab = lazy(async () => ({ default: (await import("./SmokeDnaPanel")).SmokeDnaPanel }));
const CravingAiTab = lazy(async () => ({ default: (await import("./CravingAiPanel")).CravingAiPanel }));

const tabs: Array<{ key: InsightsTab; label: string }> = [
  { key: "Roast", label: "Overview" },
  { key: "Smoke DNA", label: "Pattern" },
  { key: "Craving AI", label: "Prediction" },
];

class InsightsTabErrorBoundary extends Component<{ tabName: InsightsTab; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <GlassCard className="border border-foreground/10">
          <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{this.props.tabName}</div>
          <div className="mt-2 text-lg font-semibold text-foreground">This section couldn't load</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Something in this tab failed to render. Try refreshing the page, or switch to a different tab for now.
          </p>
          <button onClick={() => window.location.reload()} className="mt-4 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
            Try again
          </button>
        </GlassCard>
      );
    }

    return this.props.children;
  }
}

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-[2rem] bg-foreground/5" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-36 rounded-[2rem] bg-foreground/5" />
        <div className="h-36 rounded-[2rem] bg-foreground/5" />
      </div>
      <div className="h-64 rounded-[2rem] bg-foreground/5" />
    </div>
  );
}

export function InsightsHub({ initialTab = "Roast" }: { initialTab?: InsightsTab }) {
  const [activeTab, setActiveTab] = useState<InsightsTab>(initialTab);
  const [loadedTabs, setLoadedTabs] = useState<Record<InsightsTab, boolean>>({
    Roast: initialTab === "Roast",
    "Smoke DNA": initialTab === "Smoke DNA",
    "Craving AI": initialTab === "Craving AI",
    Voice: initialTab === "Voice",
  });
  const data = useIntelligenceData();

  useEffect(() => {
    setLoadedTabs((current) => (current[activeTab] ? current : { ...current, [activeTab]: true }));
  }, [activeTab]);

  useEffect(() => {
    void syncNativeVoiceAssistantCache({
      dashboard: data.dashboard,
      analytics: data.analytics,
      activity: data.activity.slice(0, 30),
      smokeDna: data.smokeDna,
      replayHistory: data.replayHistory.slice(0, 5),
      cravingHistory: data.cravingHistory.slice(0, 5),
      liveCraving: data.liveCraving,
      profileLabel: data.profileLabel,
    });
  }, [data.activity, data.analytics, data.cravingHistory, data.dashboard, data.liveCraving, data.profileLabel, data.replayHistory, data.smokeDna]);

  const radarData = useMemo(
    () => [
      { metric: "Stress", value: data.smokeDna?.moodCorrelation.stressed ?? Math.min(100, (data.dashboard?.dailyStatus.regretLevel ?? 40) + 12) },
      { metric: "Routine", value: data.smokeDna?.habitScore ?? Math.min(100, (data.dashboard?.stats.dailySmokingAverage ?? 4) * 8) },
      {
        metric: "Night",
        value: (() => {
          const nightValues = data.hourlyCraving.slice(18).map((item) => item.intensity);
          return nightValues.length ? Math.max(...nightValues) : 0;
        })(),
      },
      { metric: "Social", value: data.smokeDna?.moodCorrelation.social ?? Math.min(100, 35 + (data.dashboard?.stats.blockedBuys ?? 0) * 4) },
      { metric: "Heavy", value: data.smokeDna?.smokingIntensity ?? Math.min(100, (data.analytics?.peakSingleDay ?? 0) * 8) },
    ],
    [data.analytics?.peakSingleDay, data.dashboard?.dailyStatus.regretLevel, data.dashboard?.stats.blockedBuys, data.dashboard?.stats.dailySmokingAverage, data.hourlyCraving, data.smokeDna],
  );

  const dangerousWindow = useMemo(
    () => data.hourlyCraving.reduce((peak, current) => (current.intensity > peak.intensity ? current : peak), data.hourlyCraving[0] ?? { label: "22:00", intensity: 0 }),
    [data.hourlyCraving],
  );

  const insightCards = data.smokeDna?.insights?.length
    ? data.smokeDna.insights
    : [
        `Stress is linked to ${Math.min(89, (data.dashboard?.dailyStatus.regretLevel ?? 40) + 19)}% of your smoking sessions.`,
        data.liveCraving?.insightText ?? "Your cravings peak after meals and late at night.",
        `${data.dashboard?.stats.blockedBuys ?? 0} blocked purchases suggest impulse protection is actively helping.`,
      ];

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Insights</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Smoking Intelligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">Behavior analytics, craving forecasts, and Nova.</p>
      </div>

      {data.error ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {data.error}
        </div>
      ) : null}

      <div className="sticky top-4 z-20 mb-6">
        <div className="bg-transparent">
          <div className="grid grid-cols-3 gap-3">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative h-12 min-w-0 whitespace-nowrap rounded-full bg-black px-2 text-center text-[10px] font-semibold text-white shadow-sm transition-all hover:bg-black/90 ${
                    active ? "ring-2 ring-black/10" : ""
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="insights-tab"
                      className="absolute inset-0 rounded-full bg-white/10"
                      transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    />
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {data.isLoading && !loadedTabs[activeTab] ? <TabSkeleton /> : null}

      <div className="space-y-6">
        {loadedTabs.Roast ? (
          <div className={activeTab === "Roast" ? "block" : "hidden"}>
            <InsightsTabErrorBoundary tabName="Roast">
              <Suspense fallback={<TabSkeleton />}>
                <RoastTab />
              </Suspense>
            </InsightsTabErrorBoundary>
          </div>
        ) : null}

        {loadedTabs["Smoke DNA"] ? (
          <div className={activeTab === "Smoke DNA" ? "block" : "hidden"}>
            <InsightsTabErrorBoundary tabName="Smoke DNA">
              <Suspense fallback={<TabSkeleton />}>
                <SmokeDnaTab data={data} radarData={radarData} insightCards={insightCards} />
              </Suspense>
            </InsightsTabErrorBoundary>
          </div>
        ) : null}

        {loadedTabs["Craving AI"] ? (
          <div className={activeTab === "Craving AI" ? "block" : "hidden"}>
            <InsightsTabErrorBoundary tabName="Craving AI">
              <Suspense fallback={<TabSkeleton />}>
                <CravingAiTab
                  data={data}
                  dangerousWindow={dangerousWindow}
                />
              </Suspense>
            </InsightsTabErrorBoundary>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
