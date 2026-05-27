function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL;

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5000`;
  }

  return "http://localhost:5000";
}

export const API_URL = resolveApiUrl();
export const API_BASE_URL = `${API_URL}/api`;
