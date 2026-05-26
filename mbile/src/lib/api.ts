import { appStore } from "@/lib/app-store";
import { getStoredToken } from "@/lib/session";

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const runtimeOverride = window.localStorage.getItem("last-puff-api-base-url");

    if (runtimeOverride) {
      return runtimeOverride.replace(/\/$/, "");
    }

    const { protocol, hostname } = window.location;

    if (hostname === "localhost") {
      return "http://10.0.2.2:5000";
    }

    return `${protocol}//${hostname}:5000`;
  }

  return "http://localhost:5000";
}

export const API_BASE_URL = resolveApiBaseUrl();

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
