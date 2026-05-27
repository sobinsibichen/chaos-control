import { getCurrentUserRequest } from "@/lib/auth-api";
import { appStore } from "@/lib/app-store";

let bootstrapPromise: Promise<void> | null = null;

export async function bootstrapAuth() {
  if (typeof window === "undefined") {
    return;
  }

  appStore.hydrate();
  const { auth } = appStore.getState();

  if (!auth.token || !auth.user) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = getCurrentUserRequest()
      .then((user) => {
        appStore.login({
          id: user.id,
          username: user.name,
          email: user.email,
          rememberMe: auth.rememberMe,
          token: auth.token as string,
          cigarettePrice: user.cigarettePrice,
          visibilityEnabled: user.visibilityEnabled,
        });
      })
      .catch(() => {
        appStore.logout();
      })
      .finally(() => {
        bootstrapPromise = null;
      });
  }

  await bootstrapPromise;
}
