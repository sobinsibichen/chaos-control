import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { requireAuth } from "@/lib/route-guards";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/analytics")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Roast Analytics - Last Puff" }] }),
  component: AnalyticsRedirect,
});

function AnalyticsRedirect() {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);

  useEffect(() => {
    void navigate({ to: isAuthenticated ? "/roast" : "/login", replace: true });
  }, [isAuthenticated, navigate]);

  return null;
}
