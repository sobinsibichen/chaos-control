import { motion } from "framer-motion";
import { FiHeart, FiMapPin, FiNavigation, FiPhone, FiStar } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import { type NearbyStore, buildDirectionsUrl, formatDistance } from "@/services/googlePlaces";

interface ShopCardProps {
  store: NearbyStore;
  favorite: boolean;
  selected: boolean;
  onToggleFavorite: (placeId: string) => void;
  onSelect: (placeId: string) => void;
}

export function ShopCard({
  store,
  favorite,
  selected,
  onToggleFavorite,
  onSelect,
}: ShopCardProps) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={() => onSelect(store.placeId)}
      className={`overflow-hidden rounded-[2rem] border bg-white shadow-[0_20px_44px_rgba(15,23,42,0.08)] transition-all ${
        selected ? "border-slate-900/70 shadow-[0_24px_56px_rgba(15,23,42,0.14)]" : "border-black/5"
      }`}
    >
      <div className="relative h-40 overflow-hidden bg-[radial-gradient(circle_at_top,#fde68a,transparent_55%),linear-gradient(135deg,#f8fafc,#e2e8f0)]">
        {store.photoUrl ? (
          <img
            src={store.photoUrl}
            alt={store.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
            No preview available
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-900 backdrop-blur">
          {formatDistance(store.distanceMeters)}
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(store.placeId);
          }}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm backdrop-blur transition-transform hover:scale-105"
        >
          {favorite ? <FaHeart className="h-4 w-4 text-rose-500" /> : <FiHeart className="h-4 w-4" />}
        </button>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{store.name}</h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <FiMapPin className="h-4 w-4" />
                <span className="line-clamp-2">{store.address}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
              <div className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                <FiStar className="h-4 w-4 text-amber-500" />
                {store.rating?.toFixed(1) ?? "N/A"}
              </div>
              <div className={`mt-1 text-[11px] font-medium ${store.isOpen ? "text-emerald-600" : "text-slate-500"}`}>
                {store.isOpen === null ? "Status unknown" : store.isOpen ? "Open now" : "Closed"}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {store.phoneNumber ?? "Phone number unavailable"}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <a
            href={buildDirectionsUrl(store)}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-3 text-xs font-semibold text-white transition-transform hover:scale-[1.01]"
          >
            <FiNavigation className="h-4 w-4" />
            Directions
          </a>
          <a
            href={store.phoneNumber ? `tel:${store.phoneNumber}` : undefined}
            onClick={(event) => {
              if (!store.phoneNumber) {
                event.preventDefault();
              }
              event.stopPropagation();
            }}
            className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-semibold transition-transform hover:scale-[1.01] ${
              store.phoneNumber
                ? "bg-amber-100 text-amber-900"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            <FiPhone className="h-4 w-4" />
            Call
          </a>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(store.placeId);
            }}
            className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-semibold transition-transform hover:scale-[1.01] ${
              favorite ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
            }`}
          >
            {favorite ? <FaHeart className="h-4 w-4" /> : <FiHeart className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </motion.article>
  );
}
