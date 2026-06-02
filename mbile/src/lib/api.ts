import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { appStore } from "@/lib/app-store";
import { loadingStore } from "@/lib/loading-store";
import { perfLog } from "@/lib/performance";
import { getStoredToken } from "@/lib/session";

const DEFAULT_API_BASE_URL = "https://chaos-control-api.onrender.com";
const DEV_API_BASE_URL = "http://localhost:5000";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
export const AUTH_REQUEST_TIMEOUT_MS = 45000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 900;

function resolveApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  const runtimeOverride =
    import.meta.env.DEV && typeof window !== "undefined"
      ? window.localStorage.getItem("last-puff-api-base-url")
      : null;

  const defaultUrl = import.meta.env.DEV ? DEV_API_BASE_URL : DEFAULT_API_BASE_URL;
  const configuredUrl = runtimeOverride || envBaseUrl;
  const unsafeProductionUrl = configuredUrl && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredUrl);

  return (unsafeProductionUrl && !import.meta.env.DEV ? DEFAULT_API_BASE_URL : configuredUrl || defaultUrl).replace(/\/$/, "");
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
  loadingMessage?: string;
  skipLoading?: boolean;
  retry?: number;
}

type ApiInternalConfig = InternalAxiosRequestConfig & {
  skipAuth?: boolean;
  loadingMessage?: string;
  skipLoading?: boolean;
  retry?: number;
  metadata?: {
    startedAt: number;
    loadingId?: string;
    retryCount?: number;
  };
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

function loadingMessageForRequest(method: string, url: string) {
  if (/\/api\/auth\/login/.test(url)) {
    return "Logging you in...";
  }
  if (/\/api\/auth\/signup/.test(url)) {
    return "Creating your account...";
  }
  if (/\/api\/auth\/me/.test(url)) {
    return "Restoring your session...";
  }
  if (/\/api\/cigarettes\/log/.test(url)) {
    return "Saving cigarette...";
  }
  if (/\/api\/cigarettes\/quit/.test(url)) {
    return "Starting quit attempt...";
  }
  if (/\/api\/stats\/dashboard/.test(url)) {
    return "Loading dashboard...";
  }
  if (/\/api\/profile\/preferences/.test(url)) {
    return "Updating settings...";
  }
  if (/\/api\/profile/.test(url)) {
    return method === "GET" ? "Loading profile..." : "Updating profile...";
  }
  if (/\/api\/analytics|\/api\/smoke-dna|\/api\/smoke-replay|\/api\/craving-predictions/.test(url)) {
    return "Generating insights...";
  }
  if (/\/api\/apps/.test(url)) {
    return "Updating protection...";
  }

  return method === "GET" ? "Loading..." : "Saving...";
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
    return "The server is taking a little longer to wake up. Please try again in a moment.";
  }

  if (!status || status >= 500) {
    return "The server is waking up. Please try again in a moment.";
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
  if (!import.meta.env.DEV) {
    return;
  }

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

function isRetryableApiError(error: AxiosError) {
  const method = (error.config?.method ?? "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    return false;
  }

  const status = error.response?.status;
  return !status || status === 408 || status === 425 || status === 429 || status >= 500 || error.code === "ECONNABORTED";
}

function retryDelay(retryCount: number) {
  return RETRY_BASE_DELAY_MS * 2 ** Math.max(0, retryCount - 1) + Math.round(Math.random() * 250);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config: ApiInternalConfig) => {
  config.metadata = {
    ...(config.metadata ?? {}),
    startedAt: config.metadata?.startedAt ?? (typeof performance !== "undefined" ? performance.now() : Date.now()),
  };
  config.headers = AxiosHeaders.from(config.headers ?? {});
  const shouldAttachAuth = config.skipAuth !== true;
  const token = shouldAttachAuth ? getAuthToken() : null;
  const url = config.url ?? "";
  const method = (config.method ?? "get").toUpperCase();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
    if (import.meta.env.DEV) {
      console.info(`[api-debug] ${method} ${url} -> Authorization attached`);
    }
  } else {
    config.headers.delete("Authorization");
    if (shouldAttachAuth) {
      if (import.meta.env.DEV) {
        console.warn(`[api-debug] ${method} ${url} -> Authorization token missing`);
      }
      throw new ApiRequestError("Please sign in again to save blocked apps.", 401);
    }
  }

  if (import.meta.env.DEV && shouldDebugAuthRequest(url)) {
    console.info(`[api-debug] request headers for ${method} ${url}`, redactHeaders(config.headers.toJSON()));
  }

  if (config.skipLoading !== true && (method !== "GET" || config.loadingMessage)) {
    config.metadata.loadingId = loadingStore.startLoading(config.loadingMessage || loadingMessageForRequest(method, url));
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as ApiInternalConfig;
    if (config.metadata?.loadingId) {
      loadingStore.stopLoading(config.metadata.loadingId);
    }
    const startedAt = config.metadata?.startedAt;
    if (startedAt) {
      const durationMs = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt);
      perfLog("api:response", {
        method: (config.method ?? "get").toUpperCase(),
        url: config.url,
        status: response.status,
        durationMs,
        bytes: JSON.stringify(response.data ?? {}).length,
      });
    }
    return response;
  },
  async (error: AxiosError<{ message?: string }>) => {
    const config = error.config as ApiInternalConfig | undefined;
    const retryLimit = config?.retry ?? DEFAULT_RETRY_ATTEMPTS;
    const retryCount = config?.metadata?.retryCount ?? 0;
    if (config && retryCount < retryLimit && isRetryableApiError(error)) {
      config.metadata = {
        ...(config.metadata ?? { startedAt: typeof performance !== "undefined" ? performance.now() : Date.now() }),
        retryCount: retryCount + 1,
      };
      await sleep(retryDelay(config.metadata.retryCount));
      return apiClient.request(config);
    }

    if (config?.metadata?.loadingId) {
      loadingStore.stopLoading(config.metadata.loadingId);
    }
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
    const startedAt = config?.metadata?.startedAt;
    if (startedAt) {
      perfLog("api:error", {
        method,
        url,
        status,
        durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt),
      });
    }

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
  const { auth = true, body, method = "GET", headers = {}, timeout, loadingMessage, skipLoading, retry, ...rest } = options;
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
    loadingMessage,
    skipLoading,
    retry,
    ...rest,
  } as ApiInternalConfig);

  return response.data;
}
