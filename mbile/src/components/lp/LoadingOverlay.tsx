import { AnimatePresence, motion } from "framer-motion";
import { useLoadingStore } from "@/lib/loading-store";

export function LoadingOverlay() {
  const isVisible = useLoadingStore((state) => state.isVisible);
  const message = useLoadingStore((state) => state.message);

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          aria-live="polite"
          aria-busy="true"
          role="status"
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/45 px-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.div
            className="lp-loader-shell"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lp-cigarette-loader" aria-hidden="true">
              <div className="lp-smoke-field">
                <span className="lp-smoke-wisp lp-smoke-wisp-1" />
                <span className="lp-smoke-wisp lp-smoke-wisp-2" />
                <span className="lp-smoke-wisp lp-smoke-wisp-3" />
                <span className="lp-smoke-wisp lp-smoke-wisp-4" />
              </div>
              <div className="lp-cigarette-shadow" />
              <div className="lp-cigarette">
                <span className="lp-cigarette-ember" />
                <span className="lp-cigarette-ash" />
                <span className="lp-cigarette-paper" />
                <span className="lp-cigarette-filter" />
              </div>
            </div>
            <div className="lp-loader-message">{message || "Loading..."}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
