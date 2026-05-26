package com.lastpuff.mobile;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Map;

@CapacitorPlugin(name = "Protection")
public class ProtectionPlugin extends Plugin {
    @PluginMethod
    public void syncConfig(PluginCall call) {
        JSArray apps = call.getArray("apps", new JSArray());
        String blockTime = call.getString("blockTime", "22:00");
        ProtectionPreferences.saveConfig(getContext(), apps, blockTime);
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void unlockForToday(PluginCall call) {
        ProtectionPreferences.unlockForToday(getContext());
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void relock(PluginCall call) {
        ProtectionPreferences.relock(getContext());
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private JSObject buildStatus() {
        JSObject status = new JSObject();
        status.put("accessibilityEnabled", isAccessibilityServiceEnabled(getContext()));
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
            return false;
        }

        TextUtils.SimpleStringSplitter splitter = new TextUtils.SimpleStringSplitter(':');
        splitter.setString(enabledServices);
        String expected = new ComponentName(context, LastPuffAccessibilityService.class).flattenToString();

        while (splitter.hasNext()) {
            String service = splitter.next();
            if (expected.equalsIgnoreCase(service)) {
                return true;
            }
        }

        return false;
    }
}
