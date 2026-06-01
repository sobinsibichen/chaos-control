import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { requireAuth } from "@/lib/route-guards";

const ControlPage = lazy(() => import("@/components/lp/control/ControlPage"));

export const Route = createFileRoute("/control")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Damage Control - Last Puff" }] }),
  component: ControlRoute,
});

function ControlRoute() {
  return (
    <Suspense fallback={null}>
      <ControlPage />
    </Suspense>
  );
}
