import { useMemo } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { motion } from "framer-motion";
import { FiClock, FiHeart, FiMapPin, FiNavigation, FiSearch } from "react-icons/fi";
import { AppShell } from "@/components/lp/AppShell";
import { GoogleMapView } from "@/components/lp/nearby-shops/GoogleMapView";
import { ShopCard } from "@/components/lp/nearby-shops/ShopCard";
import { useNearbyPlaces } from "@/hooks/useNearbyPlaces";

const libraries: "places"[] = ["places"];

const suggestions = [
  "smoke shops near me",
  "mrp near me",
  "tea shops near me",
  "restaurants near me",
  "bar near me",
  "petrol pump near me",
];

function LoadingCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_20px_44px_rgba(15,23,42,0.05)]">
      <div className="h-40 bg-slate-200" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-1/2 rounded bg-slate-200" />
        <div className="h-4 w-4/5 rounded bg-slate-200" />
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="h-11 rounded-2xl bg-slate-200" />
          <div className="h-11 rounded-2xl bg-slate-200" />
          <div className="h-11 rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

export function NearbyShops() {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
  const hasGoogleMapsKey = apiKey.length > 0 && !apiKey.includes("YOUR_") && !apiKey.includes("REPLACE_");
  const { isLoaded, loadError } = useJsApiLoader({
    id: "last-puff-nearby-stores-map",
    googleMapsApiKey: hasGoogleMapsKey ? apiKey : "",
    libraries,
    // Required when the key is restricted by HTTP referrer in Google Cloud.
    authReferrerPolicy: "origin",
  });

  const {
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
  } = useNearbyPlaces(hasGoogleMapsKey && isLoaded && !loadError);

  const selectedStore = useMemo(
    () => stores.find((store) => store.placeId === selectedStoreId) ?? null,
    [selectedStoreId, stores],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_18px_36px_rgba(15,23,42,0.05)]">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Nearby Stores</div>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-900">
              Smart nearby store finder
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
              Search live nearby places around your current location with real map results, store details, favorites, and quick actions.
            </p>

            <div className="mt-5 rounded-[1.5rem] border border-black/5 bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-3 rounded-[1.2rem] bg-slate-50 px-4 py-3">
                <FiSearch className="h-4 w-4 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search nearby stores"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setSearchTerm(suggestion)}
                    className="snap-start whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-black/5 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Favorites</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {favoriteStores.length ? `${favoriteStores.length} saved places` : "No favorite places yet"}
                  </div>
                </div>
                <FiHeart className="h-5 w-5 text-rose-500" />
              </div>

              {favoriteStores.length ? (
                <div className="mt-3 space-y-2">
                  {favoriteStores.slice(0, 4).map((store) => (
                    <a
                      key={store.id}
                      href={store.mapsUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-3 py-3 shadow-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <FiNavigation className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{store.storeName}</div>
                        <div className="truncate text-xs text-slate-500">{store.address}</div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.8rem] border border-black/5 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Status</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {locating ? "Locating..." : location ? "Live location active" : "Waiting for location"}
            </div>
          </div>
          <div className="rounded-[1.8rem] border border-black/5 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Results</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{stores.length} stores found</div>
          </div>
          <div className="rounded-[1.8rem] border border-black/5 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Saved</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{favoriteIds.size} favorites</div>
          </div>
        </div>

        {!hasGoogleMapsKey ? (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Add `VITE_GOOGLE_MAPS_API_KEY` to your environment to use Nearby Stores.
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            Google Maps failed to load. Check that your API key has Maps JavaScript API and Places API enabled.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Live Map</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">Explore nearby places</div>
            </div>
            <button
              onClick={() => void locate().catch(() => {})}
              className="glass-button rounded-full px-4 py-3 text-xs font-semibold"
            >
              Refresh Location
            </button>
          </div>

          {isLoaded && !loadError ? (
            <GoogleMapView
              currentLocation={location}
              stores={stores}
              selectedStoreId={selectedStoreId}
              onSelectStore={setSelectedStoreId}
              onLocateMe={() => void locate().catch(() => {})}
            />
          ) : (
            <div className="flex h-[24rem] items-center justify-center rounded-[2rem] border border-black/5 bg-white shadow-[0_28px_60px_rgba(15,23,42,0.08)]">
              <div className="space-y-3 text-center">
                {loadError ? <FiMapPin className="mx-auto h-8 w-8 text-rose-500" /> : <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />}
                <div className="text-sm font-medium text-slate-600">
                  {loadError ? "Map unavailable until the Google API key is fixed." : "Loading interactive map..."}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Nearby Results</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {selectedStore ? selectedStore.name : "Available stores near you"}
              </div>
            </div>
            {selectedStore ? (
              <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                {selectedStore.matchedKeyword}
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <LoadingCard key={index} />
              ))}
            </div>
          ) : stores.length ? (
            <div className="space-y-4">
              {stores.map((store, index) => (
                <motion.div
                  key={store.placeId}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <ShopCard
                    store={store}
                    favorite={favoriteIds.has(store.placeId)}
                    selected={selectedStoreId === store.placeId}
                    onToggleFavorite={toggleFavorite}
                    onSelect={setSelectedStoreId}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-black/10 bg-white px-5 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,0.05)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <FiMapPin className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-semibold text-slate-900">No nearby stores found</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Try a different search like "Cafes nearby" or refresh your location.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-black/5 bg-white p-5 shadow-[0_18px_36px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiClock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Smart Search</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                Queries expand automatically for better nearby results
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Searches like "Smoke shops near me" also check related nearby categories such as tobacco stores, vape shops, and convenience stores to improve live results.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
