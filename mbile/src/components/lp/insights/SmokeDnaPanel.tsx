import { motion } from "framer-motion";
import { Clock, Flame, Sparkles, TrendingDown } from "lucide-react";
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
  const engine = data.patternPrediction;

  return (
    <div className="space-y-4">
      <GlassCard glow="orange" className="border border-foreground/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Smoking personality</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{engine.behaviorProfile}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {engine.explanation} {engine.dataDays ? `${engine.dataDays} dated day${engine.dataDays === 1 ? "" : "s"} currently feed the model.` : "The model is waiting for dated logs."}
            </p>
          </div>
          <Sparkles className="h-6 w-6 animate-float text-amber-500" />
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="border border-foreground/10">
          <CircularMeter value={engine.scores.quitSuccess} label="QUIT" sub="success" size={130} color="oklch(0.68 0.16 75)" />
        </GlassCard>
        <GlassCard className="border border-foreground/10">
          <CircularMeter value={engine.scores.triggerLoad} label="TRIGGER" sub="load" size={130} color="oklch(0.6 0.15 220)" />
        </GlassCard>
      </div>

      <div className="grid gap-3">
        {engine.patternCards.map((card, index) => {
          const Icon = index === 0 ? Clock : index === 2 ? Flame : TrendingDown;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GlassCard className="border border-foreground/10 !p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-inner">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{card.title}</div>
                      <div className="rounded-full border border-foreground/10 bg-white/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{card.confidence}</div>
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">{card.value}</div>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{card.detail}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
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
          {engine.aiInsights.concat(insightCards.slice(0, 1)).map((insight, index) => (
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
