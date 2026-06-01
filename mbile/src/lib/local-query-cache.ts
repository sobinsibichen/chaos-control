interface LocalQueryCacheEntry<T> {
  data: T;
  updatedAt: number;
}

export function readLocalQueryCache<T>(key: string, maxAgeMs?: number): LocalQueryCacheEntry<T> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as LocalQueryCacheEntry<T>;
    if (!entry || typeof entry.updatedAt !== "number" || !("data" in entry)) {
      return null;
    }

    if (maxAgeMs && Date.now() - entry.updatedAt > maxAgeMs) {
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

export function writeLocalQueryCache<T>(key: string, data: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        data,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // Best-effort cache only. Private mode or quota failures should not affect app flow.
  }
}
