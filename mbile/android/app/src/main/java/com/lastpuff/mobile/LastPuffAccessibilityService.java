package com.lastpuff.mobile;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;

public class LastPuffAccessibilityService extends AccessibilityService {
    private static final long LAUNCH_DEBOUNCE_MS = 1200;
    private String lastBlockedPackage = "";
    private long lastLaunchAt = 0L;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            return;
        }

        String packageName = event.getPackageName().toString();
        if (getPackageName().equals(packageName)) {
            return;
        }

        if (!ProtectionPreferences.shouldBlockPackage(this, packageName)) {
            return;
        }

        long now = SystemClock.elapsedRealtime();
        if (packageName.equals(lastBlockedPackage) && now - lastLaunchAt < LAUNCH_DEBOUNCE_MS) {
            return;
        }

        lastBlockedPackage = packageName;
        lastLaunchAt = now;

        Intent intent = new Intent(this, BlockedAppActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("packageName", packageName);
        intent.putExtra("appName", ProtectionPreferences.getAppName(this, packageName));
        startActivity(intent);
    }

    @Override
    public void onInterrupt() {
    }
}
