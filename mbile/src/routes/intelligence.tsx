import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const InsightsHub = lazy(async () => ({ default: (await import("@/components/lp/insights/InsightsHub")).InsightsHub }));

export const Route = createFileRoute("/intelligence")({
  head: () => ({ meta: [{ title: "Intelligence - Last Puff" }] }),
  component: IntelligenceRoute,
});

function IntelligenceRoute() {
  return (
    <Suspense fallback={null}>
      <InsightsHub initialTab="Smoke DNA" />
    </Suspense>
  );
}
