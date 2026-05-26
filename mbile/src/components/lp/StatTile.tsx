import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: "orange" | "purple" | "green" | "red" | "cyan" | "pink";
  delay?: number;
}

const accents: Record<string, string> = {
  orange: "text-amber-600",
  purple: "text-indigo-600",
  green: "text-emerald-600",
  red: "text-rose-600",
  cyan: "text-sky-600",
  pink: "text-fuchsia-600",
};

export function StatTile({ icon: Icon, label, value, sub, accent = "orange", delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileTap={{ scale: 0.97 }}
      className="glass relative overflow-hidden rounded-[1.75rem] p-5"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 ${accents[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-[2rem] font-semibold leading-none tracking-tight text-foreground">{value}</div>
      {sub && <div className="mt-2 text-[11px] font-medium text-foreground">{sub}</div>}
    </motion.div>
  );
}
