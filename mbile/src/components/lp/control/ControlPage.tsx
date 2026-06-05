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
  X,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { MentalStabilityChallenge } from "@/components/lp/damage/MentalStabilityChallenge";
import { apiRequest } from "@/lib/api";
import { appStore, useAppStore } from "@/lib/app-store";
import { enqueueBackgroundSync } from "@/lib/background-sync";
import { sampleMemory, useRenderCounter, useScreenPerformance } from "@/lib/performance";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  getInstalledApps,
  getNativeProtectionStatus,
  enableNativeUninstallProtection,
  isNativeAndroid,
  openNativeAppInfo,
  openNativeAccessibilitySettings,
  openNativeDeviceAdminSettings,
  openNativeOverlaySettings,
  openNativeUsageAccessSettings,
  relockNativeProtection,
  syncNativeProtectionConfig,
  type NativeInstalledApp,
  type NativeProtectionStatus,
  unlockNativeProtectionForToday,
} from "@/lib/native/mobile";

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
const CONTROL_CACHE_KEY = "last-puff-control-cache";
const CONTROL_CACHE_STALE_MS = 5 * 60 * 1000;
const CONTROL_PERMISSION_WIZARD_KEY = "last-puff-control-permission-wizard-complete";
const CONTROL_ACCESSIBILITY_ATTEMPTED_KEY = "last-puff-accessibility-attempted";
const CONTROL_RESTRICTED_SETTINGS_ATTEMPTED_KEY = "last-puff-restricted-settings-attempted";

function formatTime24(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplayTime(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatBlockWindow(startHour: number, startMinute: number, endHour: number, endMinute: number) {
  return `${formatDisplayTime(startHour, startMinute)} → ${formatDisplayTime(endHour, endMinute)}`;
}

function minutesFromTime(hour: number, minute: number) {
  return hour * 60 + minute;
}

function isTimeRangeValid(startHour: number, startMinute: number, endHour: number, endMinute: number) {
  return minutesFromTime(endHour, endMinute) !== minutesFromTime(startHour, startMinute);
}

function parseBlockWindow(blockTime?: string | null) {
  if (!blockTime) {
    return null;
  }

  const normalized = blockTime.replace(/to|→/gi, "-");
  const [startRaw, endRaw] = normalized.split("-");
  const [startHourText, startMinuteText] = (startRaw ?? "").trim().split(":");
  const startHour = Number.parseInt(startHourText ?? "", 10);
  const startMinute = Number.parseInt(startMinuteText ?? "", 10);
  if ([startHour, startMinute].some((value) => Number.isNaN(value))) {
    return null;
  }

  if (!endRaw) {
    return {
      startHour,
      startMinute,
      endHour: defaultEndHour(startHour, startMinute),
      endMinute: defaultEndMinute(startMinute),
    };
  }

  const [endHourText, endMinuteText] = endRaw.trim().split(":");
  const endHour = Number.parseInt(endHourText ?? "", 10);
  const endMinute = Number.parseInt(endMinuteText ?? "", 10);

  if ([endHour, endMinute].some((value) => Number.isNaN(value))) {
    return null;
  }

  return { startHour, startMinute, endHour, endMinute };
}

function isProtectionReady(status: NativeProtectionStatus | null) {
  if (!status) {
    return false;
  }

  return (
    status.usageAccessGranted &&
    status.restrictedSettingsAllowed &&
    status.accessibilityEnabled &&
    status.accessibilityActive &&
    status.overlayPermissionGranted &&
    status.scheduleActive
  );
}

function isUninstallProtectionReady(status: NativeProtectionStatus | null) {
  return Boolean(status?.deviceAdminActive);
}

type PermissionWizardStep = "intro" | "restricted" | "accessibility" | "accessibility-permission-required" | "usage" | "overlay" | "device-admin" | "done";

function PermissionWizard({
  status,
  open,
  onRefresh,
  onComplete,
  onClose,
  accessibilityAttempted,
  onAccessibilityAttempt,
  restrictedSettingsAttempted,
  onRestrictedSettingsAttempt,
}: {
  status: NativeProtectionStatus | null;
  open: boolean;
  onRefresh: () => void;
  onComplete: () => void;
  onClose: () => void;
  accessibilityAttempted: boolean;
  onAccessibilityAttempt: () => void;
  restrictedSettingsAttempted: boolean;
  onRestrictedSettingsAttempt: () => void;
}) {
  const [started, setStarted] = useState(false);
  const effectiveRestrictedSettingsAllowed = Boolean(status?.restrictedSettingsAllowed || restrictedSettingsAttempted);
  
  const nextStep = (() => {
    if (!open) {
      return "done" as PermissionWizardStep;
    }
    if (!started) {
      return "intro" as PermissionWizardStep;
    }
    if (!status) {
      return "intro" as PermissionWizardStep;
    }
    if (!status.accessibilityEnabled || !status.accessibilityActive) {
      if (!effectiveRestrictedSettingsAllowed) {
        return accessibilityAttempted ? "accessibility-permission-required" : "accessibility";
      }
      return "accessibility" as PermissionWizardStep;
    }
    if (!status.usageAccessGranted) {
      return "usage" as PermissionWizardStep;
    }
    if (!status.overlayPermissionGranted) {
      return "overlay" as PermissionWizardStep;
    }
    if (!status.deviceAdminActive) {
      return "device-admin" as PermissionWizardStep;
    }
    return "done" as PermissionWizardStep;
  })();

  const stepConfig: Record<PermissionWizardStep, { title: string; description: string; primary: string; secondary?: string }> = {
    intro: {
      title: "Last Puff needs permissions to protect your focus",
      description: "We'll open the closest Android settings screens and refresh automatically when you return.",
      primary: "Start Setup",
    },
    restricted: {
      title: "Allow Restricted Settings",
      description: "This device blocks accessibility services for sideloaded apps. Tap below and enable \"Allow Restricted Settings\".",
      primary: "Open App Info",
    },
    accessibility: {
      title: "Enable Accessibility Service",
      description: "Click Open Accessibility and just come back here. If Android blocks it, Last Puff will show the fix next.",
      primary: "Open Accessibility",
      secondary: "Re-check permissions",
    },
    "accessibility-permission-required": {
      title: "One more step required",
      description: "Android requires an extra permission before Last Puff can enable protection.",
      primary: "Fix Permission",
      secondary: "Re-check permissions",
    },
    usage: {
      title: "Allow Usage Access",
      description: "This lets Last Puff confirm what app is in the foreground while you use your phone.",
      primary: "Open Usage Access",
    },
    overlay: {
      title: "Allow Display Over Other Apps",
      description: "This shows the full-screen blocker whenever a protected app opens.",
      primary: "Open Overlay Settings",
    },
    "device-admin": {
      title: "Enable Uninstall Protection",
      description: "This prevents Last Puff from being removed until the unlock challenge is completed.",
      primary: "Enable Protection",
      secondary: "Open Device Admin",
    },
    done: {
      title: "Protection Active",
      description: "All required permissions are active. Last Puff can monitor and block continuously now.",
      primary: "Continue",
    },
  };

  useEffect(() => {
    if (!open) {
      setStarted(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const activeConfig =
    nextStep === "accessibility" && (accessibilityAttempted || restrictedSettingsAttempted) && effectiveRestrictedSettingsAllowed
      ? {
          ...stepConfig.accessibility,
          description: "Restricted Settings is allowed now. Tap below to go to the Accessibility page and enable Last Puff.",
          primary: "Go to Accessibility Page",
        }
      : stepConfig[nextStep];

  const handlePrimary = () => {
    if (nextStep === "intro") {
      setStarted(true);
      onRefresh();
      return;
    }
    if (nextStep === "done") {
      onComplete();
      return;
    }
    if (nextStep === "restricted") {
      onRestrictedSettingsAttempt();
      void openNativeAppInfo();
      setTimeout(() => onRefresh(), 500);
      return;
    }
    if (nextStep === "accessibility") {
      onAccessibilityAttempt();
      void openNativeAccessibilitySettings();
      setTimeout(() => onRefresh(), 500);
      return;
    }
    if (nextStep === "accessibility-permission-required") {
      onRestrictedSettingsAttempt();
      void openNativeAppInfo();
      setTimeout(() => onRefresh(), 500);
      return;
    }
    if (nextStep === "usage") {
      void openNativeUsageAccessSettings();
      return;
    }
    if (nextStep === "overlay") {
      void openNativeOverlaySettings();
      return;
    }
    if (nextStep === "device-admin") {
      // Device Admin is the Android-supported gate that blocks direct uninstall.
      void enableNativeUninstallProtection().finally(() => onRefresh());
      return;
    }
  };

  const handleSecondary = () => {
    if (nextStep === "device-admin") {
      void openNativeDeviceAdminSettings();
      return;
    }
    onRefresh();
  };

  const permissionRows = [
    ["Usage Access", Boolean(status?.usageAccessGranted)],
    ["Restricted Settings", effectiveRestrictedSettingsAllowed],
    ["Accessibility", Boolean(status?.accessibilityEnabled && status?.accessibilityActive)],
    ["Display Over Other Apps", Boolean(status?.overlayPermissionGranted)],
    ["Uninstall Protection", isUninstallProtectionReady(status)],
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/45 px-4 py-4 backdrop-blur-md"
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl items-start justify-center py-4 sm:items-center">
        <GlassCard className="max-h-[calc(100dvh-2rem)] w-full overflow-hidden border border-foreground/10">
          <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-5">
            <button
              onClick={onClose}
              aria-label="Close permission review"
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background text-muted-foreground shadow-sm transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="pr-10 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Permission Wizard</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{activeConfig.title}</div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{activeConfig.description}</p>

            {nextStep === "restricted" ? (
              <div className="mt-4 rounded-2xl border border-foreground/10 bg-card p-4 text-sm text-foreground">
                <div className="mb-3 font-semibold">Quick Steps</div>
                <ol className="space-y-2 text-xs">
                  <li>1. Tap "Open App Info" below</li>
                  <li>2. Tap the menu (⋮) at top right</li>
                  <li>3. Select "Allow Restricted Settings"</li>
                  <li>4. Return here and refresh</li>
                </ol>
              </div>
            ) : null}

            {nextStep === "accessibility-permission-required" ? (
              <div className="mt-4 rounded-2xl border border-foreground/10 bg-card p-4 text-sm text-foreground">
                <div className="mb-3 font-semibold">Quick Steps</div>
                <ol className="space-y-2 text-xs">
                  <li>1. Tap the ⋮ menu</li>
                  <li>2. Tap "Allow Restricted Settings"</li>
                  <li>3. Return to Accessibility</li>
                  <li>4. Enable Last Puff</li>
                </ol>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={handlePrimary}
                className="glass-button rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm"
              >
                {activeConfig.primary}
              </button>
              <button
                onClick={handleSecondary}
                className="rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm"
              >
                {activeConfig.secondary || "Re-check permissions"}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {permissionRows.map(([label, active]) => (
                <div key={label as string} className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-background px-4 py-3">
                  <div className="text-sm font-semibold text-foreground">{label as string}</div>
                  <div className={`text-sm font-semibold ${active ? "text-emerald-600" : "text-rose-600"}`}>{active ? "✓" : "✗"}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}

function defaultEndHour(startHour: number, startMinute: number) {
  return (startHour + Math.floor((startMinute + 600) / 60)) % 24;
}

function defaultEndMinute(startMinute: number) {
  return (startMinute + 600) % 60;
}

function defaultBlockWindow(startHour: number, startMinute: number) {
  return {
    endHour: defaultEndHour(startHour, startMinute),
    endMinute: defaultEndMinute(startMinute),
  };
}

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

export default function ControlPage() {
  useRenderCounter("ControlPage");
  const hydrated = useAppStore((state) => state.meta.hydrated);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const unlockedApps = useAppStore((state) => state.damage.unlockedApps);
  const unlockFailures = useAppStore((state) => state.damage.unlockFailures);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue);
  const [blockHour, setBlockHour] = useState(22);
  const [blockMinute, setBlockMinute] = useState(0);
  const [blockEndHour, setBlockEndHour] = useState(8);
  const [blockEndMinute, setBlockEndMinute] = useState(0);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [draftSelectedPackages, setDraftSelectedPackages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerScrollTop, setPickerScrollTop] = useState(0);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scheduleSuccessMessage, setScheduleSuccessMessage] = useState("");
  const [savedNotifications, setSavedNotifications] = useState<string[]>([]);
  const [installedApps, setInstalledApps] = useState<CatalogApp[]>([]);
  const [nativeProtectionStatus, setNativeProtectionStatus] = useState<NativeProtectionStatus | null>(null);
  const [permissionWizardOpen, setPermissionWizardOpen] = useState(false);
  const [accessibilityAttempted, setAccessibilityAttempted] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(CONTROL_ACCESSIBILITY_ATTEMPTED_KEY) === "true";
  });
  const [restrictedSettingsAttempted, setRestrictedSettingsAttempted] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(CONTROL_RESTRICTED_SETTINGS_ATTEMPTED_KEY) === "true";
  });
  const hasLoadedRef = useRef(false);
  const controlCacheUpdatedAtRef = useRef(0);
  const installedAppsLoadedRef = useRef(false);
  const lastNativeSyncRef = useRef("");
  const blockTime = formatBlockWindow(blockHour, blockMinute, blockEndHour, blockEndMinute);
  useBodyScrollLock(permissionWizardOpen || pickerOpen);
  useScreenPerformance("control", !loading && hasLoadedRef.current);

  useEffect(() => {
    if (!loading && hasLoadedRef.current) {
      sampleMemory("control-ready");
    }
  }, [loading]);

  const refreshNativeProtectionStatus = useCallback(async () => {
    if (!isNativeAndroid()) {
      return null;
    }

    try {
      const status = await getNativeProtectionStatus();
      setNativeProtectionStatus(status);
      return status;
    } catch (error) {
      if (!isNativePluginUnavailable(error)) {
        throw error;
      }
      return null;
    }
  }, []);

  const markAccessibilityAttempted = useCallback(() => {
    setAccessibilityAttempted(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONTROL_ACCESSIBILITY_ATTEMPTED_KEY, "true");
    }
  }, []);

  const markRestrictedSettingsAttempted = useCallback(() => {
    setRestrictedSettingsAttempted(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONTROL_RESTRICTED_SETTINGS_ATTEMPTED_KEY, "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(CONTROL_CACHE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        apps?: AppItem[];
        blockTime?: string;
        blockHour?: number;
        blockMinute?: number;
        blockEndHour?: number;
        blockEndMinute?: number;
        updatedAt?: number;
      };
      if (parsed.apps?.length) {
        setApps(parsed.apps);
        setLoading(false);
        hasLoadedRef.current = true;
        controlCacheUpdatedAtRef.current = parsed.updatedAt ?? 0;
      }
      if (typeof parsed.blockHour === "number" && typeof parsed.blockMinute === "number") {
        setBlockHour(parsed.blockHour);
        setBlockMinute(parsed.blockMinute);
        const tenHourWindow = defaultBlockWindow(parsed.blockHour, parsed.blockMinute);
        setBlockEndHour(tenHourWindow.endHour);
        setBlockEndMinute(tenHourWindow.endMinute);
      } else if (parsed.blockTime) {
        const parsedWindow = parseBlockWindow(parsed.blockTime);
        if (parsedWindow) {
          setBlockHour(parsedWindow.startHour);
          setBlockMinute(parsedWindow.startMinute);
          const tenHourWindow = defaultBlockWindow(parsedWindow.startHour, parsedWindow.startMinute);
          setBlockEndHour(tenHourWindow.endHour);
          setBlockEndMinute(tenHourWindow.endMinute);
        }
      }
    } catch {
      // Ignore stale cache and allow network bootstrap to refresh it.
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) {
      return;
    }

    const loadApps = async () => {
        const cacheIsFresh = hasLoadedRef.current && Date.now() - controlCacheUpdatedAtRef.current < CONTROL_CACHE_STALE_MS;
        if (cacheIsFresh) {
          void refreshNativeProtectionStatus().catch(() => {});
          return;
        }

        setLoading(!hasLoadedRef.current);
        setErrorMessage("");
        try {
          const [response, nativeStatus] = await Promise.all([
            apiRequest<{
              success: boolean;
              apps: AppItem[];
              schedule: { block_time: string } | null;
            }>("/api/apps"),
            isNativeAndroid() ? refreshNativeProtectionStatus() : Promise.resolve(null),
          ]);
          setApps(response.apps);
          if (nativeStatus) {
            setNativeProtectionStatus(nativeStatus);
          }
        if (response.schedule?.block_time) {
          const parsedWindow = parseBlockWindow(response.schedule.block_time);
          if (parsedWindow) {
            setBlockHour(parsedWindow.startHour);
            setBlockMinute(parsedWindow.startMinute);
            const tenHourWindow = defaultBlockWindow(parsedWindow.startHour, parsedWindow.startMinute);
            setBlockEndHour(tenHourWindow.endHour);
            setBlockEndMinute(tenHourWindow.endMinute);
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
  }, [hydrated, isAuthenticated]);

  const saveSchedule = async () => {
    if (!hydrated || !isAuthenticated) {
      return;
    }

    if (scheduleIsActive) {
      setErrorMessage("Schedule is currently active and cannot be modified.");
      return;
    }

    if (!selectedAppsCount || !hasValidTimeRange) {
      setErrorMessage(scheduleValidationMessages[0] || "Complete the schedule before saving.");
      return;
    }

    const tenHourWindow = defaultBlockWindow(blockHour, blockMinute);
    const nextBlockTime = `${formatTime24(blockHour, blockMinute)}-${formatTime24(tenHourWindow.endHour, tenHourWindow.endMinute)}`;
    setBlockEndHour(tenHourWindow.endHour);
    setBlockEndMinute(tenHourWindow.endMinute);
    setSavingSchedule(true);
    setErrorMessage("");
    setScheduleSuccessMessage("Saved successfully.");

    if (isNativeAndroid()) {
      try {
        const status = await syncNativeProtectionConfig({
          apps: apps.map((app) => ({
            appName: app.app_name,
            packageName: app.package_name || app.app_name,
            isActive: app.is_active,
          })),
          blockTime: nextBlockTime,
          blockHour,
          blockMinute,
          blockEndHour: tenHourWindow.endHour,
          blockEndMinute: tenHourWindow.endMinute,
          enabled: true,
          repeatType: "daily",
        });
        setNativeProtectionStatus(status);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to save native blocking schedule.");
        setSavingSchedule(false);
        return;
      }
    }

    enqueueBackgroundSync("save-block-schedule", async () => {
      await apiRequest("/api/apps/schedule", {
        method: "POST",
        body: JSON.stringify({
          blockTime: nextBlockTime,
          frequency: "daily",
          enabled: true,
        }),
      });
      setSavingSchedule(false);
    });
  };

  useEffect(() => {
    if (!scheduleSuccessMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setScheduleSuccessMessage(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [scheduleSuccessMessage]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !isNativeAndroid() || !hasLoadedRef.current) {
      return;
    }

    const tenHourWindow = defaultBlockWindow(blockHour, blockMinute);
    const tenHourBlockTime = `${formatTime24(blockHour, blockMinute)}-${formatTime24(tenHourWindow.endHour, tenHourWindow.endMinute)}`;

    const syncKey = JSON.stringify({
      apps: apps.map((app) => ({
        appName: app.app_name,
        packageName: app.package_name || app.app_name,
        isActive: app.is_active,
      })),
      blockTime: tenHourBlockTime,
      blockHour,
      blockMinute,
      blockEndHour: tenHourWindow.endHour,
      blockEndMinute: tenHourWindow.endMinute,
    });
    if (lastNativeSyncRef.current === syncKey) {
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
          blockTime: tenHourBlockTime,
          blockHour,
          blockMinute,
          blockEndHour: tenHourWindow.endHour,
          blockEndMinute: tenHourWindow.endMinute,
          enabled: true,
          repeatType: "daily",
        });

        setNativeProtectionStatus(status);
        lastNativeSyncRef.current = syncKey;
      } catch (error) {
        if (!isNativePluginUnavailable(error)) {
          throw error;
        }
      }
    };

    void sync().catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sync native protection settings.");
    });
  }, [apps, blockEndHour, blockEndMinute, blockHour, blockMinute, blockTime, hydrated, isAuthenticated]);

  const selectedAppsCount = apps.filter((item) => item.is_active).length;
  const scheduleIsActive = Boolean(nativeProtectionStatus?.withinBlockedWindow && selectedAppsCount > 0);
  const hasValidTimeRange = isTimeRangeValid(blockHour, blockMinute, blockEndHour, blockEndMinute);
  const scheduleValidationMessages = [
    selectedAppsCount ? "" : "Select at least one app.",
    hasValidTimeRange ? "" : "End time must be different from start time.",
  ].filter(Boolean);
  const canSaveSchedule = !scheduleIsActive && selectedAppsCount > 0 && hasValidTimeRange && !savingSchedule;

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

  const appsToRender = useMemo(
    () =>
      apps.map((item) => {
        const catalogFallback = appCatalog.find(
          (entry) =>
            entry.packageName === item.package_name ||
            entry.appName.toLowerCase() === item.app_name.toLowerCase(),
        );

        return {
          ...item,
          app: item.app_name,
          icon:
            iconMap[item.app_icon as keyof typeof iconMap] ||
            iconMap[(catalogFallback?.appIcon || "ShieldAlert") as keyof typeof iconMap],
          why: item.warning_message || catalogFallback?.warningMessage || "Protected by Last Puff.",
          isProtected: item.is_active,
        };
      }),
    [apps],
  );

  const blockedApps = useMemo(() => appsToRender.filter((item) => item.isProtected), [appsToRender]);
  const pickerRowHeight = 72;
  const pickerViewportHeight = Math.round((typeof window !== "undefined" ? window.innerHeight : 720) * 0.52);
  const virtualPicker = useMemo(() => {
    const overscan = 6;
    const start = Math.max(0, Math.floor(pickerScrollTop / pickerRowHeight) - overscan);
    const visible = Math.ceil(pickerViewportHeight / pickerRowHeight) + overscan * 2;
    const end = Math.min(pickerApps.length, start + visible);
    return {
      items: pickerApps.slice(start, end).map((item, index) => ({ item, virtualIndex: start + index })),
      top: start * pickerRowHeight,
      total: pickerApps.length * pickerRowHeight,
    };
  }, [pickerApps, pickerScrollTop, pickerViewportHeight]);

  useEffect(() => {
    if (typeof window === "undefined" || !apps.length) {
      return;
    }

    window.localStorage.setItem(
      CONTROL_CACHE_KEY,
      JSON.stringify({
        apps,
        blockTime,
        blockHour,
        blockMinute,
        blockEndHour,
        blockEndMinute,
        updatedAt: Date.now(),
      }),
    );
    controlCacheUpdatedAtRef.current = Date.now();
  }, [apps, blockEndHour, blockEndMinute, blockHour, blockMinute, blockTime]);

  const completePermissionWizard = () => {
    setPermissionWizardOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONTROL_PERMISSION_WIZARD_KEY, "true");
    }
  };

  useEffect(() => {
    if (!isNativeAndroid()) {
      return;
    }

    let burstTimer: number | null = null;
    let intervalTimer: number | null = null;

    const stopBurst = () => {
      if (intervalTimer !== null) {
        window.clearInterval(intervalTimer);
        intervalTimer = null;
      }
      if (burstTimer !== null) {
        window.clearTimeout(burstTimer);
        burstTimer = null;
      }
    };

    const refreshBurst = () => {
      stopBurst();
      void refreshNativeProtectionStatus();
      intervalTimer = window.setInterval(() => {
        void refreshNativeProtectionStatus();
      }, 1200);
      burstTimer = window.setTimeout(() => {
        stopBurst();
      }, 3600);
    };

    const handleFocus = () => refreshBurst();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshBurst();
      }
    };

    refreshBurst();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopBurst();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshNativeProtectionStatus]);

  useEffect(() => {
    if (!isNativeAndroid() || !permissionWizardOpen) {
      return;
    }

    const refresh = () => {
      void refreshNativeProtectionStatus();
    };

    const interval = window.setInterval(refresh, 1200);
    const handleFocus = () => refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [permissionWizardOpen]);

  const openPicker = () => {
    if (scheduleIsActive) {
      setErrorMessage("Schedule is currently active and cannot be modified.");
      return;
    }

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
    if (scheduleIsActive) {
      setErrorMessage("Schedule is currently active and cannot be modified.");
      setPickerOpen(false);
      return;
    }

    const sourceApps = isNativeAndroid() ? installedApps : installedApps.length ? installedApps : appCatalog;
    const selectedApps = sourceApps.filter((item) =>
      draftSelectedPackages.includes(item.packageName || item.appName),
    );

    if (!selectedApps.length) {
      setPickerOpen(false);
      return;
    }

    const optimisticApps = [
      ...apps.map((app) =>
        selectedApps.some((selected) => (selected.packageName || selected.appName) === (app.package_name || app.app_name))
          ? { ...app, is_active: true }
          : app,
      ),
      ...selectedApps
        .filter((selected) => !apps.some((app) => (selected.packageName || selected.appName) === (app.package_name || app.app_name)))
        .map((selected, index): AppItem => ({
          id: -Date.now() - index,
          app_name: selected.appName,
          package_name: selected.packageName,
          app_icon: selected.appIcon as keyof typeof iconMap,
          warning_message: selected.warningMessage,
          is_active: true,
        })),
    ];

    setSavingSelection(false);
    setErrorMessage("");
    setApps(optimisticApps);
    setSavedNotifications((current) => [
      `Saved ${selectedApps.length} app${selectedApps.length === 1 ? "" : "s"} to protection.`,
      ...current,
    ].slice(0, 3));
    setPickerOpen(false);

    enqueueBackgroundSync("save-selected-apps", async () => {
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
    });
  };

  const toggleSelectedApp = async (app: AppItem) => {
    if (scheduleIsActive) {
      setErrorMessage("Schedule is currently active and cannot be modified.");
      return;
    }

    const nextIsActive = !app.is_active;
    setApps((current) => current.map((item) => (item.id === app.id ? { ...item, is_active: nextIsActive } : item)));

    enqueueBackgroundSync(`toggle-app-${app.id}`, async () => {
      await apiRequest("/api/apps/toggle", {
        method: "PUT",
        body: JSON.stringify({ id: app.id, isActive: nextIsActive }),
      });
    });
  };

  return (
    <AppShell>
      <PermissionWizard
        open={permissionWizardOpen}
        status={nativeProtectionStatus}
        onRefresh={() => void refreshNativeProtectionStatus()}
        onComplete={completePermissionWizard}
        onClose={() => setPermissionWizardOpen(false)}
        accessibilityAttempted={accessibilityAttempted}
        onAccessibilityAttempt={markAccessibilityAttempted}
        restrictedSettingsAttempted={restrictedSettingsAttempted}
        onRestrictedSettingsAttempt={markRestrictedSettingsAttempted}
      />
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Protection</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">App Controls</h1>
      </div>

      <GlassCard glow="red" className="relative mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-foreground/10 bg-card shadow-sm">
              <ShieldAlert className="h-6 w-6 text-rose-600" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Status</div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {unlockedApps
                  ? "Protection Disabled"
                  : isProtectionReady(nativeProtectionStatus)
                    ? "Protection Ready"
                    : selectedAppsCount
                      ? "Permissions Missing"
                      : "Protection Idle"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {unlockedApps
                  ? "Apps are accessible. Proceed with caution."
                  : isProtectionReady(nativeProtectionStatus)
                    ? `${selectedAppsCount} apps are protected and the blocker is active.`
                    : "Finish the guided permissions flow to activate blocking."}
              </div>
            </div>
          </div>

          {isNativeAndroid() ? (
            <button
              onClick={() => setPermissionWizardOpen(true)}
              className="rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-xs font-semibold text-foreground shadow-sm"
            >
              Review
            </button>
          ) : null}
        </div>
      </GlassCard>

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
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid flex-1 grid-cols-2 gap-3">
                <select
                  value={blockHour}
                  onChange={(event) => {
                    const nextHour = Number(event.target.value);
                    setBlockHour(nextHour);
                    setBlockEndHour(defaultEndHour(nextHour, blockMinute));
                    setBlockEndMinute(defaultEndMinute(blockMinute));
                  }}
                  className="h-12 w-full rounded-2xl border border-foreground/10 bg-background px-4 text-sm font-semibold text-foreground shadow-sm outline-none"
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <select
                  value={blockMinute}
                  onChange={(event) => {
                    const nextMinute = Number(event.target.value);
                    setBlockMinute(nextMinute);
                    setBlockEndHour(defaultEndHour(blockHour, nextMinute));
                    setBlockEndMinute(defaultEndMinute(nextMinute));
                  }}
                  className="h-12 w-full rounded-2xl border border-foreground/10 bg-background px-4 text-sm font-semibold text-foreground shadow-sm outline-none"
                >
                  {Array.from({ length: 60 }, (_, minute) => (
                    <option key={minute} value={minute}>
                      {String(minute).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
              onClick={() => void saveSchedule()}
              disabled={savingSchedule}
                className="glass-button h-12 rounded-2xl px-5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-70"
            >
                {savingSchedule ? "Saving..." : "Save"}
              </motion.button>
            </div>
            <div className={`mt-2 text-[11px] font-medium ${scheduleSuccessMessage ? "text-emerald-600" : "text-muted-foreground"}`}>
              {scheduleSuccessMessage || (savingSchedule ? "Saving schedule..." : "Schedule saves when you tap Save.")}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Choose Apps</div>
              <LayoutGrid className="h-4 w-4 text-sky-600" />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={openPicker}
              className="glass-button flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all"
            >
              <Plus className="h-4 w-4" />
              Choose Apps
            </motion.button>

            <div className="mt-3 text-[11px] text-muted-foreground">
              {isNativeAndroid()
                ? "This reads the installed app list from your phone and saves the selected apps to protection."
                : "On web preview this falls back to the demo app catalog."}
            </div>

            <div className="mt-4 rounded-2xl border border-foreground/10 bg-background px-4 py-3 shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Saved Notifications</div>
              <div className="mt-2 space-y-1">
                {savedNotifications.length ? (
                  savedNotifications.map((notice, index) => (
                    <div key={`${notice}-${index}`} className="text-sm font-medium text-foreground">
                      {notice}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {selectedAppsCount
                      ? `${selectedAppsCount} apps selected. Save once to pin a notification here.`
                      : "Select apps to protect from the picker above. Saved updates will appear here."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Blocked Applications</div>
      </div>
      {errorMessage ? <div className="mb-4 text-sm text-red-500">{errorMessage}</div> : null}
      <div className="space-y-2.5">
        {blockedApps.map((item, index) => (
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
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{item.app}</div>
                  <div className="text-[11px] text-muted-foreground">{item.why}</div>
                </div>
                <button
                  onClick={() => {
                    setChallengeOpen(true);
                  }}
                  className="glass-button rounded-2xl px-3 py-1.5 text-[11px] font-medium transition-all"
                >
                  Unlock
                </button>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

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

                  <div
                    className="max-h-[52vh] overflow-y-auto pr-1"
                    onScroll={(event) => setPickerScrollTop(event.currentTarget.scrollTop)}
                  >
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
                      : (
                        <div style={{ height: virtualPicker.total, position: "relative" }}>
                          <div className="space-y-2" style={{ transform: `translateY(${virtualPicker.top}px)` }}>
                            {virtualPicker.items.map(({ item, virtualIndex }) => {
                          const Icon = iconMap[item.appIcon] || ShieldAlert;
                          const key = item.packageName || item.appName;
                          const selected = draftSelectedPackages.includes(key);

                          return (
                            <motion.button
                              key={key}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(virtualIndex, 8) * 0.01 }}
                              onClick={() => toggleDraftSelection(item)}
                              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                                selected
                                  ? "glass-button-active text-foreground"
                                  : "border-foreground/10 bg-white text-foreground"
                              }`}
                            >
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? "bg-white/80" : "bg-foreground/5"}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold">{item.appName}</div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {item.packageName}
                                </div>
                              </div>
                              <div className={`h-5 w-5 rounded-full border ${selected ? "border-black bg-black shadow-inner" : "border-foreground/20 bg-white"}`} />
                            </motion.button>
                          );
                            })}
                          </div>
                        </div>
                      )}

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
                      className="glass-button rounded-full px-4 py-3 text-xs font-semibold transition-all disabled:opacity-70"
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
