import { createFileRoute } from "@tanstack/react-router";
import { NearbyShops } from "@/components/lp/nearby-shops/NearbyShops";

export const Route = createFileRoute("/social")({
  head: () => ({ meta: [{ title: "Nearby Stores - Last Puff" }] }),
  component: NearbyShops,
});
