package com.lastpuff.mobile;

import android.content.Context;

import com.lastpuff.mobile.data.BlockingRepository;
import com.lastpuff.mobile.data.BlockingScheduleEntity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ProtectionPreferences {
    private ProtectionPreferences() {
    }

    public static void saveConfig(Context context, JSONArray apps, int blockHour, int blockMinute, String repeatType, boolean enabled) {
        BlockingRepository.saveSchedule(context, apps, blockHour, blockMinute, repeatType, enabled);
    }

    public static JSONArray getBlockedApps(Context context) {
        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        try {
            return new JSONArray(schedule.blockedAppsJson == null ? "[]" : schedule.blockedAppsJson);
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    public static String getBlockTime(Context context) {
        return BlockingRepository.getBlockTimeLabel(context);
    }

    public static void unlockForToday(Context context) {
        BlockingRepository.setUnlockedForToday(context, true);
    }

    public static void relock(Context context) {
        BlockingRepository.setUnlockedForToday(context, false);
    }

    public static boolean isUnlockedForToday(Context context) {
        return BlockingRepository.isUnlockedForToday(context);
    }

    public static boolean isWithinBlockedWindow(Context context) {
        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        int currentMinutes = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY) * 60 + java.util.Calendar.getInstance().get(java.util.Calendar.MINUTE);
        return currentMinutes >= (schedule.blockHour * 60 + schedule.blockMinute);
    }

    public static boolean shouldBlockPackage(Context context, String packageName) {
        return BlockingEngine.shouldBlockPackage(context, packageName);
    }

    public static String getAppName(Context context, String packageName) {
        return BlockingEngine.resolveAppName(context, packageName);
    }

    public static java.util.Map<String, Object> getStatus(Context context) {
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
        result.put("blockHour", schedule.blockHour);
        result.put("blockMinute", schedule.blockMinute);
        result.put("blockTime", BlockingRepository.getBlockTimeLabel(context));
        result.put("blockedAppsCount", getBlockedApps(context).length());
        result.put("withinBlockedWindow", isWithinBlockedWindow(context));
        result.put("unlockedForToday", isUnlockedForToday(context));
        result.put("protectionActive", schedule.protectionActive);
        result.put("monitoringActive", schedule.monitoringActive);
        result.put("scheduleActive", schedule.scheduleActive);
        result.put("batteryOptimizationIgnored", schedule.batteryOptimizationIgnored);
        result.put("nextAlarmAt", schedule.nextAlarmAt);
        result.put("foregroundPackage", schedule.foregroundPackage == null ? "" : schedule.foregroundPackage);
        return result;
    }
}
