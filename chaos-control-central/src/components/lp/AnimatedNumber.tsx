import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedNumber({ value, prefix = "", suffix = "", className }: AnimatedNumberProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString("en-IN"));

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1,
      ease: "easeOut",
    });

    return () => controls.stop();
  }, [count, value]);

  return (
    <motion.span className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  );
}
