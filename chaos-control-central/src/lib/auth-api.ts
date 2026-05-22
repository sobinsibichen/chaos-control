const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  message?: string;
}

async function parseAuthResponse(response: Response): Promise<AuthResponse> {
  const data = (await response.json()) as Partial<AuthResponse>;

  if (!response.ok || !data.success || !data.user || !data.token) {
    throw new Error(data.message || "Authentication request failed.");
  }

  return data as AuthResponse;
}

export async function signupRequest(payload: { name: string; email: string; password: string }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseAuthResponse(response);
}

export async function loginRequest(payload: { email: string; password: string }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseAuthResponse(response);
}
