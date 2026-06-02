function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

const PRODUCTION_API_URL = "https://chaos-control-api.onrender.com";
const DEVELOPMENT_API_URL = "http://localhost:5000";

function resolveApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;

  if (configuredUrl) {
    const unsafeProductionUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredUrl);
    if (unsafeProductionUrl && !import.meta.env.DEV) {
      return PRODUCTION_API_URL;
    }

    return trimTrailingSlash(configuredUrl);
  }

  return import.meta.env.DEV ? DEVELOPMENT_API_URL : PRODUCTION_API_URL;
}

export const API_URL = resolveApiUrl();
export const API_BASE_URL = API_URL;
