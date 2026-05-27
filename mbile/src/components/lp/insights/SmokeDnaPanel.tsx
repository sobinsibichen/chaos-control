import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { CircularMeter } from "@/components/lp/CircularMeter";
import { GlassCard } from "@/components/lp/GlassCard";
import type { InsightsSharedData } from "./InsightsState";

export function SmokeDnaPanel({
  data,
  radarData,
  insightCards,
}: {
  data: InsightsSharedData;
  radarData: Array<{ metric: string; value: number }>;
  insightCards: string[];
}) {
  return (
    <div className="space-y-4">
      <GlassCard glow="orange" className="border border-foreground/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Smoking personality</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{data.profileLabel}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.smokeDna?.insights[0] ?? `You smoke ${(Math.max(...data.hourlyCraving.slice(21).map((item) => item.intensity)) - (data.hourlyCraving[9]?.intensity ?? 0)).toFixed(0)}% more after 9PM.`}
            </p>
          </div>
          <Sparkles className="h-6 w-6 animate-float text-amber-500" />
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="border border-foreground/10">
          <CircularMeter value={data.dashboard?.dailyStatus.focusScore ?? data.smokeDna?.habitScore ?? 0} label="FOCUS" sub="discipline" size={130} color="oklch(0.68 0.16 75)" />
        </GlassCard>
        <GlassCard className="border border-foreground/10">
          <CircularMeter value={data.dashboard?.dailyStatus.stabilityLevel ?? 0} label="MOOD" sub="stability" size={130} color="oklch(0.6 0.15 220)" />
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
  );
}
