import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, API_URL } from "@/config/api";
import { appStore } from "@/lib/app-store";
import { getStoredToken } from "@/lib/session";

export { API_BASE_URL, API_URL };

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
};

type ApiInternalConfig = InternalAxiosRequestConfig & {
  requiresAuth?: boolean;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

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
  (error: AxiosError<{ message?: string; code?: string }>) => {
    if (error.response?.status === 401) {
      appStore.logout();
    }

    const message =
      error.response?.data?.message ||
      (error.code === "ECONNABORTED"
        ? "The server took too long to respond. Please try again."
        : !error.response
          ? "Network error. Please check your internet connection."
          : error.response.status >= 500
            ? "Server error. Please try again shortly."
            : "Request failed.");

    throw new ApiError(message, {
      status: error.response?.status,
      code: error.code || error.response?.data?.code,
      isNetworkError: !error.response,
    });
  },
);

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers, ...rest } = options;
  const response = await apiClient.request<T>({
    url: path,
    ...rest,
    headers,
    requiresAuth,
  });

  return response.data;
}
