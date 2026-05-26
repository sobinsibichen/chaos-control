package com.lastpuff.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class ProtectionPreferences {
    private static final String PREFS_NAME = "last_puff_protection";
    private static final String KEY_BLOCK_TIME = "block_time";
    private static final String KEY_BLOCKED_APPS_JSON = "blocked_apps_json";
    private static final String KEY_UNLOCKED_FOR_DATE = "unlocked_for_date";

    private ProtectionPreferences() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static void saveConfig(Context context, JSONArray apps, String blockTime) {
        prefs(context)
            .edit()
            .putString(KEY_BLOCKED_APPS_JSON, apps.toString())
            .putString(KEY_BLOCK_TIME, blockTime)
            .apply();
    }

    public static JSONArray getBlockedApps(Context context) {
        String raw = prefs(context).getString(KEY_BLOCKED_APPS_JSON, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    public static String getBlockTime(Context context) {
        return prefs(context).getString(KEY_BLOCK_TIME, "22:00");
    }

    public static void unlockForToday(Context context) {
        prefs(context)
            .edit()
            .putString(KEY_UNLOCKED_FOR_DATE, todayToken())
            .apply();
    }

    public static void relock(Context context) {
        prefs(context)
            .edit()
            .remove(KEY_UNLOCKED_FOR_DATE)
            .apply();
    }

    public static boolean isUnlockedForToday(Context context) {
        String stored = prefs(context).getString(KEY_UNLOCKED_FOR_DATE, null);
        return todayToken().equals(stored);
    }

    public static boolean isWithinBlockedWindow(Context context) {
        String blockTime = getBlockTime(context);
        String[] pieces = blockTime.split(":");
        if (pieces.length != 2) {
            return false;
        }

        int hour;
        int minute;
        try {
            hour = Integer.parseInt(pieces[0]);
            minute = Integer.parseInt(pieces[1]);
        } catch (NumberFormatException error) {
            return false;
        }

        Date now = new Date();
        SimpleDateFormat hourFormat = new SimpleDateFormat("H", Locale.US);
        SimpleDateFormat minuteFormat = new SimpleDateFormat("m", Locale.US);
        int currentHour = Integer.parseInt(hourFormat.format(now));
        int currentMinute = Integer.parseInt(minuteFormat.format(now));

        return currentHour * 60 + currentMinute >= hour * 60 + minute;
    }

    public static boolean shouldBlockPackage(Context context, String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return false;
        }

        if (!isWithinBlockedWindow(context) || isUnlockedForToday(context)) {
            return false;
        }

        JSONArray apps = getBlockedApps(context);
        for (int index = 0; index < apps.length(); index += 1) {
            JSONObject app = apps.optJSONObject(index);
            if (app == null || !app.optBoolean("isActive", false)) {
                continue;
            }

            if (packageName.equals(app.optString("packageName"))) {
                return true;
            }
        }

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
                return app.optString("appName", packageName);
            }
        }

        return packageName;
    }

    public static Map<String, Object> getStatus(Context context) {
        Map<String, Object> result = new HashMap<>();
        result.put("blockTime", getBlockTime(context));
        result.put("blockedAppsCount", getBlockedApps(context).length());
        result.put("withinBlockedWindow", isWithinBlockedWindow(context));
        result.put("unlockedForToday", isUnlockedForToday(context));
        return result;
    }

    private static String todayToken() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }
}
