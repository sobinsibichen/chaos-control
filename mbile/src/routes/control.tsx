import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  Camera,
  Chrome,
  Clock3,
  Globe,
  Heart,
  LayoutGrid,
  MessageSquare,
  Music4,
  Pizza,
  Plus,
  Search,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
  Video,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/lp/AppShell";
import { ControlEnhancements } from "@/components/lp/control/ControlEnhancements";
import { GlassCard } from "@/components/lp/GlassCard";
import { MentalStabilityChallenge } from "@/components/lp/damage/MentalStabilityChallenge";
import { apiRequest } from "@/lib/api";
import { appStore, useAppStore } from "@/lib/app-store";
import {
  getInstalledApps,
  getNativeProtectionStatus,
  isNativeAndroid,
  openNativeAccessibilitySettings,
  relockNativeProtection,
  syncNativeProtectionConfig,
  type NativeInstalledApp,
  type NativeProtectionStatus,
  unlockNativeProtectionForToday,
} from "@/lib/native/mobile";

export const Route = createFileRoute("/control")({
  head: () => ({ meta: [{ title: "Damage Control - Last Puff" }] }),
  component: ControlPage,
});

const appCatalog = [
  { appName: "Instagram", packageName: "com.instagram.android", appIcon: "Camera", warningMessage: "Doom scrolling usually starts here." },
  { appName: "Amazon", packageName: "com.amazon.mShop.android.shopping", appIcon: "ShoppingCart", warningMessage: "Impulse shopping can wait." },
  { appName: "YouTube", packageName: "com.google.android.youtube", appIcon: "Video", warningMessage: "One video can become an hour." },
  { appName: "Chrome", packageName: "com.android.chrome", appIcon: "Chrome", warningMessage: "Late-night browsing feeds cravings." },
  { appName: "Snapchat", packageName: "com.snapchat.android", appIcon: "MessageSquare", warningMessage: "Protect your attention span." },
  { appName: "Spotify", packageName: "com.spotify.music", appIcon: "Music4", warningMessage: "Some playlists trigger the habit loop." },
  { appName: "Zomato", packageName: "com.application.zomato", appIcon: "Pizza", warningMessage: "Midnight ordering can become autopilot." },
  { appName: "Tinder", packageName: "com.tinder", appIcon: "Heart", warningMessage: "Guard your impulse window." },
  { appName: "Flipkart", packageName: "com.flipkart.android", appIcon: "ShoppingBag", warningMessage: "Keep the wallet calm tonight." },
  { appName: "Maps", packageName: "com.google.android.apps.maps", appIcon: "Globe", warningMessage: "Protected by Last Puff." },
];

const iconMap = {
  Camera,
  Chrome,
  Globe,
  Heart,
  LayoutGrid,
  MessageSquare,
  Music4,
  Pizza,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Video,
};

interface AppItem {
  id: number;
  app_name: string;
  package_name?: string | null;
  app_icon: keyof typeof iconMap;
  warning_message: string;
  is_active: boolean;
}

interface CatalogApp {
  appName: string;
  packageName: string;
  appIcon: keyof typeof iconMap;
  warningMessage: string;
}

const fallbackAppIcon: keyof typeof iconMap = "LayoutGrid";

const halfHourOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

function inferAppPresentation(appName: string, packageName: string) {
  const haystack = `${appName} ${packageName}`.toLowerCase();

  if (haystack.includes("instagram") || haystack.includes("camera")) {
    return { appIcon: "Camera" as const, warningMessage: "Short taps can become a long scrolling spiral." };
  }
  if (haystack.includes("chrome") || haystack.includes("browser")) {
    return { appIcon: "Chrome" as const, warningMessage: "Late-night browsing tends to wake up cravings." };
  }
  if (haystack.includes("youtube") || haystack.includes("video") || haystack.includes("netflix")) {
    return { appIcon: "Video" as const, warningMessage: "One clip can quietly turn into an hour." };
  }
  if (haystack.includes("spotify") || haystack.includes("music")) {
    return { appIcon: "Music4" as const, warningMessage: "Some playlists are habit triggers." };
  }
  if (haystack.includes("amazon") || haystack.includes("shopping") || haystack.includes("flipkart")) {
    return { appIcon: "ShoppingCart" as const, warningMessage: "Impulse spending can wait." };
  }
  if (haystack.includes("snap") || haystack.includes("whatsapp") || haystack.includes("telegram") || haystack.includes("message")) {
    return { appIcon: "MessageSquare" as const, warningMessage: "Protect your attention before opening chat loops." };
  }
  if (haystack.includes("map") || haystack.includes("globe")) {
    return { appIcon: "Globe" as const, warningMessage: "Protected by Last Puff." };
  }
  if (haystack.includes("zomato") || haystack.includes("swiggy") || haystack.includes("pizza") || haystack.includes("food")) {
    return { appIcon: "Pizza" as const, warningMessage: "Late cravings often start with food apps too." };
  }
  if (haystack.includes("tinder") || haystack.includes("dating")) {
    return { appIcon: "Heart" as const, warningMessage: "Guard the impulse window." };
  }

  return { appIcon: fallbackAppIcon, warningMessage: "Protected by Last Puff." };
}

function ViewportPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

function isNativePluginUnavailable(error: unknown) {
  return error instanceof Error && /not implemented|unavailable|does not have an implementation/i.test(error.message);
}

function ControlPage() {
  const unlockedApps = useAppStore((state) => state.damage.unlockedApps);
  const unlockFailures = useAppStore((state) => state.damage.unlockFailures);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue);
  const [blockTime, setBlockTime] = useState("22:00");
  const [apps, setApps] = useState<AppItem[]>([]);
  const [draftSelectedPackages, setDraftSelectedPackages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [installedApps, setInstalledApps] = useState<CatalogApp[]>([]);
  const [nativeProtectionStatus, setNativeProtectionStatus] = useState<NativeProtectionStatus | null>(null);
  const hasLoadedRef = useRef(false);
  const installedAppsLoadedRef = useRef(false);

  useEffect(() => {
    const loadApps = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const response = await apiRequest<{
          success: boolean;
          apps: AppItem[];
          schedule: { block_time: string } | null;
        }>("/api/apps");
        setApps(response.apps);
        if (response.schedule?.block_time) {
          setBlockTime(response.schedule.block_time.slice(0, 5));
        }
        if (isNativeAndroid()) {
          try {
            const status = await getNativeProtectionStatus();
            setNativeProtectionStatus(status);
          } catch (error) {
            if (!isNativePluginUnavailable(error)) {
              throw error;
            }
          }
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load app controls.");
      } finally {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    };

    void loadApps();
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSavingSchedule(true);
        await apiRequest("/api/apps/schedule", {
          method: "POST",
          body: JSON.stringify({ blockTime, frequency: "daily", enabled: true }),
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to save schedule.");
      } finally {
        setSavingSchedule(false);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [blockTime]);

  useEffect(() => {
    if (!isNativeAndroid() || !hasLoadedRef.current) {
      return;
    }

    const sync = async () => {
      try {
        const status = await syncNativeProtectionConfig({
          apps: apps.map((app) => ({
            appName: app.app_name,
            packageName: app.package_name || app.app_name,
            isActive: app.is_active,
          })),
          blockTime,
        });

        setNativeProtectionStatus(status);
      } catch (error) {
        if (!isNativePluginUnavailable(error)) {
          throw error;
        }
      }
    };

    void sync().catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sync native protection settings.");
    });
  }, [apps, blockTime]);

  const selectedAppsCount = apps.filter((item) => item.is_active).length;

  const pickerApps = useMemo(() => {
    const sourceApps = isNativeAndroid() ? installedApps : installedApps.length ? installedApps : appCatalog;
    const merged = sourceApps.map((catalogItem, index) => {
      const existing = apps.find(
        (app) =>
          app.package_name === catalogItem.packageName ||
          app.app_name.toLowerCase() === catalogItem.appName.toLowerCase(),
      );

      return {
        id: existing?.id ?? index + 1,
        appName: existing?.app_name ?? catalogItem.appName,
        packageName: existing?.package_name ?? catalogItem.packageName,
        appIcon: (existing?.app_icon ?? catalogItem.appIcon) as keyof typeof iconMap,
        warningMessage: existing?.warning_message ?? catalogItem.warningMessage,
        isSelected: existing?.is_active ?? false,
      };
    });

    const search = deferredSearch.trim().toLowerCase();
    if (!search) {
      return merged;
    }

    return merged.filter((item) => item.appName.toLowerCase().includes(search));
  }, [apps, deferredSearch, installedApps]);

  const appsToRender = apps.map((item) => {
    const catalogFallback = appCatalog.find(
      (entry) =>
        entry.packageName === item.package_name ||
        entry.appName.toLowerCase() === item.app_name.toLowerCase(),
    );

    return {
      ...item,
      app: item.app_name,
      icon: iconMap[item.app_icon] || iconMap[catalogFallback?.appIcon || "ShieldAlert"],
      why: item.warning_message || catalogFallback?.warningMessage || "Protected by Last Puff.",
      isProtected: item.is_active,
    };
  });

  const openPicker = () => {
    const loadInstalledApps = async () => {
      if (!isNativeAndroid() || installedAppsLoadedRef.current) {
        return;
      }

      const nativeApps = await getInstalledApps();
      const normalized = nativeApps.map((item: NativeInstalledApp) => {
        const inferred = inferAppPresentation(item.appName, item.packageName);
        return {
          appName: item.appName,
          packageName: item.packageName,
          appIcon: inferred.appIcon,
          warningMessage: inferred.warningMessage,
        };
      });

      setInstalledApps(normalized);
      installedAppsLoadedRef.current = true;
    };

    setPickerLoading(true);
    setDraftSelectedPackages(
      apps
        .filter((app) => app.is_active)
        .map((app) => app.package_name || app.app_name),
    );
    setPickerOpen(true);
    void loadInstalledApps()
      .catch((error: unknown) => {
        setErrorMessage(
          isNativePluginUnavailable(error)
            ? "Android app access will work after installing this updated APK."
            : error instanceof Error
              ? error.message
              : "Unable to read installed apps from this phone.",
        );
      })
      .finally(() => {
        window.setTimeout(() => setPickerLoading(false), 200);
      });
  };

  const toggleDraftSelection = (catalogApp: CatalogApp) => {
    const key = catalogApp.packageName || catalogApp.appName;
    setDraftSelectedPackages((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const saveSelectedApps = async () => {
    const sourceApps = isNativeAndroid() ? installedApps : installedApps.length ? installedApps : appCatalog;
    const selectedApps = sourceApps.filter((item) =>
      draftSelectedPackages.includes(item.packageName || item.appName),
    );

    if (!selectedApps.length) {
      setPickerOpen(false);
      return;
    }

    try {
      setSavingSelection(true);
      setErrorMessage("");
      const response = await apiRequest<{
        success: boolean;
        apps: AppItem[];
        schedule: { block_time: string } | null;
      }>("/api/apps/save-selection", {
        method: "POST",
        body: JSON.stringify({
          apps: selectedApps,
        }),
      });
      setApps(response.apps);
      setPickerOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save selected apps.");
    } finally {
      setSavingSelection(false);
    }
  };

  const toggleSelectedApp = async (app: AppItem) => {
    const nextIsActive = !app.is_active;
    setApps((current) => current.map((item) => (item.id === app.id ? { ...item, is_active: nextIsActive } : item)));

    try {
      await apiRequest("/api/apps/toggle", {
        method: "PUT",
        body: JSON.stringify({ id: app.id, isActive: nextIsActive }),
      });
    } catch (error) {
      setApps((current) => current.map((item) => (item.id === app.id ? { ...item, is_active: app.is_active } : item)));
      setErrorMessage(error instanceof Error ? error.message : "Unable to update blocked app.");
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Protection</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">App Controls</h1>
      </div>

      <GlassCard glow="red" className="relative mb-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-foreground/10 bg-card shadow-sm">
            <ShieldAlert className="h-6 w-6 text-rose-600" strokeWidth={2} />
          </div>
          <div className="flex-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Status</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {unlockedApps ? "Protection Disabled" : selectedAppsCount ? "Protection Active" : "Protection Idle"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {unlockedApps ? "Apps are accessible. Proceed with caution." : `${selectedAppsCount} apps blocked. You're safe.`}
            </div>
          </div>
        </div>
      </GlassCard>

      {isNativeAndroid() ? (
        <GlassCard className="mb-6 border border-foreground/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Android Protection</div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {nativeProtectionStatus?.accessibilityEnabled ? "Accessibility enabled" : "Needs accessibility permission"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {nativeProtectionStatus?.accessibilityEnabled
                  ? "Selected apps will be intercepted after the scheduled time unless you unlock them for today."
                  : "Turn on Android accessibility for Last Puff so selected apps can actually be blocked."}
              </div>
            </div>
            <button
              onClick={() => void openNativeAccessibilitySettings()}
              className="rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
            >
              Open Settings
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-foreground/10 bg-card p-3 shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Protected</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{nativeProtectionStatus?.blockedAppsCount ?? selectedAppsCount}</div>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card p-3 shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Window</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{nativeProtectionStatus?.withinBlockedWindow ? "Active" : "Waiting"}</div>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card p-3 shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Unlock</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{nativeProtectionStatus?.unlockedForToday ? "Granted" : "Locked"}</div>
            </div>
          </div>
        </GlassCard>
      ) : null}

      <ControlEnhancements />

      <GlassCard className="mb-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5">
            <Clock3 className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Auto-Block Schedule</div>
            <div className="mt-1 text-lg font-semibold text-foreground">Set a daily block time</div>
            <div className="mt-1 text-xs text-muted-foreground">Choose a time and the apps you want to auto-block every day.</div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Block Time</div>
            <div className="flex items-center gap-3">
              <select
                value={blockTime}
                onChange={(event) => setBlockTime(event.target.value)}
                className="w-full rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-sm text-foreground outline-none"
              >
                {halfHourOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-sm font-semibold text-foreground">
                Daily
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">{savingSchedule ? "Saving schedule..." : "Schedule saved automatically."}</div>
          </div>

          <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Choose Apps</div>
              <LayoutGrid className="h-4 w-4 text-sky-600" />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={openPicker}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,23,42,0.18)] transition-all hover:bg-black/90"
            >
              <Plus className="h-4 w-4" />
              Choose Apps
            </motion.button>

            <div className="mt-3 text-[11px] text-muted-foreground">
              {isNativeAndroid()
                ? "This reads the installed app list from your phone and saves the selected apps to protection."
                : "On web preview this falls back to the demo app catalog."}
            </div>

            <div className="mt-4 space-y-2">
              {appsToRender.length ? (
                appsToRender.map((item, index) => {
                  const Icon = item.icon;
                  const active = item.isProtected;

                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => void toggleSelectedApp(item)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/10 bg-background text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-background/10" : "bg-foreground/5"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{item.app}</div>
                        <div className={`mt-1 text-[11px] ${active ? "text-background/75" : "text-muted-foreground"}`}>
                          Tap to block or unblock this app
                        </div>
                      </div>
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-background bg-background text-foreground" : "border-foreground/10 bg-card text-foreground"}`}>
                        {active ? "OK" : ""}
                      </div>
                    </motion.button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-foreground/10 bg-background px-4 py-5 text-center">
                  <div className="text-sm font-semibold text-foreground">No protected apps selected yet.</div>
                  <div className="mt-1 text-xs text-muted-foreground">Choose apps that trigger cravings or impulsive behavior.</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-background px-4 py-3 shadow-sm">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Selected Apps</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{selectedAppsCount} chosen</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Time</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{blockTime}</div>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Blocked Applications</div>
      </div>
      {errorMessage ? <div className="mb-4 text-sm text-red-500">{errorMessage}</div> : null}
      <div className="space-y-2.5">
        {appsToRender.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <GlassCard className="!p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/5">
                  <item.icon className="h-5 w-5" />
                  <div
                    className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-background text-[10px] font-bold ${
                      unlockedApps ? "bg-emerald-400 text-background" : item.isProtected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {unlockedApps ? "OK" : item.isProtected ? "ON" : "OFF"}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{item.app}</div>
                  <div className="text-[11px] text-muted-foreground">{item.why}</div>
                </div>
                <button
                  onClick={() => {
                    if (unlockedApps) {
                      appStore.relockApps();
                      void relockNativeProtection()
                        .then((status) => setNativeProtectionStatus(status))
                        .catch(() => {});
                      return;
                    }
                    setChallengeOpen(true);
                  }}
                  className={`rounded-2xl px-3 py-1.5 text-[11px] font-medium transition-all ${
                    unlockedApps
                      ? "border border-emerald-400/30 bg-emerald-50 text-emerald-600"
                      : "border border-primary/20 bg-primary text-primary-foreground shadow-sm"
                  }`}
                >
                  {unlockedApps ? "Unlocked" : "Verify"}
                </button>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard glow="orange" className="mt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5">
            <BrainCircuit className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Unlock Verification</div>
            <div className="mt-1 text-lg font-semibold text-foreground">Mental Stability Challenge</div>
            <p className="mt-1 text-xs text-muted-foreground">Copy text with 100% accuracy. No shortcuts.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-foreground/10 bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Failed</div>
            <div className="mt-2 text-2xl font-bold text-red-400">{unlockFailures}</div>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Required</div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">100%</div>
          </div>
        </div>

        <button
          onClick={() => setChallengeOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_16px_34px_rgba(15,23,42,0.16)] transition-all hover:bg-primary/90"
        >
          <TriangleAlert className="h-4 w-4 text-amber-500" />
          Start Challenge
        </button>
      </GlassCard>

      <MentalStabilityChallenge
        open={challengeOpen}
        onClose={() => setChallengeOpen(false)}
        onResult={(result) => {
          if (result.passed) {
            void unlockNativeProtectionForToday()
              .then((status) => setNativeProtectionStatus(status))
              .catch((error: unknown) => {
                setErrorMessage(error instanceof Error ? error.message : "Unable to unlock protected apps.");
              });
          } else {
            void relockNativeProtection()
              .then((status) => setNativeProtectionStatus(status))
              .catch(() => {});
          }

          void apiRequest("/api/apps/verify", {
            method: "POST",
            body: JSON.stringify(result),
          }).catch((error: unknown) => {
            setErrorMessage(error instanceof Error ? error.message : "Unable to save verification result.");
          });
        }}
      />

      <ViewportPortal>
        <AnimatePresence>
          {pickerOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPickerOpen(false)}
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.98 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/20 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl"
              >
                <div className="px-5 pb-5 pt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Choose Apps</div>
                      <div className="mt-1 text-xl font-semibold text-foreground">Protected App Picker</div>
                      <div className="mt-1 text-xs text-muted-foreground">Choose the apps you want blocked, then save. Nothing is pre-added anymore.</div>
                      {isNativeAndroid() ? (
                        <div className="mt-1 text-xs text-muted-foreground">These apps are being read from your Android device.</div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => setPickerOpen(false)}
                      className="rounded-full border border-foreground/10 bg-card px-3 py-2 text-xs font-semibold text-foreground"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3 shadow-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Search apps"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                    {pickerLoading
                      ? Array.from({ length: 6 }).map((_, index) => (
                          <div key={index} className="animate-pulse rounded-2xl border border-foreground/10 bg-card px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-foreground/10" />
                              <div className="flex-1">
                                <div className="h-3 w-28 rounded bg-foreground/10" />
                                <div className="mt-2 h-3 w-20 rounded bg-foreground/10" />
                              </div>
                              <div className="h-5 w-5 rounded border border-foreground/10" />
                            </div>
                          </div>
                        ))
                      : pickerApps.map((item, index) => {
                          const Icon = iconMap[item.appIcon] || ShieldAlert;
                          const key = item.packageName || item.appName;
                          const selected = draftSelectedPackages.includes(key);

                          return (
                            <motion.button
                              key={key}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              onClick={() => toggleDraftSelection(item)}
                              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                                selected
                                  ? "border-black bg-white text-foreground"
                                  : "border-foreground/10 bg-white text-foreground"
                              }`}
                            >
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? "bg-black/5" : "bg-foreground/5"}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold">{item.appName}</div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {item.packageName}
                                </div>
                              </div>
                              <div className={`h-5 w-5 rounded-full border ${selected ? "border-black bg-black" : "border-foreground/20 bg-white"}`} />
                            </motion.button>
                          );
                        })}

                    {!pickerLoading && !pickerApps.length ? (
                      <div className="rounded-2xl border border-dashed border-foreground/10 bg-card px-4 py-8 text-center">
                        <div className="text-sm font-semibold text-foreground">
                          {isNativeAndroid() ? "No phone apps were loaded." : "No apps matched your search."}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {isNativeAndroid()
                            ? "Open the picker again after installing the updated APK."
                            : "Try searching by app name instead."}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-foreground/10 bg-card px-4 py-3 shadow-sm">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Selected</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{draftSelectedPackages.length} apps ready</div>
                    </div>
                    <button
                      onClick={() => void saveSelectedApps()}
                      disabled={savingSelection}
                      className="rounded-full bg-black px-4 py-3 text-xs font-semibold text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition-all hover:bg-black/90 disabled:opacity-70"
                    >
                      {savingSelection ? "Saving..." : "Save Selected Apps"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ViewportPortal>

      {loading ? <div className="mt-4 text-center text-xs text-muted-foreground">Loading live app controls...</div> : null}
    </AppShell>
  );
}
