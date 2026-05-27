import { useEffect, useMemo, useRef, useState } from "react";
import {
  type LatLngLiteral,
  type NearbyStore,
  searchNearbyStores,
} from "@/services/googlePlaces";

const FAVORITES_STORAGE_KEY = "last-puff-nearby-store-favorites";
const DEFAULT_QUERY = "Convenience stores";

function readFavorites() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persistFavorites(next: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
}

export function useNearbyPlaces(ready: boolean) {
  const [searchTerm, setSearchTerm] = useState(DEFAULT_QUERY);
  const [location, setLocation] = useState<LatLngLiteral | null>(null);
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);

  const requestLocation = () =>
    new Promise<LatLngLiteral>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not available on this device."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (geoError) => {
          reject(new Error(geoError.message || "Location permission is required to find nearby stores."));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        },
      );
    });

  const locate = async () => {
    try {
      setLocating(true);
      setError("");
      const nextLocation = await requestLocation();
      setLocation(nextLocation);
      return nextLocation;
    } catch (locateError) {
      const message =
        locateError instanceof Error
          ? locateError.message
          : "Unable to detect your current location.";
      setError(message);
      throw locateError;
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    void locate().catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !location) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const results = await searchNearbyStores({
          location,
          query: searchTerm,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setStores(results);
        setSelectedStoreId((current) =>
          current && results.some((store) => store.placeId === current)
            ? current
            : results[0]?.placeId ?? null,
        );
      } catch (searchError) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setStores([]);
        setSelectedStoreId(null);
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Unable to load nearby stores right now.",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [location, ready, searchTerm]);

  const toggleFavorite = (placeId: string) => {
    setFavorites((current) => {
      const next = current.includes(placeId)
        ? current.filter((value) => value !== placeId)
        : [...current, placeId];
      persistFavorites(next);
      return next;
    });
  };

  return {
    searchTerm,
    setSearchTerm,
    location,
    stores,
    selectedStoreId,
    setSelectedStoreId,
    favoriteIds,
    toggleFavorite,
    locating,
    loading,
    error,
    locate,
  };
}
