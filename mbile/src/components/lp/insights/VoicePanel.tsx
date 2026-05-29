import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { GlassCard } from "@/components/lp/GlassCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getNativeVoiceAssistantStatus, isNativeVoiceAssistantAvailable, setNativeAssistantName, syncNativeVoiceAssistantCache } from "@/lib/native/voice-assistant";
import type { InsightsSharedData, InsightsTab } from "./InsightsState";

const assistantNames = ["Nova", "Aura", "Echo", "Luna", "Pulse", "Ember", "Vexa", "Zeno", "Astro", "Neura"];

const commandGroups = [
  {
    title: "Smoking Stats",
    accent: "from-cyan-500/20 to-sky-500/10",
    commands: [
      "Hey Google, ask Nova how many cigarettes I smoked today",
      "Hey Google, ask Nova how many cigarettes I smoked this week",
      "Hey Google, ask Nova how many cigarettes are left today",
      "Hey Google, ask Nova when was my last cigarette",
      "Hey Google, ask Nova how long since my last cigarette",
    ],
  },
  {
    title: "Money Tracking",
    accent: "from-emerald-500/20 to-lime-500/10",
    commands: [
      "Hey Google, ask Nova how much money I saved today",
      "Hey Google, ask Nova how much money I wasted today",
      "Hey Google, ask Nova how much money I saved this week",
      "Hey Google, ask Nova total money saved",
    ],
  },
  {
    title: "Insights",
    accent: "from-fuchsia-500/20 to-pink-500/10",
    commands: [
      "Hey Google, ask Nova show today insights",
      "Hey Google, ask Nova show my streak",
      "Hey Google, ask Nova what is my progress",
      "Hey Google, ask Nova how am I doing today",
    ],
  },
  {
    title: "Motivation",
    accent: "from-amber-500/20 to-orange-500/10",
    commands: [
      "Hey Google, ask Nova motivate me",
      "Hey Google, ask Nova give me a reason not to smoke",
      "Hey Google, ask Nova encourage me",
    ],
  },
] as const;

type VoiceStatus = {
  assistantName: string;
  cacheReady: boolean;
  appActionsReady: boolean;
  googleAssistantReady: boolean;
  voiceCommandsEnabled: boolean;
  cacheUpdatedAt: number;
};

const storageKey = "last-puff-voice-assistant-name";

function formatSyncedAt(timestamp: number) {
  if (!timestamp) {
    return "Not synced yet";
  }

  const diff = Date.now() - timestamp;
  if (diff < 60_000) {
    return "Just now";
  }
  if (diff < 3_600_000) {
    return `${Math.max(1, Math.round(diff / 60_000))}m ago`;
  }

  return new Date(timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function VoicePanel({
  data,
}: {
  data: InsightsSharedData;
  activeTab: InsightsTab;
  onTabChange: (tab: InsightsTab) => void;
}) {
  const [assistantName, setAssistantNameState] = useState("Nova");
  const [status, setStatus] = useState<VoiceStatus>({
    assistantName: "Nova",
    cacheReady: false,
    appActionsReady: isNativeVoiceAssistantAvailable(),
    googleAssistantReady: isNativeVoiceAssistantAvailable(),
    voiceCommandsEnabled: true,
    cacheUpdatedAt: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedName = window.localStorage.getItem(storageKey);
    if (storedName && assistantNames.includes(storedName)) {
      setAssistantNameState(storedName);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, assistantName);
    }

    void syncNativeVoiceAssistantCache({ assistantName });
    void setNativeAssistantName(assistantName);
  }, [assistantName]);

  useEffect(() => {
    const payload = {
      dashboard: data.dashboard,
      analytics: data.analytics,
      activity: data.activity.slice(0, 30),
      smokeDna: data.smokeDna,
      replayHistory: data.replayHistory.slice(0, 5),
      cravingHistory: data.cravingHistory.slice(0, 5),
      liveCraving: data.liveCraving,
      profileLabel: data.profileLabel,
    };

    void syncNativeVoiceAssistantCache(payload);
    void getNativeVoiceAssistantStatus()
      .then((nextStatus) => {
        if (!nextStatus) {
          return;
        }

        setStatus((current) => ({
          ...current,
          assistantName: nextStatus.assistantName ?? current.assistantName,
          cacheReady: nextStatus.cacheReady,
          appActionsReady: nextStatus.appActionsReady,
          googleAssistantReady: nextStatus.googleAssistantReady,
          voiceCommandsEnabled: nextStatus.voiceCommandsEnabled,
          cacheUpdatedAt: nextStatus.cacheUpdatedAt,
        }));
        if (nextStatus.assistantName && nextStatus.assistantName !== assistantName) {
          setAssistantNameState(nextStatus.assistantName);
        }
      })
      .catch(() => null);
  }, [data.activity, data.analytics, data.cravingHistory, data.dashboard, data.liveCraving, data.profileLabel, data.replayHistory, data.smokeDna]);

  useEffect(() => {
    if (!isNativeVoiceAssistantAvailable()) {
      return;
    }

    void getNativeVoiceAssistantStatus()
      .then((nextStatus) => {
        if (!nextStatus) {
          return;
        }

        setStatus({
          assistantName: nextStatus.assistantName ?? assistantName,
          cacheReady: nextStatus.cacheReady,
          appActionsReady: nextStatus.appActionsReady,
          googleAssistantReady: nextStatus.googleAssistantReady,
          voiceCommandsEnabled: nextStatus.voiceCommandsEnabled,
          cacheUpdatedAt: nextStatus.cacheUpdatedAt,
        });
        if (nextStatus.assistantName && nextStatus.assistantName !== assistantName) {
          setAssistantNameState(nextStatus.assistantName);
        }
      })
      .catch(() => {
        setStatus((current) => ({ ...current, assistantName }));
      });
  }, [assistantName]);

  const commandCards = useMemo(
    () =>
      commandGroups.flatMap((group) =>
        group.commands.map((command) => ({
          group: group.title,
          accent: group.accent,
          command: command.replaceAll("Nova", assistantName),
        })),
      ),
    [assistantName],
  );

  const statusRows = [
    {
      label: "Google Assistant Connected",
      value: status.googleAssistantReady,
      detail: status.googleAssistantReady ? "App Actions can receive voice queries" : "Android voice integration is unavailable",
    },
    {
      label: "Voice Commands Enabled",
      value: status.voiceCommandsEnabled,
      detail: status.cacheReady ? (status.voiceCommandsEnabled ? "Commands sync to the native assistant cache" : "Voice commands are paused") : "Waiting for the first data sync",
    },
    {
      label: "App Actions Active",
      value: status.appActionsReady,
      detail: status.appActionsReady ? `Last sync ${formatSyncedAt(status.cacheUpdatedAt)}` : "Assistant shortcuts are not ready",
    },
  ];

  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success("Command copied");
    } catch {
      toast.error("Could not copy the command");
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="border border-foreground/10 bg-gradient-to-br from-background via-background to-foreground/[0.02]">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Voice</div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Google Assistant powered companion</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose your assistant name, copy supported prompts, and let Google Assistant deliver voice replies even when Last Puff is closed.
            </p>
          </div>

          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600">
            Android App Actions
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-foreground/10 bg-background/80 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.05)] backdrop-blur-xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Assistant name</div>
            <div className="mt-2 text-lg font-semibold text-foreground">Select a premium voice identity</div>
            <p className="mt-1 text-sm text-muted-foreground">
              The assistant name is reflected in the supported command examples and the fallback response.
            </p>

            <div className="mt-4">
              <Select value={assistantName} onValueChange={setAssistantNameState}>
                <SelectTrigger className="h-12 w-full rounded-2xl border-foreground/10 bg-background px-4 text-sm">
                  <SelectValue placeholder="Select an assistant name" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-foreground/10 bg-popover">
                  {assistantNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-foreground/10 bg-background/80 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.05)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Status</div>
                <div className="mt-1 text-lg font-semibold text-foreground">Voice stack health</div>
              </div>
              <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}>
                <Sparkles className="h-5 w-5 text-emerald-500" />
              </motion.div>
            </div>

            <div className="mt-4 space-y-3">
              {statusRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3 rounded-2xl border border-foreground/8 bg-card px-3 py-3">
                  <motion.div animate={row.value ? { scale: [1, 1.12, 1] } : {}} transition={{ duration: 1.2, repeat: row.value ? Number.POSITIVE_INFINITY : 0 }}>
                    <CheckCircle2 className={`mt-0.5 h-5 w-5 ${row.value ? "text-emerald-500" : "text-muted-foreground"}`} />
                  </motion.div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{row.label}</div>
                    <div className="text-xs text-muted-foreground">{row.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border border-foreground/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Supported commands</div>
            <div className="mt-2 text-lg font-semibold text-foreground">Copy a command and test it with Google Assistant</div>
          </div>
          <div className="hidden rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 md:block">
            Real data • TTS reply
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {commandCards.map((card) => (
            <div key={`${card.group}-${card.command}`} className={`rounded-[1.5rem] border border-foreground/10 bg-gradient-to-br ${card.accent} p-[1px]`}>
              <div className="rounded-[1.45rem] bg-background/95 p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{card.group}</div>
                <div className="mt-3 text-sm font-medium leading-6 text-foreground">{card.command}</div>
                <button
                  type="button"
                  onClick={() => void copyCommand(card.command)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy command
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
