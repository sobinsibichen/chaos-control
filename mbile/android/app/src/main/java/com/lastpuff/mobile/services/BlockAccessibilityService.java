package com.lastpuff.mobile.services;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

import com.lastpuff.mobile.BlockingEngine;
import com.lastpuff.mobile.data.BlockingRepository;

public class BlockAccessibilityService extends AccessibilityService {
    private static final String TAG = "BLOCKER";
    private static final long BLOCK_DEBOUNCE_MS = 850L;
    private String lastBlockedPackage = "";
    private long lastBlockedAt = 0L;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            return;
        }

        String packageName = event.getPackageName().toString();
        if (getPackageName().equals(packageName)) {
            return;
        }

        BlockingEngine.markAccessibilityConnected(this);
        BlockingRepository.setAccessibilityState(this, true);

        Log.d(TAG, "Foreground app: " + packageName);
        if (!BlockingEngine.shouldBlockPackage(this, packageName)) {
            return;
        }

        long now = SystemClock.elapsedRealtime();
        if (packageName.equals(lastBlockedPackage) && now - lastBlockedAt < BLOCK_DEBOUNCE_MS) {
            return;
        }

        lastBlockedPackage = packageName;
        lastBlockedAt = now;
        Log.d(TAG, "Launching block screen");

        Intent intent = new Intent(this, com.lastpuff.mobile.BlockScreenActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
        intent.putExtra("packageName", packageName);
        intent.putExtra("appName", BlockingEngine.resolveAppName(this, packageName));
        intent.putExtra("reason", "accessibility");
        startActivity(intent);
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Accessibility interrupted");
        BlockingRepository.setAccessibilityState(this, false);
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        BlockingEngine.markAccessibilityConnected(this);
        BlockingRepository.setAccessibilityState(this, true);
        Log.d(TAG, "Accessibility connected");
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "Accessibility destroyed");
        BlockingRepository.setAccessibilityState(this, false);
        super.onDestroy();
    }
}
