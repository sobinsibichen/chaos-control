import axios, { AxiosError, type AxiosRequestConfig } from "axios";
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

interface ApiRequestOptions extends Omit<AxiosRequestConfig, "url" | "data" | "headers"> {
  auth?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
}

const SKIP_AUTH_HEADER = "X-Skip-Auth";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const nextHeaders = config.headers ?? {};
  const shouldSkipAuth = nextHeaders[SKIP_AUTH_HEADER] === "true";

  if (shouldSkipAuth) {
    delete nextHeaders[SKIP_AUTH_HEADER];
    config.headers = nextHeaders;
    return config;
  }

  const token = getStoredToken();
  if (token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  config.headers = nextHeaders;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      appStore.logout();
      return Promise.reject(new Error(error.response.data?.message || "Your session has expired."));
    }

    return Promise.reject(
      new Error(error.response?.data?.message || error.message || "Request failed."),
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

  if (!auth) {
    nextHeaders[SKIP_AUTH_HEADER] = "true";
  }

  const response = await apiClient.request<T>({
    url: path,
    method,
    data,
    headers: nextHeaders,
    ...rest,
  });

  return response.data;
}
