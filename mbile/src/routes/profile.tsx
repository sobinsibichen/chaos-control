import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ProfilePage = lazy(() => import("@/components/lp/profile/ProfilePage"));

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - Last Puff" }] }),
  component: ProfileRoute,
});

function ProfileRoute() {
  return (
    <Suspense fallback={null}>
      <ProfilePage />
    </Suspense>
  );
}
