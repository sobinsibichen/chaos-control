import { getCurrentUserRequest } from "@/lib/auth-api";
import { ApiRequestError } from "@/lib/api";
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
      .catch((error) => {
        if (error instanceof ApiRequestError && error.status === 401) {
          appStore.logout();
          return;
        }

        console.warn("Auth bootstrap skipped due to a temporary request failure.", error);
      })
      .finally(() => {
        bootstrapPromise = null;
      });
  }

  await bootstrapPromise;
}
