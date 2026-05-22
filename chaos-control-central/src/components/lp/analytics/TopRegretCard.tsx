import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/lp/GlassCard";
import { AnimatedNumber } from "@/components/lp/AnimatedNumber";

interface TopRegretCardProps {
  icon: LucideIcon;
  title: string;
  value: number | string;
  suffix?: string;
  subtitle: string;
  accent: "orange" | "purple" | "red" | "green" | "cyan" | "pink";
  index: number;
}

const accentClasses = {
  orange: "text-amber-600",
  purple: "text-fuchsia-600",
  red: "text-rose-600",
  green: "text-emerald-600",
  cyan: "text-sky-600",
  pink: "text-pink-600",
};

export function TopRegretCard({ icon: Icon, title, value, suffix, subtitle, accent, index }: TopRegretCardProps) {
  const accentClass = accentClasses[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
    >
      <GlassCard className="border border-foreground/10">
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/5 ${accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-foreground">{title}</div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {typeof value === "number" ? <AnimatedNumber value={value} suffix={suffix} /> : value}
            </div>
            <div className="mt-2 text-sm text-foreground">{subtitle}</div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
