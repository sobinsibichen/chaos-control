package com.lastpuff.mobile;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

public class LastPuffAccessibilityService extends AccessibilityService {
    private static final String TAG = "LASTPUFF_PROTECTION";
    private static final long LAUNCH_DEBOUNCE_MS = 1200;
    private String lastBlockedPackage = "";
    private long lastLaunchAt = 0L;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            Log.d(TAG, "Accessibility: Null event or package name");
            return;
        }

        String packageName = event.getPackageName().toString();
        String eventType = getEventTypeName(event.getEventType());
        
        Log.d(TAG, "Accessibility event - Type: " + eventType + ", Package: " + packageName);

        // Skip own app
        if (getPackageName().equals(packageName)) {
            Log.d(TAG, "Skipping own app");
            return;
        }

        // Check if should block
        if (!ProtectionPreferences.shouldBlockPackage(this, packageName)) {
            Log.d(TAG, "Package not in blocked list or outside window: " + packageName);
            return;
        }

        // Apply debounce
        long now = SystemClock.elapsedRealtime();
        if (packageName.equals(lastBlockedPackage) && now - lastLaunchAt < LAUNCH_DEBOUNCE_MS) {
            Log.d(TAG, "Debounced: Recent block attempt for " + packageName);
            return;
        }

        lastBlockedPackage = packageName;
        lastLaunchAt = now;

        String appName = ProtectionPreferences.getAppName(this, packageName);
        Log.i(TAG, "BLOCKING APP: " + appName + " (" + packageName + ")");

        Intent intent = new Intent(this, BlockedAppActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("packageName", packageName);
        intent.putExtra("appName", appName);
        
        try {
            startActivity(intent);
            Log.i(TAG, "Block overlay launched for: " + appName);
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch block overlay", e);
        }
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted");
    }

    @Override
    protected void onServiceConnected() {
        Log.i(TAG, "Accessibility service connected");
        super.onServiceConnected();
    }

    private String getEventTypeName(int eventType) {
        switch (eventType) {
            case AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED:
                return "WINDOW_STATE_CHANGED";
            case AccessibilityEvent.TYPE_WINDOWS_CHANGED:
                return "WINDOWS_CHANGED";
            case AccessibilityEvent.TYPE_VIEW_FOCUSED:
                return "VIEW_FOCUSED";
            case AccessibilityEvent.TYPE_VIEW_CLICKED:
                return "VIEW_CLICKED";
            default:
                return "OTHER (" + eventType + ")";
        }
    }
}
