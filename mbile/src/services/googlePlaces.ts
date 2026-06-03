export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface NearbyStore {
  placeId: string;
  name: string;
  address: string;
  phoneNumber: string | null;
  rating: number | null;
  isOpen: boolean | null;
  photoUrl: string | null;
  mapsUrl: string;
  location: LatLngLiteral;
  distanceMeters: number;
  matchedKeyword: string;
}

const DEFAULT_RADIUS_METERS = 5000;
const MAX_RESULTS = 12;

const SEARCH_ALIASES: Array<{ match: RegExp; keywords: string[] }> = [
  { match: /(smoke|cigarette|tobacco)/i, keywords: ["smoke shop", "tobacco store", "vape store", "convenience store"] },
  { match: /(vape)/i, keywords: ["vape store", "smoke shop", "tobacco store"] },
  { match: /(tea|chai)/i, keywords: ["tea shop", "chai cafe", "tea house"] },
  { match: /(mrp)/i, keywords: ["wine shop", "liquor store", "beverage store"] },
  { match: /(restaurant|food|dining)/i, keywords: ["restaurant", "food court", "dining"] },
  { match: /(bar|pub)/i, keywords: ["bar", "pub", "lounge"] },
  { match: /(petrol|fuel|gas|pump)/i, keywords: ["petrol pump", "fuel station", "gas station"] },
  { match: /(cafe|coffee)/i, keywords: ["cafe", "coffee shop", "tea shop"] },
  { match: /(convenience|general|grocery)/i, keywords: ["convenience store", "grocery store", "mini mart"] },
  { match: /(24\/7|24x7|open now|open)/i, keywords: ["24/7 convenience store", "late night cafe", "open tea shop"] },
];

function uniqueKeywords(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function expandSearchKeywords(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return ["convenience store", "tea shop", "cafe"];
  }

  const matched = SEARCH_ALIASES.flatMap((entry) => (entry.match.test(trimmed) ? entry.keywords : []));
  return uniqueKeywords([trimmed, ...matched]);
}

function toLatLngLiteral(location?: google.maps.LatLng | null): LatLngLiteral | null {
  if (!location) {
    return null;
  }

  return { lat: location.lat(), lng: location.lng() };
}

function distanceBetween(a: LatLngLiteral, b: LatLngLiteral) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const arc =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadius * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function buildMapsUrl(place: google.maps.places.PlaceResult, location: LatLngLiteral) {
  if (place.url) {
    return place.url;
  }

  return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}&query_place_id=${place.place_id ?? ""}`;
}

function getPhotoUrl(place: google.maps.places.PlaceResult) {
  return place.photos?.[0]?.getUrl({ maxWidth: 1200, maxHeight: 800 }) ?? null;
}

function nearbySearch(
  service: google.maps.places.PlacesService,
  request: google.maps.places.PlaceSearchRequest,
) {
  return new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        resolve(results);
        return;
      }

      if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
        return;
      }

      reject(new Error(`Nearby search failed with status: ${status}`));
    });
  });
}

function getDetails(
  service: google.maps.places.PlacesService,
  placeId: string,
) {
  return new Promise<google.maps.places.PlaceResult | null>((resolve, reject) => {
    service.getDetails(
      {
        placeId,
        fields: [
          "place_id",
          "name",
          "formatted_address",
          "formatted_phone_number",
          "geometry",
          "opening_hours",
          "photos",
          "rating",
          "url",
          "vicinity",
        ],
      },
      (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result) {
          resolve(result);
          return;
        }

        if (status === google.maps.places.PlacesServiceStatus.NOT_FOUND) {
          resolve(null);
          return;
        }

        reject(new Error(`Place details failed with status: ${status}`));
      },
    );
  });
}

function createService() {
  return new google.maps.places.PlacesService(document.createElement("div"));
}

export async function searchNearbyStores(options: {
  location: LatLngLiteral;
  query: string;
  radiusMeters?: number;
}) {
  if (!window.google?.maps?.places) {
    throw new Error("Google Maps Places library is not ready yet.");
  }

  const service = createService();
  const radius = options.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const keywords = expandSearchKeywords(options.query);

  const allResults = await Promise.all(
    keywords.map(async (keyword) => {
      const results = await nearbySearch(service, {
        location: options.location,
        radius,
        keyword,
      });

      return results.map((result) => ({ keyword, result }));
    }),
  );

  const deduped = new Map<string, { keyword: string; result: google.maps.places.PlaceResult }>();
  for (const group of allResults) {
    for (const item of group) {
      const placeId = item.result.place_id;
      if (!placeId || deduped.has(placeId)) {
        continue;
      }

      deduped.set(placeId, item);
    }
  }

  const ranked = [...deduped.values()]
    .map((item) => {
      const location = toLatLngLiteral(item.result.geometry?.location);
      if (!location) {
        return null;
      }

      return {
        ...item,
        location,
        distanceMeters: distanceBetween(options.location, location),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, MAX_RESULTS);

  const enriched = await Promise.all(
    ranked.map(async (item) => {
      let details: google.maps.places.PlaceResult | null = null;

      try {
        details = await getDetails(service, item.result.place_id!);
      } catch {
        details = null;
      }

      const finalPlace = details ?? item.result;
      const finalLocation = toLatLngLiteral(finalPlace.geometry?.location) ?? item.location;

      return {
        placeId: finalPlace.place_id ?? item.result.place_id!,
        name: finalPlace.name ?? item.result.name ?? "Unnamed store",
        address: finalPlace.formatted_address ?? finalPlace.vicinity ?? item.result.vicinity ?? "Address unavailable",
        phoneNumber: finalPlace.formatted_phone_number ?? null,
        rating: finalPlace.rating ?? item.result.rating ?? null,
        isOpen: finalPlace.opening_hours?.open_now ?? item.result.opening_hours?.open_now ?? null,
        photoUrl: getPhotoUrl(finalPlace) ?? getPhotoUrl(item.result),
        mapsUrl: buildMapsUrl(finalPlace, finalLocation),
        location: finalLocation,
        distanceMeters: distanceBetween(options.location, finalLocation),
        matchedKeyword: item.keyword,
      } satisfies NearbyStore;
    }),
  );

  return enriched.sort((left, right) => left.distanceMeters - right.distanceMeters);
}

export function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m away`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

export function buildDirectionsUrl(store: NearbyStore) {
  return `https://www.google.com/maps/dir/?api=1&destination=${store.location.lat},${store.location.lng}&destination_place_id=${store.placeId}`;
}
