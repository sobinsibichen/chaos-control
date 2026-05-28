package com.lastpuff.mobile;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Map;

@CapacitorPlugin(name = "Protection")
public class ProtectionPlugin extends Plugin {
    private static final String TAG = "LASTPUFF_PROTECTION";

    @PluginMethod
    public void syncConfig(PluginCall call) {
        Log.i(TAG, "syncConfig called");
        JSArray apps = call.getArray("apps", new JSArray());
        String blockTime = call.getString("blockTime", "22:00");
        Log.i(TAG, "Syncing config - Block time: " + blockTime + ", Apps: " + apps.length());
        
        ProtectionPreferences.saveConfig(getContext(), apps, blockTime);
        
        // Start foreground service
        startProtectionService();
        
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Log.d(TAG, "getStatus called");
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void unlockForToday(PluginCall call) {
        Log.i(TAG, "unlockForToday called");
        ProtectionPreferences.unlockForToday(getContext());
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void relock(PluginCall call) {
        Log.i(TAG, "relock called");
        ProtectionPreferences.relock(getContext());
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Log.i(TAG, "Opening accessibility settings");
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private void startProtectionService() {
        Log.i(TAG, "Starting protection foreground service");
        try {
            Intent serviceIntent = new Intent(getContext(), ProtectionForegroundService.class);
            getContext().startForegroundService(serviceIntent);
            Log.d(TAG, "Protection service started");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start protection service", e);
        }
    }

    private JSObject buildStatus() {
        JSObject status = new JSObject();
        boolean accessibilityEnabled = isAccessibilityServiceEnabled(getContext());
        status.put("accessibilityEnabled", accessibilityEnabled);
        
        Log.i(TAG, "Building status - Accessibility enabled: " + accessibilityEnabled);
        
        for (Map.Entry<String, Object> entry : ProtectionPreferences.getStatus(getContext()).entrySet()) {
            status.put(entry.getKey(), entry.getValue());
        }
        return status;
    }

    public static boolean isAccessibilityServiceEnabled(Context context) {
        String enabledServices = Settings.Secure.getString(
            context.getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );

        if (enabledServices == null) {
            Log.d(TAG, "No accessibility services enabled");
            return false;
        }

        TextUtils.SimpleStringSplitter splitter = new TextUtils.SimpleStringSplitter(':');
        splitter.setString(enabledServices);
        String expected = new ComponentName(context, LastPuffAccessibilityService.class).flattenToString();

        while (splitter.hasNext()) {
            String service = splitter.next();
            if (expected.equalsIgnoreCase(service)) {
                Log.i(TAG, "Accessibility service is enabled");
                return true;
            }
        }

        Log.w(TAG, "Accessibility service NOT found in enabled services");
        return false;
    }
}
