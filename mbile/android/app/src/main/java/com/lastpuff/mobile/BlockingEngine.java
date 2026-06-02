package com.lastpuff.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public final class BlockingEngine {
    private static final String TAG = "BLOCKER";
    private static final long ACCESSIBILITY_HEARTBEAT_WINDOW_MS = 15_000L;
    private static final long MONITOR_HEARTBEAT_WINDOW_MS = 20_000L;
    private static final long FOREGROUND_STALE_WINDOW_MS = 5_000L;
    private static final long SCHEDULE_CACHE_TTL_MS = 1_000L;
    private static volatile String cachedBlockedAppsJson = "";
    private static volatile Set<String> cachedActivePackages = new HashSet<>();
    private static volatile Map<String, String> cachedPackageNames = new HashMap<>();
    private static volatile CachedSchedule cachedSchedule;

    private BlockingEngine() {
    }

    public static boolean shouldBlockPackage(Context context, String packageName) {
        long startedAt = SystemClock.elapsedRealtimeNanos();
        boolean result = false;
        if (context == null || TextUtils.isEmpty(packageName)) {
            return false;
        }

        String ownPackage = context.getPackageName();
        if (ownPackage.equals(packageName)) {
            return false;
        }

        if (!hasRequiredBlockingPermissions(context)) {
            Log.w(TAG, "Blocking skipped until required permissions are granted");
            return false;
        }

        CachedSchedule schedule = getCachedSchedule(context);
        if (!schedule.enabled || schedule.unlockedForToday) {
            return false;
        }

        if (!isWithinBlockedWindow(schedule)) {
            return false;
        }

        result = schedule.activePackages.contains(packageName);
        long durationMicros = (SystemClock.elapsedRealtimeNanos() - startedAt) / 1000L;
        if (durationMicros > 50_000L) {
            Log.w(TAG, "perf should_block package=" + packageName + " result=" + result + " durationMicros=" + durationMicros);
        } else {
            Log.d(TAG, "perf should_block package=" + packageName + " result=" + result + " durationMicros=" + durationMicros);
        }
        return result;
    }

    public static boolean isProtectionScheduleActive(Context context) {
        if (context == null) {
            return false;
        }

        CachedSchedule schedule = getCachedSchedule(context);
        return schedule.enabled && !schedule.activePackages.isEmpty();
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

    public static boolean isRestrictedSettingsAllowed(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true;
        }

        if (isAccessibilityServiceEnabled(context)) {
            return true;
        }

        AccessibilityManager accessibilityManager = (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (accessibilityManager == null) {
            return false;
        }

        String expected = new ComponentName(context, com.lastpuff.mobile.services.BlockAccessibilityService.class).flattenToString();
        for (android.accessibilityservice.AccessibilityServiceInfo serviceInfo : accessibilityManager.getInstalledAccessibilityServiceList()) {
            if (serviceInfo == null || serviceInfo.getResolveInfo() == null || serviceInfo.getResolveInfo().serviceInfo == null) {
                continue;
            }

            android.content.pm.ServiceInfo info = serviceInfo.getResolveInfo().serviceInfo;
            String serviceName = new ComponentName(info.packageName, info.name).flattenToString();
            if (expected.equalsIgnoreCase(serviceName)) {
                return true;
            }
        }

        return false;
    }

    public static boolean hasRequiredBlockingPermissions(Context context) {
        return isUsageAccessGranted(context)
            && isRestrictedSettingsAllowed(context)
            && isAccessibilityServiceEnabled(context)
            && isOverlayPermissionGranted(context);
    }

    public static void syncProtection(Context context) {
        if (hasRequiredBlockingPermissions(context)) {
            startMonitoringService(context);
        } else {
            Log.w(TAG, "Protection monitor not started until required permissions are granted");
            BlockingRepository.setServiceRunning(context, false);
            BlockingRepository.setMonitoringState(context, false, "");
        }
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
            String cachedName = getCachedSchedule(context).packageNames.get(packageName);
            if (!TextUtils.isEmpty(cachedName)) {
                return cachedName;
            }
        } catch (Exception error) {
            Log.e(TAG, "Failed to resolve cached app name", error);
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

        if (!hasRequiredBlockingPermissions(context)) {
            Log.w(TAG, "Block screen skipped until required permissions are granted");
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

        CachedSchedule schedule = getCachedSchedule(context);
        if (!schedule.enabled) {
            return false;
        }

        return isWithinBlockedWindow(schedule);
    }

    public static long getRemainingBlockMillis(Context context) {
        if (context == null) {
            return 0L;
        }

        CachedSchedule schedule = getCachedSchedule(context);
        Calendar now = Calendar.getInstance();
        int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int startMinutes = schedule.blockHour * 60 + schedule.blockMinute;
        int endMinutes = schedule.blockEndHour * 60 + schedule.blockEndMinute;

        if (!isWithinBlockedWindow(schedule)) {
            return Math.max(0L, nextStartTimeMillis(schedule.blockHour, schedule.blockMinute, currentMinutes) - System.currentTimeMillis());
        }

        if (!hasCustomEndWindow(schedule)) {
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

    private static boolean hasCustomEndWindow(CachedSchedule schedule) {
        return schedule.blockEndHour != schedule.blockHour || schedule.blockEndMinute != schedule.blockMinute;
    }

    private static boolean hasActiveApps(String rawApps) {
        return !getActiveBlockedPackages(rawApps).isEmpty();
    }

    private static CachedSchedule getCachedSchedule(Context context) {
        long now = System.currentTimeMillis();
        CachedSchedule current = cachedSchedule;
        if (current != null && now - current.loadedAt < SCHEDULE_CACHE_TTL_MS) {
            return current;
        }

        synchronized (BlockingEngine.class) {
            current = cachedSchedule;
            if (current != null && now - current.loadedAt < SCHEDULE_CACHE_TTL_MS) {
                return current;
            }

            BlockingScheduleEntity schedule = BlockingRepository.getSchedule(context);
            String rawApps = schedule.blockedAppsJson == null ? "[]" : schedule.blockedAppsJson;
            Set<String> packages = getActiveBlockedPackages(rawApps);
            Map<String, String> names = cachedPackageNames;
            cachedSchedule = new CachedSchedule(
                now,
                schedule.enabled,
                BlockingRepository.isUnlockedForToday(context),
                schedule.blockHour,
                schedule.blockMinute,
                BlockingRepository.getBlockEndHour(context),
                BlockingRepository.getBlockEndMinute(context),
                rawApps,
                packages,
                names
            );
            return cachedSchedule;
        }
    }

    private static boolean isWithinBlockedWindow(CachedSchedule schedule) {
        Calendar now = Calendar.getInstance();
        int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int startMinutes = schedule.blockHour * 60 + schedule.blockMinute;
        int endMinutes = schedule.blockEndHour * 60 + schedule.blockEndMinute;

        if (!hasCustomEndWindow(schedule)) {
            return currentMinutes >= startMinutes;
        }

        if (startMinutes <= endMinutes) {
            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        }

        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    private static Set<String> getActiveBlockedPackages(String rawApps) {
        String safeRawApps = rawApps == null ? "[]" : rawApps;
        if (safeRawApps.equals(cachedBlockedAppsJson)) {
            return cachedActivePackages;
        }

        synchronized (BlockingEngine.class) {
            if (safeRawApps.equals(cachedBlockedAppsJson)) {
                return cachedActivePackages;
            }

            Set<String> activePackages = new HashSet<>();
            Map<String, String> packageNames = new HashMap<>();
            try {
                JSONArray apps = new JSONArray(safeRawApps);
                for (int index = 0; index < apps.length(); index += 1) {
                    JSONObject app = apps.optJSONObject(index);
                    if (app == null || !app.optBoolean("isActive", false)) {
                        continue;
                    }

                    String packageName = app.optString("packageName");
                    if (!TextUtils.isEmpty(packageName)) {
                        activePackages.add(packageName);
                        packageNames.put(packageName, app.optString("appName", packageName));
                    }
                }
            } catch (JSONException error) {
                Log.e(TAG, "Failed to parse blocked apps", error);
            }

            cachedBlockedAppsJson = safeRawApps;
            cachedActivePackages = activePackages;
            cachedPackageNames = packageNames;
            return cachedActivePackages;
        }
    }

    private static long nextTransitionTime(Context context) {
        CachedSchedule schedule = getCachedSchedule(context);
        Calendar now = Calendar.getInstance();
        int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

        if (isWithinBlockedWindow(schedule) && hasCustomEndWindow(schedule)) {
            int endMinutes = schedule.blockEndHour * 60 + schedule.blockEndMinute;
            return nextEndTimeMillis(schedule.blockHour, schedule.blockMinute, endMinutes);
        }

        return nextStartTimeMillis(schedule.blockHour, schedule.blockMinute, currentMinutes);
    }

    private static final class CachedSchedule {
        final long loadedAt;
        final boolean enabled;
        final boolean unlockedForToday;
        final int blockHour;
        final int blockMinute;
        final int blockEndHour;
        final int blockEndMinute;
        final String blockedAppsJson;
        final Set<String> activePackages;
        final Map<String, String> packageNames;

        CachedSchedule(
            long loadedAt,
            boolean enabled,
            boolean unlockedForToday,
            int blockHour,
            int blockMinute,
            int blockEndHour,
            int blockEndMinute,
            String blockedAppsJson,
            Set<String> activePackages,
            Map<String, String> packageNames
        ) {
            this.loadedAt = loadedAt;
            this.enabled = enabled;
            this.unlockedForToday = unlockedForToday;
            this.blockHour = blockHour;
            this.blockMinute = blockMinute;
            this.blockEndHour = blockEndHour;
            this.blockEndMinute = blockEndMinute;
            this.blockedAppsJson = blockedAppsJson;
            this.activePackages = activePackages;
            this.packageNames = packageNames;
        }
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
