import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Radar, ScanSearch, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { ChatModal } from "@/components/lp/social/ChatModal";
import { NearbyUserCard } from "@/components/lp/social/NearbyUserCard";
import { RadarScannerModal } from "@/components/lp/social/RadarScannerModal";
import { fakeReplies } from "@/components/lp/social-data";
import { API_BASE_URL, apiRequest } from "@/lib/api";
import { appStore, type NearbySmoker, useAppStore } from "@/lib/app-store";
import { ensureNativeLocationPermission, isNativeAndroid } from "@/lib/native/mobile";

export const Route = createFileRoute("/social")({
  head: () => ({ meta: [{ title: "Smoker Radar - Last Puff" }] }),
  component: Social,
});

function Social() {
  const authUser = useAppStore((state) => state.auth.user);
  const token = useAppStore((state) => state.auth.token);
  const { radarUsers, conversations, lastScannedAt } = useAppStore((state) => state.social);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [activeUser, setActiveUser] = useState<NearbySmoker | null>(null);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [visibleOnRadar, setVisibleOnRadar] = useState(Boolean(authUser?.visibilityEnabled));
  const [errorMessage, setErrorMessage] = useState("");
  const watchIdRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<number | null>(null);
  const lastSentLocationRef = useRef<{ latitude: number; longitude: number; at: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const loadingNearbyRef = useRef(false);

  useEffect(() => {
    setVisibleOnRadar(Boolean(authUser?.visibilityEnabled));
  }, [authUser?.visibilityEnabled]);

  useEffect(() => {
    if (!visibleOnRadar) {
      stopLocationTracking();
      return undefined;
    }

    void startLocationTracking().catch((error: unknown) => {
      setVisibleOnRadar(false);
      appStore.updateUser({ visibilityEnabled: false });
      setErrorMessage(error instanceof Error ? error.message : "Unable to start live location tracking.");
    });

    return () => {
      stopLocationTracking();
    };
  }, [visibleOnRadar]);

  useEffect(() => {
    void loadNearbyUsers();
  }, []);

  const loadNearbyUsers = async () => {
    if (loadingNearbyRef.current) {
      return;
    }

    try {
      loadingNearbyRef.current = true;
      const response = await apiRequest<{ success: boolean; users: NearbySmoker[] }>("/api/social/nearby");
      appStore.setRadarUsers(response.users);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load nearby users.");
    } finally {
      loadingNearbyRef.current = false;
    }
  };

  const pushLocation = async (latitude: number, longitude: number, force = false) => {
    const now = Date.now();
    const previous = lastSentLocationRef.current;
    const shouldSkip =
      !force &&
      previous &&
      now - previous.at < 15000 &&
      Math.abs(previous.latitude - latitude) < 0.0005 &&
      Math.abs(previous.longitude - longitude) < 0.0005;

    if (shouldSkip) {
      return;
    }

    await apiRequest("/api/social/location", {
      method: "POST",
      body: JSON.stringify({
        latitude,
        longitude,
        is_visible: true,
      }),
    });

    lastSentLocationRef.current = { latitude, longitude, at: now };
  };

  const stopLocationTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (locationIntervalRef.current !== null) {
      window.clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const startLocationTracking = async () => {
    if (!("geolocation" in navigator)) {
      throw new Error("Geolocation is not available on this device.");
    }

    if (isNativeAndroid()) {
      await ensureNativeLocationPermission();
    }

    stopLocationTracking();

    const startWatch = () =>
      new Promise<void>((resolve, reject) => {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            void pushLocation(position.coords.latitude, position.coords.longitude);
            resolve();
          },
          (error) => {
            reject(new Error(error.message || "Location permission is required."));
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 15000,
          },
        );
      });

    const primePosition = () =>
      new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await pushLocation(position.coords.latitude, position.coords.longitude, true);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          (error) => reject(new Error(error.message || "Location permission is required.")),
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 10000,
          },
        );
      });

    await primePosition();
    await startWatch();

    locationIntervalRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void pushLocation(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // ignore brief location refresh errors
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 15000,
        },
      );
    }, 30000);
  };

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("social:subscribe");
    });

    const refreshNearby = () => {
      void loadNearbyUsers();
    };

    socket.on("user-online", refreshNearby);
    socket.on("user-offline", refreshNearby);
    socket.on("user-location-update", refreshNearby);
    socket.on("streak-updated", refreshNearby);
    socket.on("level-updated", refreshNearby);

    return () => {
      socket.emit("social:unsubscribe");
      socket.off("user-online", refreshNearby);
      socket.off("user-offline", refreshNearby);
      socket.off("user-location-update", refreshNearby);
      socket.off("streak-updated", refreshNearby);
      socket.off("level-updated", refreshNearby);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadNearbyUsers();
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    stopLocationTracking();
  }, []);

  const activeConversation = useMemo(
    () => (activeUser ? conversations[activeUser.id] ?? [] : []),
    [activeUser, conversations],
  );

  useEffect(() => {
    if (!activeUser) {
      return;
    }

    const conversation = conversations[activeUser.id] ?? [];
    const lastMessage = conversation[conversation.length - 1];

    if (!lastMessage || lastMessage.sender !== "me") {
      return;
    }

    setTypingUserId(activeUser.id);

    const timeout = window.setTimeout(() => {
      const reply = fakeReplies[Math.floor(Math.random() * fakeReplies.length)] ?? "last cigarette fr";
      appStore.addMessage(activeUser.id, "them", reply);
      setTypingUserId((current) => (current === activeUser.id ? null : current));
    }, 1200 + Math.random() * 900);

    return () => window.clearTimeout(timeout);
  }, [activeUser, conversations]);

  const startScan = () => {
    setScannerOpen(true);
    setScanning(true);

    window.setTimeout(async () => {
      try {
        if (visibleOnRadar) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                try {
                  await pushLocation(position.coords.latitude, position.coords.longitude, true);
                } finally {
                  resolve();
                }
              },
              () => resolve(),
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 },
            );
          });
        }
        const response = await apiRequest<{ success: boolean; users: NearbySmoker[] }>("/api/social/radar-scan", {
          method: "POST",
          body: JSON.stringify({}),
        });
        appStore.setRadarUsers(response.users);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to complete radar scan.");
      } finally {
        setScanning(false);
        window.setTimeout(() => setScannerOpen(false), 450);
      }
    }, 5000);
  };

  const openChat = (user: NearbySmoker) => {
    setActiveUser(user);

    const existing = appStore.getState().social.conversations[user.id];
    if (!existing?.length) {
      appStore.addMessage(user.id, "them", "bro got lighter?");
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Community</div>
        <h1 className="text-2xl font-semibold text-foreground mt-2">Nearby Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect with nearby community members.</p>
      </div>

      <GlassCard glow={visibleOnRadar ? "green" : "red"} className="mb-6 border border-foreground/10">
        <div className="flex items-center gap-3">
          <motion.div
            animate={visibleOnRadar ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border border-foreground/10 shadow-sm ${
              visibleOnRadar
                ? "bg-emerald-50 text-emerald-500"
                : "bg-red-50 text-red-500"
            }`}
          >
            {visibleOnRadar ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            {visibleOnRadar && <div className="absolute inset-0 rounded-2xl border border-emerald-400/30 animate-neon-pulse" />}
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Visibility</div>
            <div className="mt-1 text-base font-semibold text-foreground">{visibleOnRadar ? "You're visible" : "Hidden from radar"}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isNativeAndroid()
                ? "When visible, Android location permission must be allowed so nearby users can find you."
                : "When visible, nearby users can find you."}
            </p>
          </div>
          <button
            onClick={async () => {
              const next = !visibleOnRadar;
              setVisibleOnRadar(next);
              appStore.updateUser({ visibilityEnabled: next });
              setErrorMessage("");

              try {
                if (next) {
                  await apiRequest("/api/social/visibility", {
                    method: "POST",
                    body: JSON.stringify({ enabled: true }),
                  });
                  await loadNearbyUsers();
                } else {
                  stopLocationTracking();
                  await apiRequest("/api/social/visibility", {
                    method: "POST",
                    body: JSON.stringify({ enabled: false }),
                  });
                  appStore.clearRadarUsers();
                }
              } catch (error: unknown) {
                stopLocationTracking();
                setVisibleOnRadar(!next);
                appStore.updateUser({ visibilityEnabled: !next });
                setErrorMessage(error instanceof Error ? error.message : "Unable to update visibility.");
              }
            }}
            role="switch"
            aria-checked={visibleOnRadar}
            className={`relative h-11 w-20 rounded-full border p-1 transition-colors ${
              visibleOnRadar
                ? "border-emerald-300 bg-emerald-50"
                : "border-rose-300 bg-rose-50"
            }`}
          >
            <span
              className={`block h-8 w-8 rounded-full border border-foreground/10 bg-card shadow-sm transition-transform duration-200 ease-out ${
                visibleOnRadar ? "translate-x-9" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </GlassCard>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={startScan}
        className="relative mb-6 w-full overflow-hidden rounded-[2rem] border border-foreground/10 bg-card px-5 py-6 text-left shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
      >
        <motion.div
          animate={{ x: ["-120%", "130%"] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
          className="absolute inset-y-0 w-32 rotate-12 bg-[linear-gradient(90deg,transparent,rgba(var(--primary)/0.1),transparent)] blur-xl"
        />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5">
            <ScanSearch className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Radar Scan</div>
            <div className="mt-1 text-lg font-semibold text-foreground">Find nearby users</div>
            <p className="mt-0.5 text-xs text-muted-foreground">Scan for users in your area.</p>
          </div>
          <Radar className="h-5 w-5 text-primary animate-float" />
        </div>
      </motion.button>
      {errorMessage ? <div className="mb-4 text-sm text-red-500">{errorMessage}</div> : null}
      {isNativeAndroid() && !visibleOnRadar ? (
        <div className="mb-4 rounded-2xl border border-foreground/10 bg-card px-4 py-3 text-xs text-muted-foreground">
          If Android says location is denied, turn on radar again and accept the permission prompt.
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {radarUsers.length > 0 ? (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Nearby</div>
                <div className="text-lg font-semibold text-foreground">Found {radarUsers.length} users</div>
              </div>
              <div className="text-right text-[10px] font-medium uppercase tracking-[0.15em] text-primary">
                {lastScannedAt ? "Just now" : "Idle"}
              </div>
            </div>
            <div className="space-y-3">
              {radarUsers.map((user, index) => (
                <NearbyUserCard key={user.id} user={user} index={index} onMessage={openChat} />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="border border-dashed border-foreground/10 text-center">
              <Zap className="mx-auto h-8 w-8 text-primary/60" />
              <div className="mt-3 text-base font-semibold text-foreground">No results yet</div>
              <p className="mt-1 text-sm text-muted-foreground">Run a radar scan to find nearby users.</p>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <RadarScannerModal open={scannerOpen} scanning={scanning} onClose={() => !scanning && setScannerOpen(false)} />
      <ChatModal
        open={!!activeUser}
        user={activeUser}
        messages={activeConversation}
        typing={typingUserId === activeUser?.id}
        onClose={() => {
          setActiveUser(null);
          setTypingUserId(null);
        }}
      />
    </AppShell>
  );
}
