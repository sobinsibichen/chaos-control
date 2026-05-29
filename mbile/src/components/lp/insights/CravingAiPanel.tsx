import { Radar as RadarIcon, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CircularMeter } from "@/components/lp/CircularMeter";
import { GlassCard } from "@/components/lp/GlassCard";
import type { InsightsSharedData } from "./InsightsState";

export function CravingAiPanel({
  data,
  dangerousWindow,
  onGeneratePrediction,
  generatingPrediction,
}: {
  data: InsightsSharedData;
  dangerousWindow: { label: string; intensity: number };
  onGeneratePrediction?: () => void;
  generatingPrediction?: boolean;
}) {
  const hourlyCraving = data.hourlyCraving.length
    ? data.hourlyCraving
    : Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        intensity: 0,
      }));
  const riskValue = Number.isFinite(data.liveCraving?.cravingProbability ?? dangerousWindow.intensity)
    ? Math.max(0, Math.min(100, data.liveCraving?.cravingProbability ?? dangerousWindow.intensity))
    : 0;
  const stressValue = Number.isFinite(data.liveCraving?.intensityScore ?? Math.min(100, (data.dashboard?.dailyStatus.regretLevel ?? 0) + 18))
    ? Math.max(0, Math.min(100, data.liveCraving?.intensityScore ?? Math.min(100, (data.dashboard?.dailyStatus.regretLevel ?? 0) + 18)))
    : 0;
  const dangerousLabel = dangerousWindow.label || "22:00";
  const triggerPrimary = data.liveCraving?.triggerPrediction.primary ?? "Routine loop";

  return (
    <div className="space-y-4">
      <GlassCard glow="red" className="border border-foreground/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Prediction engine</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">High craving probability</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.liveCraving?.insightText ?? `Danger window detected around ${dangerousLabel}. Probability elevated for the next 30 minutes.`}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
            <RadarIcon className="h-5 w-5 animate-danger-pulse text-red-500" />
          </div>
        </div>
        {onGeneratePrediction ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onGeneratePrediction}
            disabled={Boolean(generatingPrediction)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-foreground/10 bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${generatingPrediction ? "animate-spin" : ""}`} />
            {generatingPrediction ? "Generating prediction..." : "Refresh prediction"}
          </motion.button>
        ) : null}
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="border border-foreground/10">
          <CircularMeter value={riskValue} label="RISK" sub="next craving" size={130} color="oklch(0.65 0.18 30)" />
        </GlassCard>
        <GlassCard className="border border-foreground/10">
          <CircularMeter value={stressValue} label="STRESS" sub="trigger load" size={130} color="oklch(0.62 0.16 15)" />
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
            <div className="mt-2 text-lg font-semibold text-foreground">{dangerousLabel} - 23:30</div>
          </div>
          <div className="rounded-2xl bg-background p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Primary trigger</div>
            <div className="mt-2 text-lg font-semibold text-foreground">{triggerPrimary}</div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border border-foreground/10">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Prediction history</div>
        <div className="space-y-3">
          {data.cravingHistory.length ? data.cravingHistory.slice(0, 4).map((item) => (
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
  );
}
