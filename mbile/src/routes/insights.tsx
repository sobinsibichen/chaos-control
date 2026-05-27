import { createFileRoute } from "@tanstack/react-router";
import { InsightsHub } from "@/components/lp/insights/InsightsHub";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights - Last Puff" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  return <InsightsHub initialTab="Roast" />;
}
