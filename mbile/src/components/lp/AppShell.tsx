import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { MentalStabilityChallenge } from "@/components/lp/damage/MentalStabilityChallenge";
import { useAppStore } from "@/lib/app-store";
import {
  disableNativeUninstallProtectionAfterChallenge,
  getNativeProtectionStatus,
  isNativeAndroid,
  openNativeAppUninstallAfterChallenge,
  relockNativeProtection,
} from "@/lib/native/mobile";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useAppStore((state) => state.meta.hydrated);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const [uninstallChallengeOpen, setUninstallChallengeOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      void navigate({ to: "/login", replace: true });
    }
  }, [hydrated, isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !isNativeAndroid()) {
      return;
    }

    const refresh = async () => {
      const status = await getNativeProtectionStatus().catch(() => null);
      if (status?.uninstallChallengePending) {
        setUninstallChallengeOpen(true);
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 1500);
    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [hydrated, isAuthenticated]);

  if (!hydrated || !isAuthenticated) {
    return null;
  }

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden bg-transparent text-foreground">
      <main className="relative z-10 px-5 pb-32 pt-7">
        {children}
      </main>
      <BottomNav />
      <MentalStabilityChallenge
        open={uninstallChallengeOpen}
        onClose={() => setUninstallChallengeOpen(false)}
        onResult={(result) => {
          if (result.passed) {
            // This is the only global path that removes Device Admin and resumes uninstall.
            void disableNativeUninstallProtectionAfterChallenge()
              .then(() => openNativeAppUninstallAfterChallenge())
              .finally(() => setUninstallChallengeOpen(false));
          } else {
            void relockNativeProtection().catch(() => {});
          }
        }}
      />
    </div>
  );
}
