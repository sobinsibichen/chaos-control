package com.lastpuff.mobile;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.material.timepicker.MaterialTimePicker;
import com.google.android.material.timepicker.TimeFormat;
import com.lastpuff.mobile.data.BlockingRepository;
import com.lastpuff.mobile.data.BlockingScheduleEntity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "Protection")
public class ProtectionPlugin extends Plugin {
    private static final String DEFAULT_REPEAT_TYPE = "daily";

    private PluginCall pendingTimePickerCall;
    private Integer pendingStartHour;
    private Integer pendingStartMinute;

    @PluginMethod
    public void syncConfig(PluginCall call) {
        JSArray apps = call.getArray("apps", new JSArray());
        int blockHour = call.getInt("blockHour", -1);
        int blockMinute = call.getInt("blockMinute", -1);
        int blockEndHour = call.getInt("blockEndHour", -1);
        int blockEndMinute = call.getInt("blockEndMinute", -1);
        String blockTime = call.getString("blockTime", "");
        boolean enabled = call.getBoolean("enabled", true);
        String repeatType = call.getString("repeatType", DEFAULT_REPEAT_TYPE);

        if ((!isValidTime(blockHour, blockMinute) || !isValidTime(blockEndHour, blockEndMinute)) && !TextUtils.isEmpty(blockTime)) {
            TimeWindow parsed = parseWindow(blockTime);
            if (parsed != null) {
                if (!isValidTime(blockHour, blockMinute)) {
                    blockHour = parsed.startHour;
                    blockMinute = parsed.startMinute;
                }
                if (!isValidTime(blockEndHour, blockEndMinute)) {
                    blockEndHour = parsed.endHour;
                    blockEndMinute = parsed.endMinute;
                }
            }
        }

        if (!isValidTime(blockHour, blockMinute)) {
            blockHour = 22;
            blockMinute = 0;
        }
        if (!isValidTime(blockEndHour, blockEndMinute)) {
            int[] defaultEnd = addMinutes(blockHour, blockMinute, 600);
            blockEndHour = defaultEnd[0];
            blockEndMinute = defaultEnd[1];
        }

        BlockingRepository.saveSchedule(
            getContext(),
            apps,
            blockHour,
            blockMinute,
            blockEndHour,
            blockEndMinute,
            repeatType,
            enabled
        );

        BlockingEngine.syncProtection(getContext());
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void pickBlockTime(PluginCall call) {
        if (!(getActivity() instanceof AppCompatActivity)) {
            call.reject("Time picker requires an Android activity.");
            return;
        }

        pendingTimePickerCall = call;
        pendingStartHour = null;
        pendingStartMinute = null;
        AppCompatActivity activity = (AppCompatActivity) getActivity();

        int currentHour = BlockingRepository.getBlockHour(getContext());
        int currentMinute = BlockingRepository.getBlockMinute(getContext());
        int currentEndHour = BlockingRepository.getBlockEndHour(getContext());
        int currentEndMinute = BlockingRepository.getBlockEndMinute(getContext());

        showTimePicker(activity, "Pick block start time", currentHour, currentMinute, (startHour, startMinute) -> {
            pendingStartHour = startHour;
            pendingStartMinute = startMinute;
            showTimePicker(activity, "Pick block end time", currentEndHour, currentEndMinute, (endHour, endMinute) -> {
                JSObject result = new JSObject();
                result.put("hour", startHour);
                result.put("minute", startMinute);
                result.put("blockHour", startHour);
                result.put("blockMinute", startMinute);
                result.put("blockEndHour", endHour);
                result.put("blockEndMinute", endMinute);
                result.put("startLabel", BlockingRepository.formatTime(startHour, startMinute));
                result.put("endLabel", BlockingRepository.formatTime(endHour, endMinute));
                result.put("timeLabel", formatWindowLabel(startHour, startMinute, endHour, endMinute));
                resolvePendingPicker(result);
            });
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        if (BlockingEngine.hasRequiredBlockingPermissions(getContext()) && BlockingEngine.isProtectionScheduleActive(getContext())) {
            BlockingEngine.syncProtection(getContext());
        }
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void getDebugStatus(PluginCall call) {
        if (BlockingEngine.hasRequiredBlockingPermissions(getContext()) && BlockingEngine.isProtectionScheduleActive(getContext())) {
            BlockingEngine.syncProtection(getContext());
        }
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
    public void openAppInfo(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
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
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", NotificationHelper.hasNotificationPermission(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        NotificationChannelManager.createAllChannels(getContext());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || NotificationHelper.hasNotificationPermission(getContext())) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        if (getActivity() == null) {
            call.reject("Notification permission requires an active Android screen.");
            return;
        }

        ActivityCompat.requestPermissions(
            getActivity(),
            new String[]{Manifest.permission.POST_NOTIFICATIONS},
            4207
        );

        JSObject result = new JSObject();
        result.put("granted", getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void sendTestNotification(PluginCall call) {
        String title = call.getString("title", "Cigarette Logged");
        String body = call.getString("body", "Your progress has been updated.");
        NotificationHelper.sendReminderNotification(getContext(), title, body);
        JSObject result = new JSObject();
        result.put("delivered", NotificationHelper.hasNotificationPermission(getContext()));
        call.resolve(result);
    }

    private void showTimePicker(AppCompatActivity activity, String title, int hour, int minute, TimePickerCallback callback) {
        MaterialTimePicker picker = new MaterialTimePicker.Builder()
            .setTimeFormat(TimeFormat.CLOCK_24H)
            .setHour(hour)
            .setMinute(minute)
            .setTitleText(title)
            .build();

        picker.addOnPositiveButtonClickListener(dialog -> callback.onPicked(picker.getHour(), picker.getMinute()));
        picker.addOnCancelListener(dialog -> rejectPendingPicker("Time picker cancelled."));
        activity.runOnUiThread(() -> picker.show(activity.getSupportFragmentManager(), "last_puff_time_picker"));
    }

    private void resolvePendingPicker(JSObject result) {
        if (pendingTimePickerCall != null) {
            pendingTimePickerCall.resolve(result);
            pendingTimePickerCall = null;
        }
        pendingStartHour = null;
        pendingStartMinute = null;
    }

    private void rejectPendingPicker(String message) {
        if (pendingTimePickerCall != null) {
            pendingTimePickerCall.reject(message);
            pendingTimePickerCall = null;
        }
        pendingStartHour = null;
        pendingStartMinute = null;
    }

    private JSObject buildStatus() {
        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(getContext());
        boolean accessibilityEnabled = BlockingEngine.isAccessibilityServiceEnabled(getContext());
        boolean accessibilityActive = BlockingEngine.isAccessibilityActive(getContext());
        boolean restrictedSettingsAllowed = BlockingEngine.isRestrictedSettingsAllowed(getContext());
        JSObject status = new JSObject();
        status.put("accessibilityEnabled", accessibilityEnabled);
        status.put("accessibilityActive", accessibilityActive);
        status.put("overlayPermissionGranted", BlockingEngine.isOverlayPermissionGranted(getContext()));
        status.put("usageAccessGranted", BlockingEngine.isUsageAccessGranted(getContext()));
        status.put("monitoringActive", BlockingEngine.isMonitoringActive(getContext()));
        status.put("serviceRunning", BlockingRepository.isServiceRunning(getContext()));
        status.put("scheduleActive", BlockingEngine.isProtectionScheduleActive(getContext()));
        status.put("blockingActive", BlockingEngine.isWithinBlockedWindow(getContext()) && !BlockingRepository.isUnlockedForToday(getContext()));
        status.put("batteryOptimizationIgnored", BlockingEngine.isBatteryOptimizationIgnored(getContext()));
        status.put("restrictedSettingsAllowed", restrictedSettingsAllowed);
        status.put("restrictedSettingsRequired", !restrictedSettingsAllowed);
        status.put("blockTime", BlockingRepository.getBlockWindowLabel(getContext()));
        status.put("blockHour", schedule.blockHour);
        status.put("blockMinute", schedule.blockMinute);
        status.put("blockEndHour", BlockingRepository.getBlockEndHour(getContext()));
        status.put("blockEndMinute", BlockingRepository.getBlockEndMinute(getContext()));
        status.put("blockedAppsCount", countActiveApps(schedule.blockedAppsJson));
        status.put("withinBlockedWindow", BlockingEngine.isWithinBlockedWindow(getContext()));
        status.put("unlockedForToday", BlockingRepository.isUnlockedForToday(getContext()));
        status.put("nextAlarmAt", schedule.nextAlarmAt);
        status.put("foregroundPackage", emptyToBlank(BlockingRepository.getForegroundPackage(getContext())));
        status.put("lastBlockedApp", emptyToBlank(BlockingRepository.getLastBlockedPackage(getContext())));
        status.put("lastOverlayTriggerTime", BlockingRepository.getLastOverlayTriggerAt(getContext()));
        status.put("overlayVisible", BlockingRepository.isOverlayVisible(getContext()));
        status.put("blockWindowLabel", BlockingRepository.getBlockWindowLabel(getContext()));
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

    private static boolean isValidTime(int hour, int minute) {
        return hour >= 0 && hour < 24 && minute >= 0 && minute < 60;
    }

    private static String emptyToBlank(String value) {
        return value == null ? "" : value;
    }

    private static String formatWindowLabel(int startHour, int startMinute, int endHour, int endMinute) {
        return BlockingRepository.formatTime(startHour, startMinute) + " - " + BlockingRepository.formatTime(endHour, endMinute);
    }

    private static TimeWindow parseWindow(String rawWindow) {
        if (TextUtils.isEmpty(rawWindow)) {
            return null;
        }

        String normalized = rawWindow.trim().replace(" to ", "-").replace("→", "-");
        String[] parts = normalized.split("-");
        int[] start = parseTime(parts[0]);
        if (start == null) {
            return null;
        }

        int[] end = parts.length < 2 ? addMinutes(start[0], start[1], 600) : parseTime(parts[1]);
        if (end == null) {
            end = addMinutes(start[0], start[1], 600);
        }

        return new TimeWindow(start[0], start[1], end[0], end[1]);
    }

    private static int[] addMinutes(int hour, int minute, int minutesToAdd) {
        int totalMinutes = ((hour * 60 + minute + minutesToAdd) % (24 * 60) + (24 * 60)) % (24 * 60);
        return new int[]{totalMinutes / 60, totalMinutes % 60};
    }

    private static int[] parseTime(String value) {
        if (value == null) {
            return null;
        }

        String[] parts = value.trim().split(":");
        if (parts.length < 2) {
            return null;
        }

        try {
            int hour = Integer.parseInt(parts[0].trim());
            int minute = Integer.parseInt(parts[1].trim());
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                return null;
            }
            return new int[]{hour, minute};
        } catch (NumberFormatException error) {
            return null;
        }
    }

    private interface TimePickerCallback {
        void onPicked(int hour, int minute);
    }

    private static final class TimeWindow {
        final int startHour;
        final int startMinute;
        final int endHour;
        final int endMinute;

        TimeWindow(int startHour, int startMinute, int endHour, int endMinute) {
            this.startHour = startHour;
            this.startMinute = startMinute;
            this.endHour = endHour;
            this.endMinute = endMinute;
        }
    }
}
