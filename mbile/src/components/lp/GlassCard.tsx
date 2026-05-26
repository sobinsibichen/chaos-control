import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  glow?: "orange" | "purple" | "green" | "red" | "cyan" | "none";
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow = "none", children, ...props }, ref) => {
    const glowClass = {
      orange: "shadow-[0_8px_24px_-5px_oklch(0.68_0.15_50/0.15)]",
      purple: "shadow-[0_8px_24px_-5px_oklch(0.62_0.12_310/0.15)]",
      green: "shadow-[0_8px_24px_-5px_oklch(0.65_0.12_130/0.12)]",
      red: "shadow-[0_8px_24px_-5px_oklch(0.62_0.18_20/0.15)]",
      cyan: "shadow-[0_8px_24px_-5px_oklch(0.68_0.10_210/0.12)]",
      none: "",
    }[glow];
    return (
      <motion.div
        ref={ref}
        whileTap={{ scale: 0.992 }}
        className={cn(
          "glass relative overflow-hidden rounded-[1.75rem] p-5 border border-foreground/10",
          glowClass,
          className,
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
GlassCard.displayName = "GlassCard";
