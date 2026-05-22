export const NativeCapabilities = {
  accessibilityService: true,
  usageStatsManager: true,
  overlayService: true,
  foregroundAppMonitor: true,
};

export const NativeModules = [
  {
    name: "AppBlockerModule",
    platform: "android",
    status: "planned",
    notes: "Future app blocking bridge for accessibility-driven enforcement.",
  },
  {
    name: "OverlayManager",
    platform: "android",
    status: "planned",
    notes: "Planned overlay permission and blocking surface coordinator.",
  },
  {
    name: "ForegroundAppService",
    platform: "android",
    status: "planned",
    notes: "Planned foreground app detection and monitoring service.",
  },
  {
    name: "ScheduleManager",
    platform: "android",
    status: "planned",
    notes: "Planned schedule-backed blocking orchestration layer.",
  },
];
