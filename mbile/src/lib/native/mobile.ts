import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export interface NativeInstalledApp {
  appName: string;
  packageName: string;
  systemApp?: boolean;
}

interface InstalledAppsPlugin {
  listInstalledApps(options?: { includeSystemApps?: boolean }): Promise<{ apps: NativeInstalledApp[] }>;
}

interface ProtectionPlugin {
  syncConfig(options: {
    apps: Array<{ appName: string; packageName: string; isActive: boolean }>;
    blockTime?: string;
    blockHour?: number;
    blockMinute?: number;
    enabled?: boolean;
    repeatType?: string;
  }): Promise<NativeProtectionStatus>;
  pickBlockTime(): Promise<{ hour: number; minute: number; timeLabel: string; blockHour: number; blockMinute: number }>;
  getStatus(): Promise<NativeProtectionStatus>;
  unlockForToday(): Promise<NativeProtectionStatus>;
  relock(): Promise<NativeProtectionStatus>;
  openAccessibilitySettings(): Promise<void>;
  requestIgnoreBatteryOptimizations(): Promise<NativeProtectionStatus>;
}

export interface NativeProtectionStatus {
  accessibilityEnabled: boolean;
  accessibilityActive: boolean;
  blockTime: string;
  blockHour: number;
  blockMinute: number;
  blockedAppsCount: number;
  monitoringActive: boolean;
  scheduleActive: boolean;
  batteryOptimizationIgnored: boolean;
  withinBlockedWindow: boolean;
  unlockedForToday: boolean;
  nextAlarmAt?: number;
  foregroundPackage?: string;
  protectionActive?: boolean;
}

const InstalledApps = registerPlugin<InstalledAppsPlugin>("InstalledApps");
const Protection = registerPlugin<ProtectionPlugin>("Protection");

export function isNativeAndroid() {
  return Capacitor.getPlatform() === "android";
}

export async function ensureNativeLocationPermission() {
  if (!isNativeAndroid()) {
    return;
  }

  const current = await Geolocation.checkPermissions();
  if (current.location === "granted" || current.coarseLocation === "granted") {
    return;
  }

  const requested = await Geolocation.requestPermissions();
  if (requested.location !== "granted" && requested.coarseLocation !== "granted") {
    throw new Error("Location access is turned off for Last Puff. Please allow location permission in Android settings.");
  }
}

export async function getInstalledApps() {
  if (!isNativeAndroid()) {
    return [] as NativeInstalledApp[];
  }

  const result = await InstalledApps.listInstalledApps({ includeSystemApps: false });
  return result.apps;
}

export async function syncNativeProtectionConfig(options: {
  apps: Array<{ appName: string; packageName: string; isActive: boolean }>;
  blockTime: string;
  blockHour?: number;
  blockMinute?: number;
}) {
  if (!isNativeAndroid()) {
    return null;
  }

  return Protection.syncConfig(options);
}

export async function pickNativeBlockTime() {
  if (!isNativeAndroid()) {
    return null;
  }

  return Protection.pickBlockTime();
}

export async function getNativeProtectionStatus() {
  if (!isNativeAndroid()) {
    return null;
  }

  return Protection.getStatus();
}

export async function unlockNativeProtectionForToday() {
  if (!isNativeAndroid()) {
    return null;
  }

  return Protection.unlockForToday();
}

export async function relockNativeProtection() {
  if (!isNativeAndroid()) {
    return null;
  }

  return Protection.relock();
}

export async function openNativeAccessibilitySettings() {
  if (!isNativeAndroid()) {
    return;
  }

  await Protection.openAccessibilitySettings();
}

export async function requestNativeBatteryOptimizationExemption() {
  if (!isNativeAndroid()) {
    return null;
  }

  return Protection.requestIgnoreBatteryOptimizations();
}
