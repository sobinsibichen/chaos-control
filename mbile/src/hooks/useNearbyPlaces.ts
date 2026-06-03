import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFavoriteStore, deleteFavoriteStore, listFavoriteStores, type FavoriteStoreRecord } from "@/lib/intelligenceApi";
import { useAppStore } from "@/lib/app-store";
import { withLoader } from "@/lib/loading-store";
import { queryCacheTimes } from "@/lib/query-cache";
import { queryKeys } from "@/lib/query-keys";
import { buildDirectionsUrl, type LatLngLiteral, type NearbyStore, searchNearbyStores } from "@/services/googlePlaces";

const DEFAULT_QUERY = "Convenience stores";

function localFavoritesKey(userId: string | number | null | undefined) {
  return `last-puff-favorite-stores-${String(userId ?? "anonymous")}`;
}

function readLocalFavorites(userId: string | number | null | undefined) {
  if (typeof window === "undefined") {
    return [] as FavoriteStoreRecord[];
  }

  try {
    const raw = window.localStorage.getItem(localFavoritesKey(userId));
    return raw ? (JSON.parse(raw) as FavoriteStoreRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(userId: string | number | null | undefined, favorites: FavoriteStoreRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(localFavoritesKey(userId), JSON.stringify(favorites.slice(0, 100)));
}

export function useNearbyPlaces(ready: boolean) {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.auth.user?.id);
  const [searchTerm, setSearchTerm] = useState(DEFAULT_QUERY);
  const [location, setLocation] = useState<LatLngLiteral | null>(null);
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localFavorites, setLocalFavorites] = useState<FavoriteStoreRecord[]>(() => readLocalFavorites(userId));
  const requestIdRef = useRef(0);

  const favoriteStoresQueryKey = useMemo(() => queryKeys.favoriteStores(userId), [userId]);

  const favoriteStoresQuery = useQuery({
    queryKey: favoriteStoresQueryKey,
    queryFn: () => listFavoriteStores(100),
    ...queryCacheTimes.nearby,
  });

  useEffect(() => {
    setLocalFavorites(readLocalFavorites(userId));
  }, [userId]);

  useEffect(() => {
    writeLocalFavorites(userId, localFavorites);
  }, [localFavorites, userId]);

  const favoriteStores = useMemo(() => {
    const merged = new Map<string, FavoriteStoreRecord>();
    localFavorites.forEach((item) => merged.set(item.placeId, item));
    (favoriteStoresQuery.data?.items ?? []).forEach((item) => merged.set(item.placeId, item));
    return [...merged.values()].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [favoriteStoresQuery.data?.items, localFavorites]);

  const favoriteIds = useMemo(
    () => new Set(favoriteStores.map((item) => item.placeId)),
    [favoriteStores],
  );

  const saveFavoriteMutation = useMutation({
    mutationFn: createFavoriteStore,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoriteStoresQueryKey });
    },
    onError: (mutationError) => {
      console.warn("[nearby-favorites] Server save failed; local favorite retained.", mutationError);
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: deleteFavoriteStore,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoriteStoresQueryKey });
    },
    onError: (mutationError) => {
      console.warn("[nearby-favorites] Server remove failed; local favorite removed.", mutationError);
    },
  });

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
      const nextLocation = await withLoader(requestLocation, "Finding your location...");
      setLocation(nextLocation);
      return nextLocation;
    } catch (locateError) {
      const message = locateError instanceof Error ? locateError.message : "Unable to detect your current location.";
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
        const results = await withLoader(
          () =>
            searchNearbyStores({
              location,
              query: searchTerm,
            }),
          "Loading nearby stores...",
        );

        if (requestId !== requestIdRef.current) {
          return;
        }

        setStores(results);
        setSelectedStoreId((current) =>
          current && results.some((store) => store.placeId === current) ? current : results[0]?.placeId ?? null,
        );
      } catch (searchError) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setStores([]);
        setSelectedStoreId(null);
        setError(searchError instanceof Error ? searchError.message : "Unable to load nearby stores right now.");
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [location, ready, searchTerm]);

  const toggleFavorite = async (placeId: string) => {
    const store = stores.find((item) => item.placeId === placeId);
    if (!store) {
      return;
    }

    const previous = favoriteStoresQuery.data;
    const previousLocal = localFavorites;

    if (favoriteIds.has(placeId)) {
      const existing = favoriteStores.find((item) => item.placeId === placeId);

      queryClient.setQueryData(favoriteStoresQueryKey, previous ? {
        ...previous,
        items: previous.items.filter((item) => item.placeId !== placeId),
      } : previous);
      setLocalFavorites((current) => current.filter((item) => item.placeId !== placeId));

      try {
        if (existing && existing.id > 0) {
          await removeFavoriteMutation.mutateAsync(existing.id);
        }
      } catch (removeError) {
        console.warn("[nearby-favorites] Favorite removed locally, server remove pending.", removeError);
      }
      return;
    }

    const optimisticItem: FavoriteStoreRecord = {
      id: Date.now(),
      placeId: store.placeId,
      storeName: store.name,
      address: store.address,
      phoneNumber: store.phoneNumber,
      mapsUrl: buildDirectionsUrl(store),
      rating: store.rating ?? null,
      isOpen: store.isOpen,
      latitude: store.location.lat,
      longitude: store.location.lng,
      metadata: {
        image: store.photoUrl,
        matchedKeyword: store.matchedKeyword,
        distanceMeters: store.distanceMeters,
      },
      createdAt: new Date().toISOString(),
    };

    queryClient.setQueryData(favoriteStoresQueryKey, previous ? {
      ...previous,
      items: [optimisticItem, ...previous.items],
    } : {
      items: [optimisticItem],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    setLocalFavorites((current) => [optimisticItem, ...current.filter((item) => item.placeId !== placeId)]);

    try {
      const saved = await saveFavoriteMutation.mutateAsync({
        placeId: store.placeId,
        storeName: store.name,
        address: store.address,
        phoneNumber: store.phoneNumber,
        mapsUrl: buildDirectionsUrl(store),
        rating: store.rating ?? null,
        isOpen: store.isOpen,
        latitude: store.location.lat,
        longitude: store.location.lng,
        metadata: {
          image: store.photoUrl,
          matchedKeyword: store.matchedKeyword,
          distanceMeters: store.distanceMeters,
        },
      });
      setLocalFavorites((current) => [saved, ...current.filter((item) => item.placeId !== saved.placeId)]);
    } catch (saveError) {
      setLocalFavorites(previousLocal.some((item) => item.placeId === placeId) ? previousLocal : [optimisticItem, ...previousLocal]);
      console.warn("[nearby-favorites] Favorite saved locally; server sync can retry later.", saveError);
    }
  };

  return {
    searchTerm,
    setSearchTerm,
    location,
    stores,
    selectedStoreId,
    setSelectedStoreId,
    favoriteStores,
    favoriteIds,
    toggleFavorite,
    locating,
    loading,
    error,
    locate,
  };
}
