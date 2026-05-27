import { useEffect, useMemo, useRef } from "react";
import { GoogleMap, InfoWindow, Marker } from "@react-google-maps/api";
import { FiNavigation } from "react-icons/fi";
import type { LatLngLiteral, NearbyStore } from "@/services/googlePlaces";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const fallbackCenter = { lat: 20.5937, lng: 78.9629 };

interface GoogleMapViewProps {
  currentLocation: LatLngLiteral | null;
  stores: NearbyStore[];
  selectedStoreId: string | null;
  onSelectStore: (placeId: string | null) => void;
  onLocateMe: () => void;
}

export function GoogleMapView({
  currentLocation,
  stores,
  selectedStoreId,
  onSelectStore,
  onLocateMe,
}: GoogleMapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const selectedStore = useMemo(
    () => stores.find((store) => store.placeId === selectedStoreId) ?? null,
    [selectedStoreId, stores],
  );

  useEffect(() => {
    if (!mapRef.current || !stores.length) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    if (currentLocation) {
      bounds.extend(currentLocation);
    }

    for (const store of stores) {
      bounds.extend(store.location);
    }

    mapRef.current.fitBounds(bounds, 64);
  }, [currentLocation, stores]);

  return (
    <div className="relative h-[24rem] overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_28px_60px_rgba(15,23,42,0.12)]">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={currentLocation ?? fallbackCenter}
        zoom={14}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        options={{
          disableDefaultUI: true,
          clickableIcons: false,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        }}
      >
        {currentLocation ? (
          <Marker
            position={currentLocation}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#111827",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
              scale: 8,
            }}
          />
        ) : null}

        {stores.map((store) => (
          <Marker
            key={store.placeId}
            position={store.location}
            onClick={() => onSelectStore(store.placeId)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: store.placeId === selectedStoreId ? "#0f172a" : "#f97316",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
              scale: store.placeId === selectedStoreId ? 8 : 7,
            }}
          />
        ))}

        {selectedStore ? (
          <InfoWindow
            position={selectedStore.location}
            onCloseClick={() => onSelectStore(null)}
          >
            <div className="max-w-[14rem] pr-1 text-slate-900">
              <div className="text-sm font-semibold">{selectedStore.name}</div>
              <div className="mt-1 text-xs text-slate-600">{selectedStore.address}</div>
              <div className="mt-2 text-[11px] font-medium text-slate-500">
                {selectedStore.isOpen === null
                  ? "Hours unavailable"
                  : selectedStore.isOpen
                    ? "Open now"
                    : "Closed"}
              </div>
            </div>
          </InfoWindow>
        ) : null}
      </GoogleMap>

      <button
        onClick={onLocateMe}
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_36px_rgba(15,23,42,0.16)] transition-transform hover:scale-[1.02]"
      >
        <FiNavigation className="h-4 w-4" />
        My Location
      </button>
    </div>
  );
}
