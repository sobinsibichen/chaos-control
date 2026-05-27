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

  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.warn("[auth-debug] unable to read stored token", error);
    return null;
  }
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

  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    console.info("[auth-debug] stored token and user", {
      tokenPreview: `${token.slice(0, 12)}...`,
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    console.warn("[auth-debug] unable to persist session", error);
  }
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    console.info("[auth-debug] cleared stored session");
  } catch (error) {
    console.warn("[auth-debug] unable to clear session", error);
  }
}
