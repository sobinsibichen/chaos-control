import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { appStore } from "@/lib/app-store";
import { getStoredToken } from "@/lib/session";

function resolveApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;

  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, "");
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

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

interface ApiRequestOptions extends Omit<AxiosRequestConfig, "url" | "data" | "headers" | "auth"> {
  auth?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
}

type ApiInternalConfig = InternalAxiosRequestConfig & {
  auth?: boolean;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config: ApiInternalConfig) => {
  const shouldAttachAuth = config.auth !== false;
  const token = shouldAttachAuth ? getStoredToken() : null;

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  } else {
    config.headers.delete("Authorization");
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const backendMessage = error.response?.data?.message || error.message || "Request failed.";
    const normalizedMessage =
      /invalid input syntax for type uuid|invalid input syntax for type bigint|invalid input syntax for type integer/i.test(backendMessage)
        ? "Your session or request data is out of sync. Please try again."
        : backendMessage;

    if (error.response?.status === 401) {
      appStore.logout();
      return Promise.reject(new Error(normalizedMessage || "Your session has expired."));
    }

    return Promise.reject(
      new Error(normalizedMessage),
    );
  },
);

function normalizeBody(body: unknown, headers: Record<string, string>) {
  if (typeof body !== "string") {
    return body;
  }

  const contentType = headers["Content-Type"] || headers["content-type"];
  if (contentType?.includes("application/json")) {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  return body;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, body, method = "GET", headers = {}, ...rest } = options;
  const data = normalizeBody(body, headers);
  const nextHeaders = { ...headers };

  if (data !== undefined && !nextHeaders["Content-Type"] && !nextHeaders["content-type"]) {
    nextHeaders["Content-Type"] = "application/json";
  }

  const response = await apiClient.request<T>({
    url: path,
    method,
    data,
    headers: nextHeaders,
    auth,
    ...rest,
  });

  return response.data;
}
