import { createFileRoute } from "@tanstack/react-router";
import { InsightsHub } from "@/components/lp/insights/InsightsHub";
import { useRenderCounter, useScreenPerformance } from "@/lib/performance";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights - Last Puff" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  useRenderCounter("InsightsPage");
  useScreenPerformance("insights", true);
  return <InsightsHub initialTab="Roast" />;
}
