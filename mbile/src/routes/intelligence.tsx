import { createFileRoute } from "@tanstack/react-router";
import { IntelligenceHub } from "@/components/lp/intelligence/IntelligenceHub";

export const Route = createFileRoute("/intelligence")({
  head: () => ({ meta: [{ title: "Intelligence - Last Puff" }] }),
  component: IntelligenceHub,
});
