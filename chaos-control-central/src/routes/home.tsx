import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "./index";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/home")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Home - Last Puff" }] }),
  component: DashboardPage,
});
