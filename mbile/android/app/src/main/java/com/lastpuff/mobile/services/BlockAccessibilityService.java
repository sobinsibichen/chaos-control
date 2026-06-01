package com.lastpuff.mobile.services;

import android.accessibilityservice.AccessibilityService;
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
        long startedAt = SystemClock.elapsedRealtimeNanos();
        if (event == null || event.getPackageName() == null) {
            return;
        }

        String packageName = event.getPackageName().toString();
        if (getPackageName().equals(packageName)) {
            return;
        }

        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            && event.getEventType() != AccessibilityEvent.TYPE_WINDOWS_CHANGED) {
            return;
        }

        BlockingEngine.markAccessibilityConnected(this);
        BlockingRepository.setAccessibilityState(this, true);
        BlockingRepository.setMonitoringState(this, true, packageName);
        BlockingRepository.setServiceRunning(this, true);
        BlockingRepository.setForegroundPackage(this, packageName);

        long now = System.currentTimeMillis();
        if (packageName.equals(lastBlockedPackage) && now - lastBlockedAt < BLOCK_DEBOUNCE_MS) {
            return;
        }

        boolean shouldBlock = BlockingEngine.shouldBlockPackage(this, packageName);
        if (shouldBlock) {
            lastBlockedPackage = packageName;
            lastBlockedAt = now;
            BlockingEngine.launchBlockScreen(this, packageName, "accessibility");
        } else if (BlockingRepository.isOverlayVisible(this)) {
            com.lastpuff.mobile.BlockOverlayManager.getInstance(this).refreshOverlay();
        }
        long durationMicros = (SystemClock.elapsedRealtimeNanos() - startedAt) / 1000L;
        if (durationMicros > 50_000L) {
            Log.w(TAG, "perf accessibility_event package=" + packageName + " durationMicros=" + durationMicros + " eventType=" + event.getEventType());
        } else {
            Log.d(TAG, "perf accessibility_event package=" + packageName + " durationMicros=" + durationMicros + " eventType=" + event.getEventType());
        }
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
        BlockingRepository.setServiceRunning(this, true);
        Log.d(TAG, "Accessibility connected");
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "Accessibility destroyed");
        BlockingRepository.setAccessibilityState(this, false);
        super.onDestroy();
    }
}
