package com.lastpuff.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;
import android.view.accessibility.AccessibilityManager;

import com.lastpuff.mobile.data.BlockingRepository;
import com.lastpuff.mobile.data.BlockingScheduleEntity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;

public final class BlockingEngine {
    private static final String TAG = "BLOCKER";
    private static final long ACCESSIBILITY_HEARTBEAT_WINDOW_MS = 15_000L;
    private static final long MONITOR_HEARTBEAT_WINDOW_MS = 20_000L;
    private static final long FOREGROUND_STALE_WINDOW_MS = 5_000L;

    private BlockingEngine() {
    }

    public static boolean shouldBlockPackage(Context context, String packageName) {
        if (context == null || TextUtils.isEmpty(packageName)) {
            return false;
        }

        String ownPackage = context.getPackageName();
        if (ownPackage.equals(packageName)) {
            return false;
        }

        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        if (!schedule.enabled || BlockingRepository.isUnlockedForToday(context)) {
            return false;
        }

        if (!isWithinBlockedWindow(context)) {
            return false;
        }

        try {
            JSONArray apps = new JSONArray(schedule.blockedAppsJson == null ? "[]" : schedule.blockedAppsJson);
            for (int index = 0; index < apps.length(); index += 1) {
                JSONObject app = apps.optJSONObject(index);
                if (app == null || !app.optBoolean("isActive", false)) {
                    continue;
                }

                if (packageName.equals(app.optString("packageName"))) {
                    return true;
                }
            }
        } catch (JSONException error) {
            Log.e(TAG, "Failed to parse blocked apps", error);
        }

        return false;
    }

    public static boolean isProtectionScheduleActive(Context context) {
        if (context == null) {
            return false;
        }

        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        return schedule.enabled && !TextUtils.isEmpty(schedule.blockedAppsJson) && hasActiveApps(schedule.blockedAppsJson);
    }

    public static boolean isAccessibilityActive(Context context) {
        boolean enabled = isAccessibilityServiceEnabled(context);
        long heartbeatAt = BlockingRepository.getAccessibilityHeartbeatAt(context);
        boolean recentHeartbeat = heartbeatAt > 0L && System.currentTimeMillis() - heartbeatAt < ACCESSIBILITY_HEARTBEAT_WINDOW_MS;
        return enabled && recentHeartbeat;
    }

    public static boolean isMonitoringActive(Context context) {
        long heartbeatAt = BlockingRepository.getLastHeartbeatAt(context);
        boolean recentHeartbeat = heartbeatAt > 0L && System.currentTimeMillis() - heartbeatAt < MONITOR_HEARTBEAT_WINDOW_MS;
        return recentHeartbeat && BlockingRepository.isServiceRunning(context);
    }

    public static boolean isExactAlarmScheduled(Context context) {
        return BlockingRepository.getNextAlarmAt(context) > System.currentTimeMillis();
    }

    public static boolean isBatteryOptimizationIgnored(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || context == null) {
            return true;
        }

        android.os.PowerManager powerManager = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
        return powerManager != null && powerManager.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    public static boolean isOverlayPermissionGranted(Context context) {
        return context != null && (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context));
    }

    public static boolean isUsageAccessGranted(Context context) {
        if (context == null) {
            return false;
        }

        android.app.AppOpsManager appOpsManager = (android.app.AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        if (appOpsManager == null) {
            return false;
        }

        int mode = appOpsManager.checkOpNoThrow(
            android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            context.getPackageName()
        );
        return mode == android.app.AppOpsManager.MODE_ALLOWED;
    }

    public static void syncProtection(Context context) {
        startMonitoringService(context);
        scheduleExactAlarm(context);
        BlockingRepository.setBatteryOptimizationIgnored(context, isBatteryOptimizationIgnored(context));
    }

    public static void startMonitoringService(Context context) {
        if (context == null) {
            return;
        }

        Intent serviceIntent = new Intent(context, ProtectionForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
        BlockingRepository.setServiceRunning(context, true);
    }

    public static void scheduleExactAlarm(Context context) {
        if (context == null) {
            return;
        }

        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.w(TAG, "AlarmManager unavailable");
            return;
        }

        Intent alarmIntent = new Intent(context, com.lastpuff.mobile.receivers.ProtectionAlarmReceiver.class);
        alarmIntent.setAction("com.lastpuff.mobile.ACTION_BLOCK_ALARM");
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            1024,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (!schedule.enabled || TextUtils.isEmpty(schedule.blockedAppsJson)) {
            alarmManager.cancel(pendingIntent);
            BlockingRepository.setAlarmState(context, 0L, false);
            return;
        }

        long triggerAt = nextTransitionTime(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            Log.w(TAG, "Exact alarm permission not granted");
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        }

        BlockingRepository.setAlarmState(context, triggerAt, true);
    }

    public static void onAlarmTriggered(Context context) {
        syncProtection(context);
    }

    public static void markAccessibilityConnected(Context context) {
        BlockingRepository.setAccessibilityState(context, true);
    }

    public static void markMonitoringHeartbeat(Context context, String foregroundPackage) {
        BlockingRepository.setMonitoringState(context, true, foregroundPackage);
        BlockingRepository.setServiceRunning(context, true);
    }

    public static void markOverlayShown(Context context, String packageName) {
        BlockingRepository.setLastBlockedPackage(context, packageName);
        BlockingRepository.setLastOverlayTriggerAt(context, System.currentTimeMillis());
        BlockingRepository.setOverlayVisible(context, true);
    }

    public static void markOverlayHidden(Context context) {
        BlockingRepository.setOverlayVisible(context, false);
    }

    public static String resolveForegroundPackage(Context context) {
        if (context == null) {
            return "";
        }

        String cachedPackage = BlockingRepository.getForegroundPackage(context);
        long lastHeartbeat = BlockingRepository.getAccessibilityHeartbeatAt(context);
        if (!TextUtils.isEmpty(cachedPackage) && System.currentTimeMillis() - lastHeartbeat < FOREGROUND_STALE_WINDOW_MS) {
            return cachedPackage;
        }

        UsageStatsManager usageStatsManager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) {
            return cachedPackage == null ? "" : cachedPackage;
        }

        long endTime = System.currentTimeMillis();
        long startTime = endTime - FOREGROUND_STALE_WINDOW_MS;
        UsageEvents events = usageStatsManager.queryEvents(startTime, endTime);
        UsageEvents.Event event = new UsageEvents.Event();
        String latestPackage = cachedPackage;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int eventType = event.getEventType();
            if (eventType == UsageEvents.Event.MOVE_TO_FOREGROUND || eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                String packageName = event.getPackageName();
                if (!TextUtils.isEmpty(packageName) && !packageName.equals(context.getPackageName())) {
                    latestPackage = packageName;
                }
            }
        }

        return latestPackage == null ? "" : latestPackage;
    }

    public static String resolveAppName(Context context, String packageName) {
        if (context == null || TextUtils.isEmpty(packageName)) {
            return "This app";
        }

        try {
            JSONArray apps = new JSONArray(BlockingRepository.getSchedule(context).blockedAppsJson == null ? "[]" : BlockingRepository.getSchedule(context).blockedAppsJson);
            for (int index = 0; index < apps.length(); index += 1) {
                JSONObject app = apps.optJSONObject(index);
                if (app != null && packageName.equals(app.optString("packageName"))) {
                    String appName = app.optString("appName", packageName);
                    return TextUtils.isEmpty(appName) ? packageName : appName;
                }
            }
        } catch (JSONException error) {
            Log.e(TAG, "Failed to resolve app name", error);
        }

        try {
            return context.getPackageManager().getApplicationLabel(
                context.getPackageManager().getApplicationInfo(packageName, 0)
            ).toString();
        } catch (Exception error) {
            return packageName;
        }
    }

    public static void launchBlockScreen(Context context, String packageName, String reason) {
        if (context == null) {
            return;
        }

        long remainingMillis = getRemainingBlockMillis(context);
        if (isOverlayPermissionGranted(context)) {
            boolean overlayShown = BlockOverlayManager.getInstance(context).showOverlay(
                packageName,
                resolveAppName(context, packageName),
                reason,
                remainingMillis
            );
            if (overlayShown) {
                markOverlayShown(context, packageName);
                return;
            }
        }

        Intent intent = new Intent(context, BlockScreenActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
        );
        intent.putExtra("packageName", packageName);
        intent.putExtra("appName", resolveAppName(context, packageName));
        intent.putExtra("reason", reason);
        context.startActivity(intent);
    }

    public static void maybeBlockForegroundPackage(Context context, String packageName, String source) {
        if (context == null || TextUtils.isEmpty(packageName)) {
            return;
        }

        if (shouldBlockPackage(context, packageName)) {
            launchBlockScreen(context, packageName, source);
        } else if (BlockingRepository.isOverlayVisible(context)) {
            BlockOverlayManager.getInstance(context).refreshOverlay();
        }
    }

    public static boolean isAccessibilityServiceEnabled(Context context) {
        if (context == null) {
            return false;
        }

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

    public static boolean isWithinBlockedWindow(Context context) {
        if (context == null) {
            return false;
        }

        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        if (!schedule.enabled) {
            return false;
        }

        Calendar now = Calendar.getInstance();
        int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int startMinutes = schedule.blockHour * 60 + schedule.blockMinute;
        int endMinutes = BlockingRepository.getBlockEndHour(context) * 60 + BlockingRepository.getBlockEndMinute(context);

        if (!hasCustomEndWindow(context)) {
            return currentMinutes >= startMinutes;
        }

        if (startMinutes <= endMinutes) {
            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        }

        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    public static long getRemainingBlockMillis(Context context) {
        if (context == null) {
            return 0L;
        }

        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        Calendar now = Calendar.getInstance();
        int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int startMinutes = schedule.blockHour * 60 + schedule.blockMinute;
        int endMinutes = BlockingRepository.getBlockEndHour(context) * 60 + BlockingRepository.getBlockEndMinute(context);

        if (!isWithinBlockedWindow(context)) {
            return Math.max(0L, nextStartTimeMillis(schedule.blockHour, schedule.blockMinute, currentMinutes) - System.currentTimeMillis());
        }

        if (!hasCustomEndWindow(context)) {
            Calendar midnight = Calendar.getInstance();
            midnight.add(Calendar.DAY_OF_YEAR, 1);
            midnight.set(Calendar.HOUR_OF_DAY, 0);
            midnight.set(Calendar.MINUTE, 0);
            midnight.set(Calendar.SECOND, 0);
            midnight.set(Calendar.MILLISECOND, 0);
            return Math.max(0L, midnight.getTimeInMillis() - System.currentTimeMillis());
        }

        return Math.max(0L, nextEndTimeMillis(schedule.blockHour, schedule.blockMinute, endMinutes) - System.currentTimeMillis());
    }

    public static String getCountdownLabel(Context context) {
        long millis = getRemainingBlockMillis(context);
        long seconds = Math.max(0L, millis / 1000L);
        long hours = seconds / 3600L;
        long minutes = (seconds % 3600L) / 60L;
        long remainingSeconds = seconds % 60L;
        return String.format("Unlocks in %02d:%02d:%02d", hours, minutes, remainingSeconds);
    }

    public static String getBlockWindowLabel(Context context) {
        return BlockingRepository.getBlockWindowLabel(context);
    }

    private static boolean hasCustomEndWindow(Context context) {
        return BlockingRepository.getBlockEndHour(context) != BlockingRepository.getBlockHour(context)
            || BlockingRepository.getBlockEndMinute(context) != BlockingRepository.getBlockMinute(context);
    }

    private static boolean hasActiveApps(String rawApps) {
        try {
            JSONArray apps = new JSONArray(rawApps == null ? "[]" : rawApps);
            for (int index = 0; index < apps.length(); index += 1) {
                JSONObject app = apps.optJSONObject(index);
                if (app != null && app.optBoolean("isActive", false)) {
                    return true;
                }
            }
        } catch (JSONException error) {
            Log.e(TAG, "Failed to parse blocked apps", error);
        }
        return false;
    }

    private static long nextTransitionTime(Context context) {
        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        Calendar now = Calendar.getInstance();
        int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

        if (isWithinBlockedWindow(context) && hasCustomEndWindow(context)) {
            int endMinutes = BlockingRepository.getBlockEndHour(context) * 60 + BlockingRepository.getBlockEndMinute(context);
            return nextEndTimeMillis(schedule.blockHour, schedule.blockMinute, endMinutes);
        }

        return nextStartTimeMillis(schedule.blockHour, schedule.blockMinute, currentMinutes);
    }

    private static long nextStartTimeMillis(int hour, int minute, int currentMinutes) {
        Calendar trigger = Calendar.getInstance();
        trigger.set(Calendar.HOUR_OF_DAY, hour);
        trigger.set(Calendar.MINUTE, minute);
        trigger.set(Calendar.SECOND, 0);
        trigger.set(Calendar.MILLISECOND, 0);
        if (currentMinutes >= hour * 60 + minute) {
            trigger.add(Calendar.DAY_OF_YEAR, 1);
        }
        return trigger.getTimeInMillis();
    }

    private static long nextEndTimeMillis(int startHour, int startMinute, int endMinutes) {
        Calendar trigger = Calendar.getInstance();
        trigger.set(Calendar.HOUR_OF_DAY, endMinutes / 60);
        trigger.set(Calendar.MINUTE, endMinutes % 60);
        trigger.set(Calendar.SECOND, 0);
        trigger.set(Calendar.MILLISECOND, 0);

        int currentMinutes = Calendar.getInstance().get(Calendar.HOUR_OF_DAY) * 60 + Calendar.getInstance().get(Calendar.MINUTE);
        int startMinutes = startHour * 60 + startMinute;
        if (endMinutes <= startMinutes && currentMinutes >= startMinutes) {
            trigger.add(Calendar.DAY_OF_YEAR, 1);
        }
        return trigger.getTimeInMillis();
    }
}
