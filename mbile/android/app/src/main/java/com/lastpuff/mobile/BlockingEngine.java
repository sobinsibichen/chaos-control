package com.lastpuff.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
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
import java.util.Locale;

public final class BlockingEngine {
    private static final String TAG = "BLOCKER";
    private static final long ACCESSIBILITY_HEARTBEAT_WINDOW_MS = 15_000L;
    private static final long MONITOR_HEARTBEAT_WINDOW_MS = 20_000L;
    private static final long PACKAGE_DEBOUNCE_MS = 900L;

    private BlockingEngine() {
    }

    public static boolean shouldBlockPackage(Context context, String packageName) {
        if (packageName == null || packageName.isEmpty()) {
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

        if (!isAtOrAfterScheduledTime(schedule.blockHour, schedule.blockMinute)) {
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
                    Log.d(TAG, "Blocked app detected: " + packageName);
                    return true;
                }
            }
        } catch (JSONException error) {
            Log.e(TAG, "Failed to parse blocked apps JSON", error);
        }

        return false;
    }

    public static boolean isProtectionScheduleActive(Context context) {
        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        return schedule.enabled && BlockingRepository.getNextAlarmAt(context) > 0L && !TextUtils.isEmpty(schedule.blockedAppsJson);
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
        return recentHeartbeat;
    }

    public static boolean isExactAlarmScheduled(Context context) {
        return BlockingRepository.getNextAlarmAt(context) > System.currentTimeMillis();
    }

    public static boolean isBatteryOptimizationIgnored(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }

        android.os.PowerManager powerManager = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
        return powerManager != null && powerManager.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    public static void syncProtection(Context context) {
        Log.d(TAG, "Monitoring active");
        startMonitoringService(context);
        scheduleExactAlarm(context);
        BlockingRepository.setBatteryOptimizationIgnored(context, isBatteryOptimizationIgnored(context));
    }

    public static void startMonitoringService(Context context) {
        Intent serviceIntent = new Intent(context, com.lastpuff.mobile.services.AppBlockMonitoringService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
        BlockingRepository.setMonitoringState(context, true, BlockingRepository.getForegroundPackage(context));
    }

    public static void scheduleExactAlarm(Context context) {
        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        if (!schedule.enabled || TextUtils.isEmpty(schedule.blockedAppsJson)) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                Intent alarmIntent = new Intent(context, com.lastpuff.mobile.receivers.ProtectionAlarmReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    1024,
                    alarmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                alarmManager.cancel(pendingIntent);
            }
            BlockingRepository.setAlarmState(context, 0L, false);
            return;
        }

        long triggerAt = nextTriggerTime(schedule.blockHour, schedule.blockMinute);
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            Log.w(TAG, "Exact alarm permission not granted");
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        }

        BlockingRepository.setAlarmState(context, triggerAt, true);
        Log.d(TAG, "Alarm triggered for " + BlockingRepository.getBlockTimeLabel(context) + " at " + triggerAt);
    }

    public static void onAlarmTriggered(Context context) {
        Log.d(TAG, "Alarm triggered");
        startMonitoringService(context);
        scheduleExactAlarm(context);
    }

    public static void markAccessibilityConnected(Context context) {
        BlockingRepository.setAccessibilityState(context, true);
        Log.d(TAG, "Accessibility connected");
    }

    public static void markMonitoringHeartbeat(Context context, String foregroundPackage) {
        BlockingRepository.setMonitoringState(context, true, foregroundPackage);
    }

    public static String resolveForegroundPackage(Context context) {
        String cachedPackage = BlockingRepository.getForegroundPackage(context);
        long lastHeartbeat = BlockingRepository.getAccessibilityHeartbeatAt(context);
        if (!TextUtils.isEmpty(cachedPackage) && System.currentTimeMillis() - lastHeartbeat < ACCESSIBILITY_HEARTBEAT_WINDOW_MS) {
            return cachedPackage;
        }

        UsageStatsManager usageStatsManager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) {
            return cachedPackage;
        }

        long endTime = System.currentTimeMillis();
        long startTime = endTime - 5000L;
        UsageEvents events = usageStatsManager.queryEvents(startTime, endTime);
        UsageEvents.Event event = new UsageEvents.Event();
        String latestPackage = cachedPackage;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int eventType = event.getEventType();
            if (eventType == UsageEvents.Event.MOVE_TO_FOREGROUND || eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                String packageName = event.getPackageName();
                if (packageName != null && !packageName.equals(context.getPackageName())) {
                    latestPackage = packageName;
                }
            }
        }

        return latestPackage == null ? "" : latestPackage;
    }

    public static String resolveAppName(Context context, String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return "This app";
        }

        try {
            JSONArray apps = new JSONArray(BlockingRepository.getSchedule(context).blockedAppsJson == null ? "[]" : BlockingRepository.getSchedule(context).blockedAppsJson);
            for (int index = 0; index < apps.length(); index += 1) {
                JSONObject app = apps.optJSONObject(index);
                if (app == null) {
                    continue;
                }

                if (packageName.equals(app.optString("packageName"))) {
                    return app.optString("appName", packageName);
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
        intent.putExtra("countdownMillis", getCountdownMillis());

        Log.d(TAG, "Launching block screen");
        context.startActivity(intent);
    }

    public static void maybeBlockForegroundPackage(Context context, String packageName, String source) {
        if (packageName == null || packageName.isEmpty()) {
            return;
        }

        Log.d(TAG, "Foreground app: " + packageName);
        if (shouldBlockPackage(context, packageName)) {
            Log.d(TAG, "Blocked app detected");
            launchBlockScreen(context, packageName, source);
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

    public static long getCountdownMillis() {
        Calendar now = Calendar.getInstance();
        Calendar midnight = Calendar.getInstance();
        midnight.add(Calendar.DAY_OF_YEAR, 1);
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        midnight.set(Calendar.MILLISECOND, 0);
        return midnight.getTimeInMillis() - now.getTimeInMillis();
    }

    private static boolean isAtOrAfterScheduledTime(int hour, int minute) {
        Calendar now = Calendar.getInstance();
        int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int scheduledMinutes = hour * 60 + minute;
        return currentMinutes >= scheduledMinutes;
    }

    private static long nextTriggerTime(int hour, int minute) {
        Calendar trigger = Calendar.getInstance();
        trigger.set(Calendar.HOUR_OF_DAY, hour);
        trigger.set(Calendar.MINUTE, minute);
        trigger.set(Calendar.SECOND, 0);
        trigger.set(Calendar.MILLISECOND, 0);
        if (trigger.getTimeInMillis() <= System.currentTimeMillis()) {
            trigger.add(Calendar.DAY_OF_YEAR, 1);
        }
        return trigger.getTimeInMillis();
    }
}
