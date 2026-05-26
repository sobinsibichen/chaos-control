import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useAppStore((state) => state.meta.hydrated);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      void navigate({ to: "/login", replace: true });
    }
  }, [hydrated, isAuthenticated, location.pathname, navigate]);

  if (!hydrated || !isAuthenticated) {
    return null;
  }

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden bg-background text-foreground">
      <motion.main
        initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative z-10 px-5 pb-32 pt-7"
      >
        {children}
      </motion.main>
      <BottomNav />
    </div>
  );
}
