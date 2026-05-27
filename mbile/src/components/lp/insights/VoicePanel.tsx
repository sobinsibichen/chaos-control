import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { BrainCircuit, Mic, MicOff, Waves } from "lucide-react";
import toast from "react-hot-toast";
import { GlassCard } from "@/components/lp/GlassCard";
import { apiRequest } from "@/lib/api";
import { createCravingPrediction } from "@/lib/cravingApi";
import { buildVoiceReply } from "@/lib/intelligence";
import { createVoiceCommand } from "@/lib/intelligenceApi";
import { queryKeys } from "@/lib/query-keys";
import type { InsightsSharedData, InsightsTab } from "./InsightsState";

export function VoicePanel({
  data,
  activeTab,
  onTabChange,
}: {
  data: InsightsSharedData;
  activeTab: InsightsTab;
  onTabChange: (tab: InsightsTab) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    transcript,
    resetTranscript,
    listening,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const voiceMutation = useMutation({
    mutationFn: async (command: string) => {
      const reply = buildVoiceReply(command, {
        dashboard: data.dashboard,
        analytics: data.analytics,
        profileLabel: data.profileLabel,
      });

      const normalized = command.toLowerCase();
      let commandIntent = "general";

      if (normalized.includes("track") && normalized.includes("cigarette")) {
        commandIntent = "track-cigarette";
        await apiRequest("/api/cigarettes/log", {
          method: "POST",
          body: JSON.stringify({ cigarettesCount: 1, mood: "voice-tracked" }),
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
          queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
          queryClient.invalidateQueries({ queryKey: queryKeys.analytics }),
          queryClient.invalidateQueries({ queryKey: queryKeys.smokeReplayHistory }),
          queryClient.invalidateQueries({ queryKey: queryKeys.smokeReplayMonthly(new Date().getFullYear(), new Date().getMonth() + 1) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.smokeReplayYearly(new Date().getFullYear()) }),
        ]);
      } else if (normalized.includes("nearby") || normalized.includes("store")) {
        commandIntent = "nearby-stores";
        await navigate({ to: "/social" });
      } else if (normalized.includes("insight") || normalized.includes("roast")) {
        commandIntent = "insights";
        onTabChange("Roast");
      } else if (normalized.includes("dna")) {
        commandIntent = "smoke-dna";
        onTabChange("Smoke DNA");
      } else if (normalized.includes("predict") || normalized.includes("craving")) {
        commandIntent = "craving-ai";
        onTabChange("Craving AI");
        await createCravingPrediction({ predictionWindow: "30m" });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.cravingHistory }),
          queryClient.invalidateQueries({ queryKey: queryKeys.cravingLive }),
        ]);
      }

      const saved = await createVoiceCommand({
        commandText: command,
        aiResponse: reply,
        commandIntent,
        executionStatus: "completed",
        metadata: {
          source: "voice-companion",
          activeTab,
        },
      });

      return { reply, saved };
    },
    onSuccess: ({ reply }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.voiceCommands });
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
      toast.success("Nova responded");
      resetTranscript();
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Nova could not complete that request.");
    },
  });

  const executeVoiceCommand = (command: string) => {
    const trimmed = command.trim();
    if (!trimmed) {
      toast.error("Say something first.");
      return;
    }
    voiceMutation.mutate(trimmed);
  };

  return (
    <div className="space-y-4">
      <GlassCard glow="cyan" className="border border-foreground/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Nova</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">Voice Companion</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask Nova to track a cigarette, jump to nearby stores, open your Insights, or predict cravings.
            </p>
          </div>
          <BrainCircuit className="h-6 w-6 animate-float text-sky-600" />
        </div>

        <div className="mt-5 rounded-[1.75rem] border border-foreground/10 bg-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Listening</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{listening ? "Nova is listening" : "Tap the mic to speak"}</div>
            </div>
            <button
              onClick={() => {
                if (listening) {
                  SpeechRecognition.stopListening();
                } else {
                  SpeechRecognition.startListening({ continuous: false, language: "en-IN" }).catch(() => {
                    toast.error("Voice recognition is unavailable on this device.");
                  });
                }
              }}
              disabled={!browserSupportsSpeechRecognition}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${listening ? "bg-primary text-primary-foreground shadow-[0_0_0_12px_rgba(15,23,42,0.08)]" : "bg-background text-foreground"}`}
            >
              {listening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-foreground/10 bg-card px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              <Waves className="h-4 w-4" />
              Live transcript
            </div>
            <div className="mt-2 text-sm text-foreground">{transcript || "Try: Hey Nova, track my cigarette"}</div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => executeVoiceCommand(transcript)}
                className="rounded-full bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground"
              >
                {voiceMutation.isPending ? "Saving..." : "Run Command"}
              </button>
              <button
                onClick={() => resetTranscript()}
                className="rounded-full border border-foreground/10 bg-background px-4 py-3 text-xs font-semibold text-foreground"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border border-foreground/10">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Supported commands</div>
        <div className="grid gap-2">
          {[
            "Hey Nova track my cigarette",
            "Hey Nova nearby stores",
            "Hey Nova how many cigarettes today",
            "Hey Nova open insights",
            "Hey Nova show craving prediction",
          ].map((command) => (
            <button
              key={command}
              onClick={() => executeVoiceCommand(command)}
              className="rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              {command}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="border border-foreground/10">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Voice history</div>
        <div className="space-y-3">
          {data.voiceHistory.length ? data.voiceHistory.slice(0, 5).map((item) => (
            <div key={item.id} className="rounded-2xl border border-foreground/10 bg-background px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{item.commandText}</div>
              <div className="mt-1 text-sm text-muted-foreground">{item.aiResponse}</div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-foreground/10 bg-background px-4 py-6 text-sm text-muted-foreground">
              No voice commands yet. Nova is waiting.
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
