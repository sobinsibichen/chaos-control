const TOKEN_KEY = "token";
const USER_KEY = "last-puff-user";

export interface SessionUser {
  id?: number | string;
  username: string;
  email: string;
  avatar: string;
  cigarettePrice?: number;
  visibilityEnabled?: boolean;
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: SessionUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("token", token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
