import { appStore } from "@/lib/app-store";
import { getStoredToken } from "@/lib/session";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

interface ApiRequestOptions extends RequestInit {
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const nextHeaders = new Headers(headers);

  if (!nextHeaders.has("Content-Type") && rest.body) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getStoredToken();

    if (token) {
      nextHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: nextHeaders,
  });

  const data = (await response.json().catch(() => ({}))) as T & { message?: string };

  if (response.status === 401) {
    appStore.logout();
    throw new Error((data as { message?: string }).message || "Your session has expired.");
  }

  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Request failed.");
  }

  return data;
}
