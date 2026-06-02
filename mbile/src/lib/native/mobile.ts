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
    blockEndHour?: number;
    blockEndMinute?: number;
    enabled?: boolean;
    repeatType?: string;
  }): Promise<NativeProtectionStatus>;
  pickBlockTime(): Promise<NativeBlockWindow>;
  getStatus(): Promise<NativeProtectionStatus>;
  getDebugStatus(): Promise<NativeProtectionStatus>;
  unlockForToday(): Promise<NativeProtectionStatus>;
  relock(): Promise<NativeProtectionStatus>;
  openAccessibilitySettings(): Promise<void>;
  openAppInfo(): Promise<void>;
  openOverlaySettings(): Promise<void>;
  openUsageAccessSettings(): Promise<void>;
  requestIgnoreBatteryOptimizations(): Promise<NativeProtectionStatus>;
}

export interface NativeProtectionStatus {
  accessibilityEnabled: boolean;
  accessibilityActive: boolean;
  overlayPermissionGranted: boolean;
  usageAccessGranted: boolean;
  blockTime: string;
  blockHour: number;
  blockMinute: number;
  blockEndHour: number;
  blockEndMinute: number;
  blockedAppsCount: number;
  monitoringActive: boolean;
  serviceRunning: boolean;
  scheduleActive: boolean;
  blockingActive: boolean;
  batteryOptimizationIgnored: boolean;
  restrictedSettingsAllowed: boolean;
  restrictedSettingsRequired: boolean;
  withinBlockedWindow: boolean;
  unlockedForToday: boolean;
  nextAlarmAt?: number;
  foregroundPackage?: string;
  protectionActive?: boolean;
  lastBlockedApp?: string;
  lastOverlayTriggerTime?: number;
  overlayVisible?: boolean;
  blockWindowLabel?: string;
}

export interface NativeBlockWindow {
  hour: number;
  minute: number;
  blockHour: number;
  blockMinute: number;
  blockEndHour: number;
  blockEndMinute: number;
  startLabel: string;
  endLabel: string;
  timeLabel: string;
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
  blockEndHour?: number;
  blockEndMinute?: number;
  enabled?: boolean;
  repeatType?: string;
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

export async function getNativeDebugStatus() {
  if (!isNativeAndroid()) {
    return null;
  }

  return Protection.getDebugStatus();
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

export async function openNativeAppInfo() {
  if (!isNativeAndroid()) {
    return;
  }

  await Protection.openAppInfo();
}

export async function openNativeOverlaySettings() {
  if (!isNativeAndroid()) {
    return;
  }

  await Protection.openOverlaySettings();
}

export async function openNativeUsageAccessSettings() {
  if (!isNativeAndroid()) {
    return;
  }

  await Protection.openUsageAccessSettings();
}

export async function requestNativeBatteryOptimizationExemption() {
  if (!isNativeAndroid()) {
    return null;
  }

  return Protection.requestIgnoreBatteryOptimizations();
}
