import { createFileRoute } from "@tanstack/react-router";
import { InsightsHub } from "@/components/lp/insights/InsightsHub";

export const Route = createFileRoute("/intelligence")({
  head: () => ({ meta: [{ title: "Intelligence - Last Puff" }] }),
  component: IntelligenceRoute,
});

function IntelligenceRoute() {
  return <InsightsHub initialTab="Smoke DNA" />;
}
