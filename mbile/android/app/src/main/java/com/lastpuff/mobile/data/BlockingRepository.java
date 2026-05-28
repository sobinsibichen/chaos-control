package com.lastpuff.mobile.data;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.room.Room;

import org.json.JSONArray;

public final class BlockingRepository {
    private static final String PREFS_NAME = "last_puff_protection";
    private static final String KEY_BLOCK_HOUR = "block_hour";
    private static final String KEY_BLOCK_MINUTE = "block_minute";
    private static final String KEY_BLOCK_END_HOUR = "block_end_hour";
    private static final String KEY_BLOCK_END_MINUTE = "block_end_minute";
    private static final String KEY_BLOCKED_APPS_JSON = "blocked_apps_json";
    private static final String KEY_REPEAT_TYPE = "repeat_type";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_UNLOCKED_FOR_DATE = "unlocked_for_date";
    private static final String KEY_PROTECTION_ACTIVE = "protection_active";
    private static final String KEY_MONITORING_ACTIVE = "monitoring_active";
    private static final String KEY_SCHEDULE_ACTIVE = "schedule_active";
    private static final String KEY_BATTERY_OPTIMIZATION_IGNORED = "battery_optimization_ignored";
    private static final String KEY_NEXT_ALARM_AT = "next_alarm_at";
    private static final String KEY_LAST_HEARTBEAT_AT = "last_heartbeat_at";
    private static final String KEY_ACCESSIBILITY_HEARTBEAT_AT = "accessibility_heartbeat_at";
    private static final String KEY_FOREGROUND_PACKAGE = "foreground_package";
    private static final String KEY_SERVICE_RUNNING = "service_running";
    private static final String KEY_LAST_BLOCKED_PACKAGE = "last_blocked_package";
    private static final String KEY_LAST_OVERLAY_TRIGGER_AT = "last_overlay_trigger_at";
    private static final String KEY_OVERLAY_VISIBLE = "overlay_visible";
    private static volatile BlockingDatabase database;

    private BlockingRepository() {
    }

    public static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static BlockingDatabase database(Context context) {
        if (database == null) {
            synchronized (BlockingRepository.class) {
                if (database == null) {
                    database = Room.databaseBuilder(
                        context.getApplicationContext(),
                        BlockingDatabase.class,
                        "last_puff_blocking"
                    ).allowMainThreadQueries().build();
                }
            }
        }

        return database;
    }

    public static BlockingScheduleEntity getSchedule(Context context) {
        BlockingScheduleEntity schedule = database(context).blockingScheduleDao().getSchedule();
        if (schedule == null) {
            schedule = new BlockingScheduleEntity();
            schedule.repeatType = "daily";
            schedule.blockHour = getBlockHour(context);
            schedule.blockMinute = getBlockMinute(context);
            schedule.blockedAppsJson = prefs(context).getString(KEY_BLOCKED_APPS_JSON, "[]");
            schedule.enabled = prefs(context).getBoolean(KEY_ENABLED, false);
            schedule.protectionActive = prefs(context).getBoolean(KEY_PROTECTION_ACTIVE, false);
            schedule.monitoringActive = prefs(context).getBoolean(KEY_MONITORING_ACTIVE, false);
            schedule.scheduleActive = prefs(context).getBoolean(KEY_SCHEDULE_ACTIVE, false);
            schedule.batteryOptimizationIgnored = prefs(context).getBoolean(KEY_BATTERY_OPTIMIZATION_IGNORED, false);
            schedule.unlockedForToday = isUnlockedForToday(context);
            schedule.nextAlarmAt = prefs(context).getLong(KEY_NEXT_ALARM_AT, 0L);
            schedule.lastHeartbeatAt = prefs(context).getLong(KEY_LAST_HEARTBEAT_AT, 0L);
            schedule.accessibilityHeartbeatAt = prefs(context).getLong(KEY_ACCESSIBILITY_HEARTBEAT_AT, 0L);
            schedule.foregroundPackage = prefs(context).getString(KEY_FOREGROUND_PACKAGE, "");
            schedule.updatedAt = System.currentTimeMillis();
            database(context).blockingScheduleDao().upsert(schedule);
        }

        return schedule;
    }

    public static void saveSchedule(Context context, JSONArray apps, int blockHour, int blockMinute, String repeatType, boolean enabled) {
        saveSchedule(context, apps, blockHour, blockMinute, blockHour, blockMinute, repeatType, enabled);
    }

    public static void saveSchedule(Context context, JSONArray apps, int blockHour, int blockMinute, int blockEndHour, int blockEndMinute, String repeatType, boolean enabled) {
        BlockingScheduleEntity schedule = getSchedule(context);
        schedule.blockHour = blockHour;
        schedule.blockMinute = blockMinute;
        schedule.repeatType = repeatType == null || repeatType.isEmpty() ? "daily" : repeatType;
        schedule.enabled = enabled;
        schedule.protectionActive = enabled;
        schedule.monitoringActive = prefs(context).getBoolean(KEY_MONITORING_ACTIVE, false);
        schedule.scheduleActive = enabled && apps != null && apps.length() > 0;
        schedule.blockedAppsJson = apps != null ? apps.toString() : "[]";
        schedule.updatedAt = System.currentTimeMillis();

        database(context).blockingScheduleDao().upsert(schedule);

        prefs(context)
            .edit()
            .putInt(KEY_BLOCK_HOUR, blockHour)
            .putInt(KEY_BLOCK_MINUTE, blockMinute)
            .putInt(KEY_BLOCK_END_HOUR, blockEndHour)
            .putInt(KEY_BLOCK_END_MINUTE, blockEndMinute)
            .putString(KEY_BLOCKED_APPS_JSON, schedule.blockedAppsJson)
            .putString(KEY_REPEAT_TYPE, schedule.repeatType)
            .putBoolean(KEY_ENABLED, enabled)
            .putBoolean(KEY_PROTECTION_ACTIVE, schedule.protectionActive)
            .putBoolean(KEY_SCHEDULE_ACTIVE, schedule.scheduleActive)
            .putLong(KEY_LAST_HEARTBEAT_AT, schedule.lastHeartbeatAt)
            .putLong(KEY_ACCESSIBILITY_HEARTBEAT_AT, schedule.accessibilityHeartbeatAt)
            .putLong(KEY_NEXT_ALARM_AT, schedule.nextAlarmAt)
            .putString(KEY_FOREGROUND_PACKAGE, schedule.foregroundPackage)
            .apply();
    }

    public static void setUnlockedForToday(Context context, boolean unlocked) {
        long now = System.currentTimeMillis();
        prefs(context)
            .edit()
            .putString(KEY_UNLOCKED_FOR_DATE, unlocked ? todayToken() : "")
            .apply();
        database(context).blockingScheduleDao().updateUnlockState(unlocked, now);
    }

    public static void setMonitoringState(Context context, boolean active, String foregroundPackage) {
        long now = active ? System.currentTimeMillis() : 0L;
        prefs(context)
            .edit()
            .putBoolean(KEY_MONITORING_ACTIVE, active)
            .putLong(KEY_LAST_HEARTBEAT_AT, now)
            .putString(KEY_FOREGROUND_PACKAGE, foregroundPackage == null ? "" : foregroundPackage)
            .putBoolean(KEY_SERVICE_RUNNING, active)
            .apply();
    }

    public static void setAccessibilityState(Context context, boolean active) {
        long now = active ? System.currentTimeMillis() : 0L;
        prefs(context)
            .edit()
            .putLong(KEY_ACCESSIBILITY_HEARTBEAT_AT, now)
            .apply();
    }

    public static void setServiceRunning(Context context, boolean running) {
        prefs(context)
            .edit()
            .putBoolean(KEY_SERVICE_RUNNING, running)
            .apply();
    }

    public static void setForegroundPackage(Context context, String foregroundPackage) {
        String safePackage = foregroundPackage == null ? "" : foregroundPackage;
        prefs(context)
            .edit()
            .putString(KEY_FOREGROUND_PACKAGE, safePackage)
            .apply();
    }

    public static void setOverlayVisible(Context context, boolean visible) {
        prefs(context)
            .edit()
            .putBoolean(KEY_OVERLAY_VISIBLE, visible)
            .apply();
    }

    public static void setLastBlockedPackage(Context context, String packageName) {
        prefs(context)
            .edit()
            .putString(KEY_LAST_BLOCKED_PACKAGE, packageName == null ? "" : packageName)
            .apply();
    }

    public static void setLastOverlayTriggerAt(Context context, long timestamp) {
        prefs(context)
            .edit()
            .putLong(KEY_LAST_OVERLAY_TRIGGER_AT, timestamp)
            .apply();
    }

    public static void setAlarmState(Context context, long nextAlarmAt, boolean active) {
        long now = System.currentTimeMillis();
        prefs(context)
            .edit()
            .putLong(KEY_NEXT_ALARM_AT, nextAlarmAt)
            .putBoolean(KEY_SCHEDULE_ACTIVE, active)
            .apply();
        database(context).blockingScheduleDao().updateAlarmState(nextAlarmAt, active, now);
    }

    public static void setBatteryOptimizationIgnored(Context context, boolean ignored) {
        prefs(context)
            .edit()
            .putBoolean(KEY_BATTERY_OPTIMIZATION_IGNORED, ignored)
            .apply();
        BlockingScheduleEntity schedule = getSchedule(context);
        schedule.batteryOptimizationIgnored = ignored;
        schedule.updatedAt = System.currentTimeMillis();
        database(context).blockingScheduleDao().upsert(schedule);
    }

    public static int getBlockHour(Context context) {
        return prefs(context).getInt(KEY_BLOCK_HOUR, 22);
    }

    public static int getBlockMinute(Context context) {
        return prefs(context).getInt(KEY_BLOCK_MINUTE, 0);
    }

    public static int getBlockEndHour(Context context) {
        return prefs(context).getInt(KEY_BLOCK_END_HOUR, getBlockHour(context));
    }

    public static int getBlockEndMinute(Context context) {
        return prefs(context).getInt(KEY_BLOCK_END_MINUTE, getBlockMinute(context));
    }

    public static String getBlockTimeLabel(Context context) {
        return formatTime(getBlockHour(context), getBlockMinute(context));
    }

    public static String getBlockWindowLabel(Context context) {
        return getBlockTimeLabel(context) + " - " + formatTime(getBlockEndHour(context), getBlockEndMinute(context));
    }

    public static boolean isUnlockedForToday(Context context) {
        return todayToken().equals(prefs(context).getString(KEY_UNLOCKED_FOR_DATE, ""));
    }

    public static boolean isBatteryOptimizationIgnored(Context context) {
        return prefs(context).getBoolean(KEY_BATTERY_OPTIMIZATION_IGNORED, false);
    }

    public static long getNextAlarmAt(Context context) {
        return prefs(context).getLong(KEY_NEXT_ALARM_AT, 0L);
    }

    public static long getLastHeartbeatAt(Context context) {
        return prefs(context).getLong(KEY_LAST_HEARTBEAT_AT, 0L);
    }

    public static long getAccessibilityHeartbeatAt(Context context) {
        return prefs(context).getLong(KEY_ACCESSIBILITY_HEARTBEAT_AT, 0L);
    }

    public static String getForegroundPackage(Context context) {
        return prefs(context).getString(KEY_FOREGROUND_PACKAGE, "");
    }

    public static boolean isServiceRunning(Context context) {
        return prefs(context).getBoolean(KEY_SERVICE_RUNNING, false);
    }

    public static boolean isOverlayVisible(Context context) {
        return prefs(context).getBoolean(KEY_OVERLAY_VISIBLE, false);
    }

    public static String getLastBlockedPackage(Context context) {
        return prefs(context).getString(KEY_LAST_BLOCKED_PACKAGE, "");
    }

    public static long getLastOverlayTriggerAt(Context context) {
        return prefs(context).getLong(KEY_LAST_OVERLAY_TRIGGER_AT, 0L);
    }

    public static String formatTime(int hour, int minute) {
        return String.format("%02d:%02d", hour, minute);
    }

    private static String todayToken() {
        java.text.SimpleDateFormat formatter = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
        return formatter.format(new java.util.Date());
    }
}
