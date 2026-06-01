import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const NearbyShops = lazy(async () => ({ default: (await import("@/components/lp/nearby-shops/NearbyShops")).NearbyShops }));

export const Route = createFileRoute("/social")({
  head: () => ({ meta: [{ title: "Nearby Stores - Last Puff" }] }),
  component: StoresRoute,
});

function StoresRoute() {
  return (
    <Suspense fallback={null}>
      <NearbyShops />
    </Suspense>
  );
}
