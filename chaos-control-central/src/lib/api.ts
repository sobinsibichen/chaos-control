import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, API_URL } from "@/config/api";
import { appStore } from "@/lib/app-store";
import { getStoredToken } from "@/lib/session";

export { API_BASE_URL, API_URL };

const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 900;

export class ApiError extends Error {
  status?: number;
  code?: string;
  isNetworkError: boolean;

  constructor(message: string, options: { status?: number; code?: string; isNetworkError?: boolean } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.isNetworkError = options.isNetworkError ?? false;
  }
}

type ApiRequestOptions = Omit<AxiosRequestConfig, "url" | "baseURL"> & {
  requiresAuth?: boolean;
  retry?: number;
};

type ApiInternalConfig = InternalAxiosRequestConfig & {
  requiresAuth?: boolean;
  retry?: number;
  metadata?: {
    retryCount?: number;
  };
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

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

function friendlyMessage(error: AxiosError<{ message?: string; code?: string }>) {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === "ECONNABORTED") {
    return "The server is taking a little longer to wake up. Please try again in a moment.";
  }

  if (!error.response) {
    return "The server is waking up. Please try again in a moment.";
  }

  if (error.response.status >= 500) {
    return "The server is waking up. Please try again shortly.";
  }

  return "Request failed.";
}

function logApiError(error: AxiosError) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.error("[api-error]", {
    method: (error.config?.method ?? "get").toUpperCase(),
    url: error.config?.url,
    status: error.response?.status,
    code: error.code,
    response: error.response?.data,
  });
}

apiClient.interceptors.request.use((config: ApiInternalConfig) => {
  const shouldAttachAuth = config.requiresAuth !== false;
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
  async (error: AxiosError<{ message?: string; code?: string }>) => {
    const config = error.config as ApiInternalConfig | undefined;
    const retryLimit = config?.retry ?? DEFAULT_RETRY_ATTEMPTS;
    const retryCount = config?.metadata?.retryCount ?? 0;

    if (config && retryCount < retryLimit && isRetryableApiError(error)) {
      config.metadata = { ...(config.metadata ?? {}), retryCount: retryCount + 1 };
      await sleep(retryDelay(config.metadata.retryCount));
      return apiClient.request(config);
    }

    if (error.response?.status === 401) {
      appStore.logout();
    }

    logApiError(error);

    throw new ApiError(friendlyMessage(error), {
      status: error.response?.status,
      code: error.code || error.response?.data?.code,
      isNetworkError: !error.response,
    });
  },
);

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers, retry, ...rest } = options;
  const response = await apiClient.request<T>({
    url: path,
    ...rest,
    headers,
    requiresAuth,
    retry,
  });

  return response.data;
}
