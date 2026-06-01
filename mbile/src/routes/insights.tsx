import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useRenderCounter, useScreenPerformance } from "@/lib/performance";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights - Last Puff" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  useRenderCounter("InsightsPage");
  useScreenPerformance("insights", true);
  return (
    <Suspense fallback={null}>
      <InsightsHub initialTab="Roast" />
    </Suspense>
  );
}
const InsightsHub = lazy(async () => ({ default: (await import("@/components/lp/insights/InsightsHub")).InsightsHub }));
