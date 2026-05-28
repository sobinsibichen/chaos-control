package com.lastpuff.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class ProtectionPreferences {
    private static final String TAG = "LASTPUFF_PROTECTION";
    private static final String PREFS_NAME = "last_puff_protection";
    private static final String KEY_BLOCK_TIME = "block_time";
    private static final String KEY_BLOCKED_APPS_JSON = "blocked_apps_json";
    private static final String KEY_UNLOCKED_FOR_DATE = "unlocked_for_date";

    private ProtectionPreferences() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static void saveConfig(Context context, JSONArray apps, String blockTime) {
        Log.i(TAG, "Saving protection config - Block time: " + blockTime + ", Apps count: " + apps.length());
        prefs(context)
            .edit()
            .putString(KEY_BLOCKED_APPS_JSON, apps.toString())
            .putString(KEY_BLOCK_TIME, blockTime)
            .apply();
        Log.d(TAG, "Config saved successfully");
    }

    public static JSONArray getBlockedApps(Context context) {
        String raw = prefs(context).getString(KEY_BLOCKED_APPS_JSON, "[]");
        try {
            JSONArray apps = new JSONArray(raw);
            Log.d(TAG, "Loaded " + apps.length() + " blocked apps");
            return apps;
        } catch (JSONException error) {
            Log.e(TAG, "Failed to parse blocked apps JSON", error);
            return new JSONArray();
        }
    }

    public static String getBlockTime(Context context) {
        String blockTime = prefs(context).getString(KEY_BLOCK_TIME, "22:00");
        Log.d(TAG, "Block time: " + blockTime);
        return blockTime;
    }

    public static void unlockForToday(Context context) {
        String token = todayToken();
        prefs(context)
            .edit()
            .putString(KEY_UNLOCKED_FOR_DATE, token)
            .apply();
        Log.i(TAG, "Unlocked for today: " + token);
    }

    public static void relock(Context context) {
        prefs(context)
            .edit()
            .remove(KEY_UNLOCKED_FOR_DATE)
            .apply();
        Log.i(TAG, "Relocked apps");
    }

    public static boolean isUnlockedForToday(Context context) {
        String stored = prefs(context).getString(KEY_UNLOCKED_FOR_DATE, null);
        String today = todayToken();
        boolean unlocked = today.equals(stored);
        Log.d(TAG, "Unlock check - Stored: " + stored + ", Today: " + today + ", Unlocked: " + unlocked);
        return unlocked;
    }

    public static boolean isWithinBlockedWindow(Context context) {
        String blockTime = getBlockTime(context);
        String[] pieces = blockTime.split(":");
        if (pieces.length != 2) {
            Log.e(TAG, "Invalid block time format: " + blockTime);
            return false;
        }

        int hour;
        int minute;
        try {
            hour = Integer.parseInt(pieces[0]);
            minute = Integer.parseInt(pieces[1]);
        } catch (NumberFormatException error) {
            Log.e(TAG, "Failed to parse block time: " + blockTime, error);
            return false;
        }

        Date now = new Date();
        SimpleDateFormat hourFormat = new SimpleDateFormat("H", Locale.US);
        SimpleDateFormat minuteFormat = new SimpleDateFormat("m", Locale.US);
        int currentHour = Integer.parseInt(hourFormat.format(now));
        int currentMinute = Integer.parseInt(minuteFormat.format(now));

        int currentTotalMinutes = currentHour * 60 + currentMinute;
        int blockTotalMinutes = hour * 60 + minute;
        boolean withinWindow = currentTotalMinutes >= blockTotalMinutes;
        
        Log.d(TAG, "Window check - Block time: " + blockTime + " (" + blockTotalMinutes + " min), Current: " + 
                   String.format("%02d:%02d", currentHour, currentMinute) + " (" + currentTotalMinutes + " min), Within: " + withinWindow);
        
        return withinWindow;
    }

    public static boolean shouldBlockPackage(Context context, String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            Log.d(TAG, "Null or empty package name");
            return false;
        }

        boolean withinWindow = isWithinBlockedWindow(context);
        boolean unlocked = isUnlockedForToday(context);
        
        if (!withinWindow || unlocked) {
            Log.d(TAG, "No block for " + packageName + " - Within window: " + withinWindow + ", Unlocked: " + unlocked);
            return false;
        }

        JSONArray apps = getBlockedApps(context);
        for (int index = 0; index < apps.length(); index += 1) {
            JSONObject app = apps.optJSONObject(index);
            if (app == null || !app.optBoolean("isActive", false)) {
                continue;
            }

            String appPackage = app.optString("packageName");
            if (packageName.equals(appPackage)) {
                Log.i(TAG, "SHOULD BLOCK: " + packageName + " (matched in blocked list)");
                return true;
            }
        }

        Log.d(TAG, "Not in blocked list: " + packageName);
        return false;
    }

    public static String getAppName(Context context, String packageName) {
        JSONArray apps = getBlockedApps(context);
        for (int index = 0; index < apps.length(); index += 1) {
            JSONObject app = apps.optJSONObject(index);
            if (app == null) {
                continue;
            }

            if (packageName.equals(app.optString("packageName"))) {
                String appName = app.optString("appName", packageName);
                Log.d(TAG, "App name for " + packageName + ": " + appName);
                return appName;
            }
        }

        Log.d(TAG, "App not found, returning package name: " + packageName);
        return packageName;
    }

    public static Map<String, Object> getStatus(Context context) {
        Map<String, Object> result = new HashMap<>();
        result.put("blockTime", getBlockTime(context));
        result.put("blockedAppsCount", getBlockedApps(context).length());
        result.put("withinBlockedWindow", isWithinBlockedWindow(context));
        result.put("unlockedForToday", isUnlockedForToday(context));
        Log.d(TAG, "Status - Apps: " + result.get("blockedAppsCount") + ", Window: " + result.get("withinBlockedWindow") + 
                   ", Unlocked: " + result.get("unlockedForToday"));
        return result;
    }

    private static String todayToken() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }
}
