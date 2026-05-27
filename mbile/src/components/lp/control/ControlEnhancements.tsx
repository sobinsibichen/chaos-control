import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, HeartPulse, ShieldAlert, Sparkles, TimerReset, Waves } from "lucide-react";
import toast from "react-hot-toast";
import { AnimatedNumber } from "@/components/lp/AnimatedNumber";
import { GlassCard } from "@/components/lp/GlassCard";
import { buildScannerInsight } from "@/lib/intelligence";
import { useIntelligenceStore } from "@/lib/intelligence-store";
import { useAppStore } from "@/lib/app-store";

const tabs = ["Scanner", "Ritual Mode", "Emergency Mode"] as const;
type ControlTab = (typeof tabs)[number];

export function ControlEnhancements() {
  const [activeTab, setActiveTab] = useState<ControlTab>("Scanner");
  const saveScan = useIntelligenceStore((state) => state.saveScan);
  const scanHistory = useIntelligenceStore((state) => state.scanHistory);
  const cigarettePrice = useAppStore((state) => state.auth.user?.cigarettePrice ?? state.settings.cigarettePrice);

  return (
    <div className="mb-6">
      <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Control Modes</div>
      <GlassCard className="mb-4 border border-foreground/10">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  active ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="control-tab"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                ) : null}
                <span className="relative z-10">{tab}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {activeTab === "Scanner" ? <ScannerPanel cigarettePrice={cigarettePrice} scanHistory={scanHistory} onSaveScan={saveScan} /> : null}
      {activeTab === "Ritual Mode" ? <RitualModePanel /> : null}
      {activeTab === "Emergency Mode" ? <EmergencyModePanel /> : null}
    </div>
  );
}

function ScannerPanel({
  cigarettePrice,
  scanHistory,
  onSaveScan,
}: {
  cigarettePrice: number;
  scanHistory: ReturnType<typeof useIntelligenceStore.getState>["scanHistory"];
  onSaveScan: ReturnType<typeof useIntelligenceStore.getState>["saveScan"];
}) {
  const scannerRegionId = "last-puff-scanner-region";
  const scannerRef = useRef<unknown>(null);
  const [scanning, setScanning] = useState(false);
  const latest = scanHistory[0] ?? null;

  useEffect(() => {
    return () => {
      const current = scannerRef.current as { stop?: () => Promise<void>; clear?: () => Promise<void> } | null;
      if (current?.stop) {
        void current.stop().catch(() => {});
      }
      if (current?.clear) {
        void current.clear().catch(() => {});
      }
    };
  }, []);

  const startScan = async () => {
    if (scanning) {
      return;
    }

    try {
      setScanning(true);
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerRegionId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText, decodedResult) => {
          const summary = buildScannerInsight(decodedText, cigarettePrice);
          onSaveScan({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            scannedAt: new Date().toISOString(),
            ...summary,
          });
          toast.success("Pack scanned");
          await scanner.stop().catch(() => {});
          await scanner.clear().catch(() => {});
          scannerRef.current = null;
          setScanning(false);
        },
        () => {},
      );
    } catch (error) {
      setScanning(false);
      toast.error(error instanceof Error ? error.message : "Unable to start the scanner.");
    }
  };

  const stopScan = async () => {
    const current = scannerRef.current as { stop?: () => Promise<void>; clear?: () => Promise<void> } | null;
    if (!current) {
      return;
    }

    await current.stop?.().catch(() => {});
    await current.clear?.().catch(() => {});
    scannerRef.current = null;
    setScanning(false);
  };

  return (
    <div className="space-y-4">
      <GlassCard glow="orange" className="border border-foreground/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Scanner</div>
            <div className="mt-2 text-xl font-semibold text-foreground">Pack intelligence</div>
            <p className="mt-2 text-sm text-muted-foreground">Scan a barcode or QR code to analyze brand signals, damage profile, and estimated pack economics.</p>
          </div>
          <Camera className="h-6 w-6 text-amber-600 animate-float" />
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => void startScan()} className="rounded-full bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground">
            Start Scan
          </button>
          <button onClick={() => void stopScan()} className="rounded-full border border-foreground/10 bg-background px-4 py-3 text-xs font-semibold text-foreground">
            Stop
          </button>
        </div>
      </GlassCard>

      <GlassCard className="border border-foreground/10">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-foreground/10 bg-black/95">
          <div id={scannerRegionId} className="min-h-[18rem]" />
          {!scanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10">
                <Camera className="h-6 w-6" />
              </div>
              <div className="text-sm font-medium">Camera scanner ready</div>
            </div>
          ) : (
            <motion.div
              animate={{ y: ["0%", "100%", "0%"] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
              className="pointer-events-none absolute inset-x-4 top-4 h-1 rounded-full bg-emerald-400 shadow-[0_0_24px_rgba(74,222,128,0.8)]"
            />
          )}
        </div>
      </GlassCard>

      {latest ? (
        <GlassCard className="border border-foreground/10">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Latest analysis</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{latest.brand ?? "Unknown brand"}</div>
            </div>
            <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">Damage {latest.damageScore}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Nicotine" value={latest.nicotineMg ?? 0} suffix="mg" />
            <MetricCard label="Tar" value={latest.tarMg ?? 0} suffix="mg" />
            <MetricCard label="Pack Price" value={latest.priceEstimate ?? 0} prefix="Rs" />
            <MetricCard label="Scans Logged" value={scanHistory.length} />
          </div>
          <div className="mt-4 rounded-2xl border border-foreground/10 bg-background px-4 py-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Harmful chemicals</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {latest.chemicals.map((chemical) => (
                <span key={chemical} className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground">{chemical}</span>
              ))}
            </div>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, prefix = "", suffix = "" }: { label: string; value: number; prefix?: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold text-foreground"><AnimatedNumber value={value} prefix={prefix} suffix={suffix} /></div>
    </div>
  );
}

function RitualModePanel() {
  const [running, setRunning] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [seconds, setSeconds] = useState(0);
  const [mood, setMood] = useState("steady");
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  useEffect(() => {
    if (!running) {
      return;
    }

    const interval = window.setInterval(() => {
      setSeconds((current) => current + 1);
      setBreathPhase((current) => (current === "inhale" ? "hold" : current === "hold" ? "exhale" : "inhale"));
    }, 4000);

    return () => window.clearInterval(interval);
  }, [running]);

  const toggleAmbient = async () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      toast.success("Ambient sound stopped");
      return;
    }

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 136.1;
    gain.gain.value = 0.01;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    audioContextRef.current = context;
    oscillatorRef.current = oscillator;
    toast.success("Ambient sound playing");
  };

  return (
    <div className="space-y-4">
      <GlassCard glow="cyan" className="relative overflow-hidden border border-foreground/10">
        <motion.div
          animate={{ scale: running ? [1, 1.08, 1] : 1, opacity: running ? [0.4, 0.75, 0.4] : 0.3 }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-8 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.4),transparent_65%)]"
        />
        <div className="relative text-center">
          <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Ritual Mode</div>
          <div className="mt-2 text-xl font-semibold text-foreground">Slow the ritual down</div>
          <div className="mt-6 flex justify-center">
            <motion.div
              animate={{ scale: breathPhase === "inhale" ? 1.18 : breathPhase === "hold" ? 1.18 : 0.92 }}
              transition={{ duration: 3.6, ease: "easeInOut" }}
              className="flex h-36 w-36 items-center justify-center rounded-full border border-white/50 bg-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur"
            >
              <div>
                <div className="text-sm font-semibold text-foreground capitalize">{breathPhase}</div>
                <div className="mt-1 text-xs text-muted-foreground">{seconds}s session</div>
              </div>
            </motion.div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={() => setRunning((current) => !current)} className="rounded-2xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground">
              {running ? "Pause Session" : "Start Session"}
            </button>
            <button onClick={() => void toggleAmbient()} className="rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-xs font-semibold text-foreground">
              Ambient Sound
            </button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border border-foreground/10">
        <div className="mb-3 flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-pink-600" />
          <div className="text-sm font-semibold text-foreground">Mood logging</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["steady", "stressed", "restless"].map((option) => (
            <button
              key={option}
              onClick={() => setMood(option)}
              className={`rounded-2xl px-3 py-3 text-xs font-semibold transition-colors ${
                mood === option ? "bg-primary text-primary-foreground" : "bg-background text-foreground border border-foreground/10"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-foreground/10 bg-background px-4 py-4 text-sm text-muted-foreground">
          Ritual Mode is tuned for a <span className="font-semibold capitalize text-foreground">{mood}</span> mood and keeps your breathing cadence gentle instead of impulsive.
        </div>
      </GlassCard>
    </div>
  );
}

function EmergencyModePanel() {
  const [active, setActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const motivations = useMemo(
    () => [
      "Delay the cigarette. Do not reward the urge on its first demand.",
      "Your craving is urgent, not permanent.",
      "Three minutes of discipline is cheaper than another relapse spiral.",
    ],
    [],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    navigator.vibrate?.([120, 80, 120]);
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setActive(false);
          toast.success("Delay challenge completed");
          return 180;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [active]);

  const breathingStep = secondsLeft % 12 < 4 ? "Inhale" : secondsLeft % 12 < 8 ? "Hold" : "Exhale";
  const progress = ((180 - secondsLeft) / 180) * 100;

  return (
    <div className="space-y-4">
      <GlassCard glow="red" className="border border-foreground/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Emergency Mode</div>
            <div className="mt-2 text-xl font-semibold text-foreground">I’m about to smoke</div>
            <p className="mt-2 text-sm text-muted-foreground">Start a three-minute interruption loop with breathing, vibration, and a forced delay challenge.</p>
          </div>
          <ShieldAlert className="h-6 w-6 text-red-600 animate-danger-pulse" />
        </div>
        <button onClick={() => { setSecondsLeft(180); setActive(true); }} className="mt-4 w-full rounded-2xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground shadow-[0_16px_34px_rgba(15,23,42,0.16)]">
          Activate Emergency Mode
        </button>
      </GlassCard>

      <GlassCard className="border border-foreground/10">
        <div className="mb-4 flex items-center gap-2">
          <TimerReset className="h-5 w-5 text-sky-600" />
          <div className="text-sm font-semibold text-foreground">Delay challenge</div>
        </div>
        <div className="rounded-[1.75rem] border border-foreground/10 bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Countdown</div>
              <div className="mt-1 text-3xl font-semibold text-foreground">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</div>
            </div>
            <div className="rounded-full bg-foreground/5 px-4 py-2 text-xs font-semibold text-foreground">{breathingStep}</div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
            <motion.div animate={{ width: `${progress}%` }} className="h-full bg-primary" />
          </div>
          <div className="mt-4 grid gap-2">
            {motivations.map((line, index) => (
              <motion.div
                key={line}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: active ? 1 : 0.65, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="rounded-2xl border border-foreground/10 bg-card px-4 py-3 text-sm text-foreground"
              >
                {line}
              </motion.div>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border border-foreground/10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground/5">
            <Waves className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Calming loop</div>
            <div className="mt-1 text-sm font-semibold text-foreground">Breathe in 4, hold 4, exhale 4</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background px-4 py-4 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Emergency mode will vibrate at activation and hold the timer until the urge window softens.
        </div>
      </GlassCard>
    </div>
  );
}
