package com.lastpuff.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Boot receiver that restores app protection after device reboot.
 * Ensures protection services are restarted automatically.
 */
public class ProtectionBootReceiver extends BroadcastReceiver {
    private static final String TAG = "LASTPUFF_PROTECTION";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        
        if (action == null) {
            Log.w(TAG, "BootReceiver: Null action");
            return;
        }

        Log.i(TAG, "BootReceiver: Action received - " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            Log.i(TAG, "Device boot detected - restoring protection");
            restoreProtection(context);
        }
    }

    private void restoreProtection(Context context) {
        try {
            // Start protection foreground service
            Intent serviceIntent = new Intent(context, ProtectionForegroundService.class);
            context.startForegroundService(serviceIntent);
            Log.i(TAG, "Protection service restarted after boot");

            // Log current configuration
            String blockTime = ProtectionPreferences.getBlockTime(context);
            int appsCount = ProtectionPreferences.getBlockedApps(context).length();
            Log.d(TAG, "Boot restore - Block time: " + blockTime + ", Protected apps: " + appsCount);
        } catch (Exception e) {
            Log.e(TAG, "Failed to restore protection after boot", e);
        }
    }
}
