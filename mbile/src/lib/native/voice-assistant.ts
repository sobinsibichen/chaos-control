import { Capacitor, registerPlugin } from "@capacitor/core";

interface VoiceAssistantStatus {
  running: boolean;
  assistantName: string;
  cacheReady: boolean;
  appActionsReady: boolean;
  googleAssistantReady: boolean;
  voiceCommandsEnabled: boolean;
  cacheUpdatedAt: number;
  lastInvocationAt: number;
  lastCommand: string | null;
  lastResponse: string | null;
}

interface VoiceAssistantPlugin {
  start(): Promise<VoiceAssistantStatus>;
  stop(): Promise<VoiceAssistantStatus>;
  getStatus(): Promise<VoiceAssistantStatus>;
  syncCache(options: { payload: Record<string, unknown> }): Promise<void>;
  setAssistantName(options: { assistantName: string }): Promise<VoiceAssistantStatus>;
}

const VoiceAssistant = registerPlugin<VoiceAssistantPlugin>("VoiceAssistant");

export function isNativeVoiceAssistantAvailable() {
  return Capacitor.getPlatform() === "android";
}

export async function startNativeVoiceAssistant() {
  if (!isNativeVoiceAssistantAvailable()) {
    return null;
  }

  return VoiceAssistant.start();
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

export async function setNativeAssistantName(assistantName: string) {
  if (!isNativeVoiceAssistantAvailable()) {
    return null;
  }

  return VoiceAssistant.setAssistantName({ assistantName });
}
