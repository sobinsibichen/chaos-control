import { redirect } from "@tanstack/react-router";
import { appStore } from "@/lib/app-store";

export function requireAuth() {
  if (typeof window === "undefined") {
    return;
  }

  appStore.hydrate();

  if (!appStore.getState().auth.isAuthenticated) {
    throw redirect({ to: "/login" });
  }
}
