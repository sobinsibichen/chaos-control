import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Last Puff - Redirecting" },
      { name: "description", content: "A premium smoking recovery experience with live progress and real-time support." },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  const hydrated = useAppStore((state) => state.meta.hydrated);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    void navigate({ to: isAuthenticated ? "/home" : "/login", replace: true });
  }, [hydrated, isAuthenticated, navigate]);

  return null;
}
