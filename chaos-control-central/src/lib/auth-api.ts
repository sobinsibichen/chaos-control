import { apiRequest } from "@/lib/api";

interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    cigarettePrice?: number;
    visibilityEnabled?: boolean;
  };
  message?: string;
}

export async function signupRequest(payload: { name: string; email: string; password: string }) {
  const data = await apiRequest<Partial<AuthResponse>>("/api/auth/signup", {
    method: "POST",
    requiresAuth: false,
    body: JSON.stringify(payload),
  });
  if (!data.success || !data.user || !data.token) {
    throw new Error(data.message || "Authentication request failed.");
  }
  return data as AuthResponse;
}

export async function loginRequest(payload: { email: string; password: string }) {
  const data = await apiRequest<Partial<AuthResponse>>("/api/auth/login", {
    method: "POST",
    requiresAuth: false,
    body: JSON.stringify(payload),
  });
  if (!data.success || !data.user || !data.token) {
    throw new Error(data.message || "Authentication request failed.");
  }
  return data as AuthResponse;
}

export async function getCurrentUserRequest() {
  const data = await apiRequest<{ success: boolean; user?: AuthResponse["user"]; message?: string }>("/api/auth/me");
  if (!data.success || !data.user) {
    throw new Error(data.message || "Unable to fetch current user.");
  }
  return data.user;
}

export async function logoutRequest() {
  return Promise.resolve({ success: true });
}
