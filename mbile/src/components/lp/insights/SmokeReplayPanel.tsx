import { AnimatePresence, motion } from "framer-motion";
import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/lp/GlassCard";
import { AnimatedNumber } from "@/components/lp/AnimatedNumber";
import type { InsightsSharedData } from "./InsightsState";

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

export function SmokeReplayPanel({
  data,
  replaySlides,
  replayIndex,
  setReplayIndex,
}: {
  data: InsightsSharedData;
  replaySlides: Array<{ key: string; eyebrow: string; title: string; body: string }>;
  replayIndex: number;
  setReplayIndex: (index: number) => void;
}) {
  return (
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
          <div className="mt-2 text-2xl font-semibold text-foreground"><AnimatedNumber value={data.monthlyReplay?.analytics.cigarettesConsumed ?? 0} /></div>
        </GlassCard>
        <GlassCard className="border border-foreground/10">
          <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Money Burned</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            <AnimatedNumber value={data.yearlyReplay?.analytics.moneyBurned ?? 0} prefix={data.analytics?.currencySymbol ?? "Rs"} />
          </div>
        </GlassCard>
      </div>

      <GlassCard className="border border-foreground/10">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Weekly replay</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ReBarChart data={data.weeklyReplay}>
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
          {data.replayHeatmap.flat().map((cell) => (
            <HeatCell key={cell.key} intensity={cell.intensity} />
          ))}
        </div>
      </GlassCard>

      {data.replayHistory.length ? (
        <GlassCard className="border border-foreground/10">
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Saved replays</div>
          <div className="space-y-3">
            {data.replayHistory.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-2xl border border-foreground/10 bg-background px-4 py-4">
                <div className="text-sm font-semibold text-foreground">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.periodStart} to {item.periodEnd}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
