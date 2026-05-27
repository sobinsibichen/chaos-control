import { Capacitor, registerPlugin } from "@capacitor/core";

interface VoiceAssistantStatus {
  running: boolean;
  wakeWord: string;
  lastCommandAt: string | null;
}

interface VoiceAssistantPlugin {
  start(options?: { wakeWord?: string }): Promise<VoiceAssistantStatus>;
  stop(): Promise<VoiceAssistantStatus>;
  getStatus(): Promise<VoiceAssistantStatus>;
  syncCache(options: { payload: Record<string, unknown> }): Promise<void>;
}

const VoiceAssistant = registerPlugin<VoiceAssistantPlugin>("VoiceAssistant");

export function isNativeVoiceAssistantAvailable() {
  return Capacitor.getPlatform() === "android";
}

export async function startNativeVoiceAssistant(wakeWord = "Hey Nova") {
  if (!isNativeVoiceAssistantAvailable()) {
    return null;
  }

  return VoiceAssistant.start({ wakeWord });
}

export async function stopNativeVoiceAssistant() {
  if (!isNativeVoiceAssistantAvailable()) {
    return null;
  }

  return VoiceAssistant.stop();
}

export async function getNativeVoiceAssistantStatus() {
  if (!isNativeVoiceAssistantAvailable()) {
    return null;
  }

  return VoiceAssistant.getStatus();
}

export async function syncNativeVoiceAssistantCache(payload: Record<string, unknown>) {
  if (!isNativeVoiceAssistantAvailable()) {
    return;
  }

  await VoiceAssistant.syncCache({ payload });
}
