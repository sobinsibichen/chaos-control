import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/lp/AppShell";
import { RoastContent } from "@/components/lp/insights/RoastContent";
import { useRenderCounter, useScreenPerformance } from "@/lib/performance";

export const Route = createFileRoute("/roast")({
  head: () => ({ meta: [{ title: "Roast Analytics - Last Puff" }] }),
  component: RoastPage,
});

function RoastPage() {
  useRenderCounter("RoastPage");
  useScreenPerformance("roast", true);
  return (
    <AppShell>
      <div className="mb-6">
        <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-foreground">Analytics</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Your Statistics</h1>
      </div>
      <RoastContent />
    </AppShell>
  );
}
