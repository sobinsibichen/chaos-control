import { appStore } from "@/lib/app-store";
import { getCurrentUserRequest, logoutRequest } from "@/lib/auth-api";

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
          rememberMe: true,
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

export async function logoutUser() {
  await logoutRequest();
  appStore.logout();
}
