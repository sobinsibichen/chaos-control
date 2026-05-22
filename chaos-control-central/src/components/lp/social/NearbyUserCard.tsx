import { motion } from "framer-motion";
import { MapPin, MessageCircle, Radio, UserPlus } from "lucide-react";
import { GlassCard } from "@/components/lp/GlassCard";
import type { NearbySmoker } from "@/lib/app-store";

interface NearbyUserCardProps {
  user: NearbySmoker;
  index: number;
  onMessage: (user: NearbySmoker) => void;
}

export function NearbyUserCard({ user, index, onMessage }: NearbyUserCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <GlassCard className="border border-foreground/10 transition-colors hover:border-foreground/20">
        <div className="flex items-start gap-3">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-lg border border-foreground/10 bg-card text-lg font-bold text-foreground shadow-sm">
            {user.avatar}
            <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background ${user.online ? "bg-emerald-400 animate-neon-pulse" : "bg-red-400"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-foreground">{user.username}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 text-cyan-400" />
                  {user.distanceMeters}m away
                </div>
              </div>
              <div className="rounded-lg border border-foreground/10 bg-card px-2 py-1 text-[9px] font-medium uppercase tracking-[0.15em] text-indigo-700 shadow-sm">
                {user.mood}
              </div>
            </div>
            <p className="mt-3 text-sm text-foreground">{user.status}</p>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.15em]">
                <span className="text-muted-foreground">Activity</span>
                <span className="text-emerald-700">{user.chaosLevel}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${user.chaosLevel}%` }}
                  transition={{ delay: 0.2 + index * 0.08, duration: 0.6 }}
                  className="h-full bg-gradient-to-r from-primary via-violet-400 to-rose-400"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onMessage(user)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-[0_16px_34px_rgba(15,23,42,0.16)] transition-all hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4" />
                Message
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-foreground/10 bg-card py-2.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted/60">
                <UserPlus className="h-4 w-4" />
                Connect
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em] text-foreground">
              <Radio className="h-3 w-3 text-emerald-400" />
              {user.online ? "Online" : "Offline"}
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
