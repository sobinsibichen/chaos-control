import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { appStore } from "@/lib/app-store";
import { getStoredToken } from "@/lib/session";

const DEFAULT_API_BASE_URL = "https://chaos-control-api.onrender.com";
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
export const AUTH_REQUEST_TIMEOUT_MS = 45000;

function resolveApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  const runtimeOverride =
    import.meta.env.DEV && typeof window !== "undefined"
      ? window.localStorage.getItem("last-puff-api-base-url")
      : null;

  return (envBaseUrl || runtimeOverride || DEFAULT_API_BASE_URL).replace(/\/$/, "");
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
  timeout?: number;
}

type ApiInternalConfig = InternalAxiosRequestConfig & {
  skipAuth?: boolean;
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
  return config?.skipAuth !== true;
}

function redactHeaders(headers?: Record<string, unknown>) {
  if (!headers) {
    return headers;
  }

  const next = { ...headers };
  if (typeof next.Authorization === "string") {
    next.Authorization = "Bearer [redacted]";
  }
  if (typeof next.authorization === "string") {
    next.authorization = "Bearer [redacted]";
  }
  return next;
}

function redactRequestBody(body: unknown) {
  if (body == null) {
    return body;
  }

  if (typeof body === "string") {
    return body.length > 500 ? `${body.slice(0, 500)}…` : body;
  }

  if (Array.isArray(body)) {
    return body.slice(0, 25);
  }

  if (typeof body === "object") {
    try {
      return JSON.parse(JSON.stringify(body));
    } catch {
      return "[unserializable body]";
    }
  }

  return body;
}

function resolveFriendlyErrorMessage(status?: number, message?: string, code?: string) {
  if (status === 401) {
    return message || "Please sign in again.";
  }

  if (code === "ECONNABORTED") {
    return "The server took too long to respond. Please try again in a moment.";
  }

  if (!status || status >= 500) {
    return "Unable to connect. Please try again.";
  }

  return message || "Unable to connect. Please try again.";
}

function logApiFailure(details: {
  method: string;
  url: string;
  requestHeaders?: Record<string, unknown>;
  requestBody?: unknown;
  responseStatus?: number;
  responseBody?: unknown;
  error: unknown;
}) {
  console.error("[api-error]", {
    endpoint: `${details.method} ${details.url}`,
    request: {
      headers: redactHeaders(details.requestHeaders),
      body: redactRequestBody(details.requestBody),
    },
    response: {
      status: details.responseStatus,
      body: details.responseBody,
    },
    error: details.error instanceof Error ? { name: details.error.name, message: details.error.message, stack: details.error.stack } : details.error,
  });
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config: ApiInternalConfig) => {
  config.headers = AxiosHeaders.from(config.headers ?? {});
  const shouldAttachAuth = config.skipAuth !== true;
  const token = shouldAttachAuth ? getAuthToken() : null;
  const url = config.url ?? "";
  const method = (config.method ?? "get").toUpperCase();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
    console.info(`[api-debug] ${method} ${url} -> Authorization attached`);
  } else {
    config.headers.delete("Authorization");
    if (shouldAttachAuth) {
      console.warn(`[api-debug] ${method} ${url} -> Authorization token missing`);
      throw new ApiRequestError("Please sign in again to save blocked apps.", 401);
    }
  }

  if (shouldDebugAuthRequest(url)) {
    console.info(`[api-debug] request headers for ${method} ${url}`, redactHeaders(config.headers.toJSON()));
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    const method = ((error.config?.method ?? "get") as string).toUpperCase();
    const backendMessage = error.response?.data?.message || error.message || "Request failed.";
    const normalizedMessage = /invalid input syntax for type uuid|invalid input syntax for type bigint|invalid input syntax for type integer/i.test(
      backendMessage,
    )
      ? "Your session or request data is out of sync. Please try again."
      : resolveFriendlyErrorMessage(status, backendMessage, error.code);

    logApiFailure({
      method,
      url,
      requestHeaders: error.config?.headers instanceof AxiosHeaders ? error.config.headers.toJSON() : (error.config?.headers as Record<string, unknown> | undefined),
      requestBody: error.config?.data,
      responseStatus: status,
      responseBody: error.response?.data,
      error,
    });

    if (status === 401 && shouldInvalidateSession(error.config as ApiInternalConfig | undefined)) {
      appStore.logout();
    }

    return Promise.reject(
      new ApiRequestError(normalizedMessage || "Unable to connect. Please try again.", status),
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
  const { auth = true, body, method = "GET", headers = {}, timeout, ...rest } = options;
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
    timeout,
    skipAuth: !auth,
    ...rest,
  } as ApiInternalConfig);

  return response.data;
}
