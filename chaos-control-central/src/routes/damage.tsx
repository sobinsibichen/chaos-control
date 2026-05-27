import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { requireAuth } from "@/lib/route-guards";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/damage")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Damage Control - Last Puff" }] }),
  component: DamageRedirect,
});

function DamageRedirect() {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);

  useEffect(() => {
    void navigate({ to: isAuthenticated ? "/control" : "/login", replace: true });
  }, [isAuthenticated, navigate]);

  return null;
}
