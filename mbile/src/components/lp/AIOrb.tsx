import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function AIOrb({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-strong relative overflow-hidden rounded-[1.75rem] p-5 border border-foreground/10"
    >
      <div className="relative flex items-start gap-3">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="shrink-0 relative w-12 h-12"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-foreground via-foreground/60 to-foreground/30 blur-md opacity-25" />
          <div className="absolute inset-1 rounded-full bg-card flex items-center justify-center border border-foreground/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
        </motion.div>
        <div className="flex-1">
          <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1">
            Message
          </div>
          <p className="text-sm leading-snug font-medium text-foreground">{message}</p>
        </div>
      </div>
    </motion.div>
  );
}
