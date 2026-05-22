import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "./index";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Home - Last Puff" }] }),
  component: DashboardPage,
});
