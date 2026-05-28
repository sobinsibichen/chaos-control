import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/lp/AppShell";
import { GlassCard } from "@/components/lp/GlassCard";
import { requireAuth } from "@/lib/route-guards";
import { getNativeDebugStatus, type NativeProtectionStatus } from "@/lib/native/mobile";

export const Route = createFileRoute("/debug")({
  beforeLoad: requireAuth,
  component: DebugPage,
});

function formatTimestamp(value?: number) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function DebugPage() {
  const [status, setStatus] = useState<NativeProtectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const debugStatus = await getNativeDebugStatus();
      setStatus(debugStatus);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Debug</div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Protection Diagnostics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hidden state page for verifying the blocker engine on-device.</p>
        </div>
        <button
          onClick={() => void loadStatus()}
          className="inline-flex items-center gap-2 rounded-2xl border border-foreground/10 bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <GlassCard className="space-y-3">
        {[
          ["Accessibility", status?.accessibilityEnabled ? "Enabled" : "Disabled"],
          ["Accessibility Active", status?.accessibilityActive ? "Yes" : "No"],
          ["Overlay Permission", status?.overlayPermissionGranted ? "Granted" : "Missing"],
          ["Usage Access", status?.usageAccessGranted ? "Granted" : "Missing"],
          ["Foreground App", status?.foregroundPackage || "None"],
          ["Active Schedule", status?.blockWindowLabel || status?.blockTime || "None"],
          ["Blocking Active", status?.blockingActive ? "Yes" : "No"],
          ["Last Blocked App", status?.lastBlockedApp || "None"],
          ["Service Running", status?.serviceRunning ? "Yes" : "No"],
          ["Last Overlay Trigger", formatTimestamp(status?.lastOverlayTriggerTime)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold text-foreground">{value}</div>
          </div>
        ))}
        {loading ? <div className="text-xs text-muted-foreground">Refreshing live state...</div> : null}
      </GlassCard>
    </AppShell>
  );
}
