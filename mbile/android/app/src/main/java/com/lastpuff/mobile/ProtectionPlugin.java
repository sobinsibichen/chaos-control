package com.lastpuff.mobile;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.timepicker.MaterialTimePicker;
import com.google.android.material.timepicker.TimeFormat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.lastpuff.mobile.data.BlockingRepository;
import com.lastpuff.mobile.data.BlockingScheduleEntity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "Protection")
public class ProtectionPlugin extends Plugin {
    private static final String TAG = "BLOCKER";
    private static final String DEFAULT_REPEAT_TYPE = "daily";
    private PluginCall pendingTimePickerCall;

    @PluginMethod
    public void syncConfig(PluginCall call) {
        JSArray apps = call.getArray("apps", new JSArray());
        int blockHour = call.getInt("blockHour", -1);
        int blockMinute = call.getInt("blockMinute", -1);
        String blockTime = call.getString("blockTime", "");
        boolean enabled = call.getBoolean("enabled", true);
        String repeatType = call.getString("repeatType", DEFAULT_REPEAT_TYPE);

        if ((blockHour < 0 || blockMinute < 0) && !TextUtils.isEmpty(blockTime)) {
            String[] pieces = blockTime.split(":");
            if (pieces.length == 2) {
                try {
                    blockHour = Integer.parseInt(pieces[0]);
                    blockMinute = Integer.parseInt(pieces[1]);
                } catch (NumberFormatException ignored) {
                    blockHour = 22;
                    blockMinute = 0;
                }
            }
        }

        if (blockHour < 0) {
            blockHour = 22;
        }
        if (blockMinute < 0) {
            blockMinute = 0;
        }

        Log.d(TAG, "Syncing protection config for " + apps.length() + " apps at " + BlockingRepository.formatTime(blockHour, blockMinute));

        BlockingRepository.saveSchedule(getContext(), apps, blockHour, blockMinute, repeatType, enabled);
        BlockingEngine.syncProtection(getContext());
        ProtectionWorkScheduler.schedule(getContext());
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void pickBlockTime(PluginCall call) {
        if (!(getActivity() instanceof AppCompatActivity)) {
            call.reject("Time picker requires an Android activity.");
            return;
        }

        AppCompatActivity activity = (AppCompatActivity) getActivity();
        pendingTimePickerCall = call;
        int currentHour = BlockingRepository.getBlockHour(getContext());
        int currentMinute = BlockingRepository.getBlockMinute(getContext());

        MaterialTimePicker picker = new MaterialTimePicker.Builder()
            .setTimeFormat(TimeFormat.CLOCK_24H)
            .setHour(currentHour)
            .setMinute(currentMinute)
            .setTitleText("Pick block time")
            .build();

        picker.addOnPositiveButtonClickListener(dialog -> {
            int pickedHour = picker.getHour();
            int pickedMinute = picker.getMinute();
            JSObject result = new JSObject();
            result.put("hour", pickedHour);
            result.put("minute", pickedMinute);
            result.put("timeLabel", BlockingRepository.formatTime(pickedHour, pickedMinute));
            result.put("blockHour", pickedHour);
            result.put("blockMinute", pickedMinute);
            pendingTimePickerCall.resolve(result);
            pendingTimePickerCall = null;
        });

        picker.addOnCancelListener(dialog -> {
            if (pendingTimePickerCall != null) {
                pendingTimePickerCall.reject("Time picker cancelled.");
                pendingTimePickerCall = null;
            }
        });

        activity.runOnUiThread(() -> picker.show(activity.getSupportFragmentManager(), "last_puff_time_picker"));
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void unlockForToday(PluginCall call) {
        BlockingRepository.setUnlockedForToday(getContext(), true);
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void relock(PluginCall call) {
        BlockingRepository.setUnlockedForToday(getContext(), false);
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve(buildStatus());
            return;
        }

        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve(buildStatus());
    }

    private JSObject buildStatus() {
        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(getContext());
        JSObject status = new JSObject();
        status.put("accessibilityEnabled", BlockingEngine.isAccessibilityServiceEnabled(getContext()));
        status.put("accessibilityActive", BlockingEngine.isAccessibilityActive(getContext()));
        status.put("monitoringActive", BlockingEngine.isMonitoringActive(getContext()));
        status.put("scheduleActive", BlockingEngine.isProtectionScheduleActive(getContext()));
        status.put("batteryOptimizationIgnored", BlockingEngine.isBatteryOptimizationIgnored(getContext()));
        status.put("blockTime", BlockingRepository.getBlockTimeLabel(getContext()));
        status.put("blockHour", schedule.blockHour);
        status.put("blockMinute", schedule.blockMinute);
        status.put("blockedAppsCount", countActiveApps(schedule.blockedAppsJson));
        status.put("withinBlockedWindow", ProtectionPreferences.isWithinBlockedWindow(getContext()));
        status.put("unlockedForToday", BlockingRepository.isUnlockedForToday(getContext()));
        status.put("nextAlarmAt", schedule.nextAlarmAt);
        status.put("foregroundPackage", schedule.foregroundPackage == null ? "" : schedule.foregroundPackage);
        status.put("protectionActive", schedule.protectionActive);
        return status;
    }

    private int countActiveApps(String rawApps) {
        try {
            JSONArray apps = new JSONArray(rawApps == null ? "[]" : rawApps);
            int count = 0;
            for (int index = 0; index < apps.length(); index += 1) {
                JSONObject app = apps.optJSONObject(index);
                if (app != null && app.optBoolean("isActive", false)) {
                    count += 1;
                }
            }
            return count;
        } catch (JSONException error) {
            return 0;
        }
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
        String expected = new ComponentName(context, com.lastpuff.mobile.services.BlockAccessibilityService.class).flattenToString();

        while (splitter.hasNext()) {
            String service = splitter.next();
            if (expected.equalsIgnoreCase(service)) {
                return true;
            }
        }

        return false;
    }
}
