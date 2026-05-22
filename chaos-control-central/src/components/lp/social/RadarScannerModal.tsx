import { AnimatePresence, motion } from "framer-motion";
import { Radar, X } from "lucide-react";

interface RadarScannerModalProps {
  open: boolean;
  scanning: boolean;
  onClose: () => void;
}

const pulseRings = [0, 1, 2];
const dots = [
  { top: "18%", left: "68%", delay: 0.2 },
  { top: "28%", left: "22%", delay: 0.9 },
  { top: "51%", left: "74%", delay: 0.5 },
  { top: "63%", left: "31%", delay: 1.2 },
  { top: "46%", left: "48%", delay: 0.3 },
  { top: "76%", left: "58%", delay: 0.7 },
];

export function RadarScannerModal({ open, scanning, onClose }: RadarScannerModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] grid place-items-center bg-background/92 px-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.35 }}
            className="glass-strong relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-hidden rounded-[2rem] border border-foreground/10 px-5 pb-6 pt-5 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full border border-foreground/10 bg-card p-2 text-muted-foreground shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-5 pr-10">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">// RADAR.SWEEP</div>
              <h2 className="mt-1 text-2xl font-bold text-foreground">Searching nearby users...</h2>
              <p className="mt-1 text-sm text-foreground">Underground smoker network pinging the immediate disaster radius.</p>
            </div>

            <div className="relative mx-auto flex aspect-square w-full max-w-[18rem] items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-foreground/10 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.04),transparent_58%)] shadow-[0_0_50px_-15px_rgba(15,23,42,0.12)]" />
              {pulseRings.map((ring) => (
                <motion.div
                  key={ring}
                  animate={{ scale: [0.7, 1.1], opacity: [0.45, 0] }}
                  transition={{ duration: 2.4, delay: ring * 0.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute h-[72%] w-[72%] rounded-full border border-foreground/10"
                />
              ))}
              <div className="absolute inset-[14%] rounded-full border border-foreground/10" />
              <div className="absolute inset-[30%] rounded-full border border-foreground/10" />
              <div className="absolute inset-0">
                {dots.map((dot, index) => (
                  <motion.span
                    key={index}
                    animate={{ opacity: [0.15, 1, 0.15], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.8, delay: dot.delay, repeat: Infinity }}
                    className="absolute h-2.5 w-2.5 rounded-full bg-foreground shadow-[0_0_14px_rgba(15,23,42,0.18)]"
                    style={{ top: dot.top, left: dot.left }}
                  />
                ))}
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2.8, ease: "linear", repeat: Infinity }}
                className="absolute inset-[6%] rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, transparent 310deg, rgba(15,23,42,0.85) 345deg, rgba(15,23,42,0.05) 360deg)",
                  clipPath: "circle(50%)",
                  filter: "drop-shadow(0 0 18px rgba(15,23,42,0.22))",
                }}
              />
              <motion.div
                animate={{ scale: scanning ? [1, 1.05, 1] : 1 }}
                transition={{ duration: 0.65, repeat: Infinity }}
                className="relative flex h-16 w-16 items-center justify-center rounded-full border border-foreground/10 bg-card/95 shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
              >
                <Radar className="h-7 w-7 text-foreground" />
              </motion.div>
            </div>

            <div className="mt-5 rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.15em] text-foreground">
                <span>Status</span>
                <span>{scanning ? "Scanning" : "Ready"}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: scanning ? "100%" : "0%" }}
                  transition={{ duration: 5, ease: "linear" }}
                  className="h-full bg-foreground"
                />
              </div>
              <p className="mt-3 text-xs text-foreground">
                We are checking the immediate area and preparing the results card below.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
