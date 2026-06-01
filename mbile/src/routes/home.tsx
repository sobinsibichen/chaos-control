import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/lp/dashboard/DashboardPage";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Home - Last Puff" }] }),
  component: DashboardPage,
});
