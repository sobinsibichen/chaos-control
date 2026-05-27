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

export class ApiRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

interface ApiRequestOptions extends Omit<AxiosRequestConfig, "url" | "data" | "headers" | "auth"> {
  auth?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
}

type ApiInternalConfig = InternalAxiosRequestConfig & {
  auth?: boolean;
};

function getAuthToken() {
  const stateToken = appStore.getState().auth.token;
  if (stateToken) {
    return stateToken;
  }

  return getStoredToken();
}

function shouldDebugAuthRequest(url?: string) {
  return Boolean(
    url &&
      /\/api\/(apps|analytics|activity|smoke-dna|smoke-replay|craving-predictions|voice-commands|stats\/dashboard)/.test(url),
  );
}

function shouldInvalidateSession(config?: ApiInternalConfig) {
  const url = config?.url ?? "";
  return /\/api\/auth\/me(?:\?|$)/.test(url);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config: ApiInternalConfig) => {
  const shouldAttachAuth = config.auth !== false;
  const token = shouldAttachAuth ? getAuthToken() : null;
  const url = config.url ?? "";
  const method = (config.method ?? "get").toUpperCase();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
    if (shouldAttachAuth && shouldDebugAuthRequest(url)) {
      console.info(`[auth-debug] attached token for ${method} ${url}`);
    }
  } else {
    config.headers.delete("Authorization");
    if (shouldAttachAuth && shouldDebugAuthRequest(url)) {
      console.warn(`[auth-debug] missing token for ${method} ${url}`);
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    const backendMessage = error.response?.data?.message || error.message || "Request failed.";
    const normalizedMessage =
      /invalid input syntax for type uuid|invalid input syntax for type bigint|invalid input syntax for type integer/i.test(backendMessage)
        ? "Your session or request data is out of sync. Please try again."
        : backendMessage;

    if (shouldDebugAuthRequest(url)) {
      console.warn(`[auth-debug] ${status ?? "ERR"} ${url} :: ${normalizedMessage}`);
    }

    if (status === 401 && shouldInvalidateSession(error.config as ApiInternalConfig | undefined)) {
      appStore.logout();
    }

    return Promise.reject(
      new ApiRequestError(normalizedMessage || "Request failed.", status),
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
  const token = auth ? getAuthToken() : null;

  if (data !== undefined && !nextHeaders["Content-Type"] && !nextHeaders["content-type"]) {
    nextHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`;
    } else {
      delete nextHeaders.Authorization;
    }
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
