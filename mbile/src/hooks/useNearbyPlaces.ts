import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createFavoriteStore, deleteFavoriteStore, listFavoriteStores } from "@/lib/intelligenceApi";
import { queryKeys } from "@/lib/query-keys";
import { buildDirectionsUrl, type LatLngLiteral, type NearbyStore, searchNearbyStores } from "@/services/googlePlaces";

const DEFAULT_QUERY = "Convenience stores";

export function useNearbyPlaces(ready: boolean) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState(DEFAULT_QUERY);
  const [location, setLocation] = useState<LatLngLiteral | null>(null);
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const favoriteStoresQuery = useQuery({
    queryKey: queryKeys.favoriteStores,
    queryFn: () => listFavoriteStores(100),
  });

  const favoriteIds = useMemo(
    () => new Set((favoriteStoresQuery.data?.items ?? []).map((item) => item.placeId)),
    [favoriteStoresQuery.data?.items],
  );

  const saveFavoriteMutation = useMutation({
    mutationFn: createFavoriteStore,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favoriteStores });
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Unable to save favorite store.");
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: deleteFavoriteStore,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favoriteStores });
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Unable to remove favorite store.");
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
      const nextLocation = await requestLocation();
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
        const results = await searchNearbyStores({
          location,
          query: searchTerm,
        });

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

    if (favoriteIds.has(placeId)) {
      const existing = favoriteStoresQuery.data?.items.find((item) => item.placeId === placeId);
      if (!existing) {
        return;
      }

      queryClient.setQueryData(queryKeys.favoriteStores, previous ? {
        ...previous,
        items: previous.items.filter((item) => item.placeId !== placeId),
      } : previous);

      try {
        await removeFavoriteMutation.mutateAsync(existing.id);
      } catch {
        queryClient.setQueryData(queryKeys.favoriteStores, previous);
      }
      return;
    }

    const optimisticItem = {
      id: Date.now(),
      placeId: store.placeId,
      storeName: store.name,
      address: store.address,
      phoneNumber: store.phoneNumber,
      mapsUrl: buildDirectionsUrl(store),
      rating: store.rating ?? null,
      isOpen: store.isOpen,
      latitude: store.position.lat,
      longitude: store.position.lng,
      metadata: {
        image: store.photoUrl,
        matchedKeyword: store.matchedKeyword,
        distanceMeters: store.distanceMeters,
      },
      createdAt: new Date().toISOString(),
    };

    queryClient.setQueryData(queryKeys.favoriteStores, previous ? {
      ...previous,
      items: [optimisticItem, ...previous.items],
    } : {
      items: [optimisticItem],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    try {
      await saveFavoriteMutation.mutateAsync({
        placeId: store.placeId,
        storeName: store.name,
        address: store.address,
        phoneNumber: store.phoneNumber,
        mapsUrl: buildDirectionsUrl(store),
        rating: store.rating ?? null,
        isOpen: store.isOpen,
        latitude: store.position.lat,
        longitude: store.position.lng,
        metadata: {
          image: store.photoUrl,
          matchedKeyword: store.matchedKeyword,
          distanceMeters: store.distanceMeters,
        },
      });
    } catch {
      queryClient.setQueryData(queryKeys.favoriteStores, previous);
    }
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
    error: error || (favoriteStoresQuery.error instanceof Error ? favoriteStoresQuery.error.message : ""),
    locate,
  };
}
