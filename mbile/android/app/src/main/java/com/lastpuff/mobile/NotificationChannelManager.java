package com.lastpuff.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Notification;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

/**
 * Manages notification channels for Last Puff.
 * Creates dedicated channels for different notification types with appropriate importance levels.
 */
public class NotificationChannelManager {
    // Channel IDs
    public static final String CHANNEL_PROTECTION_STATUS = "last_puff_protection_status";
    public static final String CHANNEL_REMINDERS = "last_puff_reminders";
    public static final String CHANNEL_QUIT_JOURNEY = "last_puff_quit_journey";
    public static final String CHANNEL_ACHIEVEMENTS = "last_puff_achievements";
    public static final String CHANNEL_CRAVING_PROTECTION = "last_puff_craving_protection";
    public static final String CHANNEL_FOCUS_SESSIONS = "last_puff_focus_sessions";

    /**
     * Create all notification channels.
     * Only runs on Android 8.0 (API 26) and above.
     */
    public static void createAllChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager == null) {
            return;
        }

        // Low priority background channel for protection status
        createProtectionStatusChannel(context, notificationManager);

        // High priority channels for user-facing events
        createRemindersChannel(context, notificationManager);
        createQuitJourneyChannel(context, notificationManager);
        createAchievementsChannel(context, notificationManager);
        createCravingProtectionChannel(context, notificationManager);
        createFocusSessionsChannel(context, notificationManager);
    }

    /**
     * Protection Status Channel (LOW priority)
     * Used for background service status notifications
     */
    private static void createProtectionStatusChannel(Context context, NotificationManager manager) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_PROTECTION_STATUS,
            "Protection Status",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Background service status and monitoring updates");
        channel.enableLights(false);
        channel.enableVibration(false);
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    /**
     * Reminders Channel (HIGH priority)
     * Used for: Log Cigarette reminders
     */
    private static void createRemindersChannel(Context context, NotificationManager manager) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_REMINDERS,
            "Last Puff Reminders",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Reminders to log cigarettes and check in on your progress");
        configureHighPriorityChannel(channel);
        manager.createNotificationChannel(channel);
    }

    /**
     * Quit Journey Channel (HIGH priority)
     * Used for: Quit Attempt reminders, Streak Achieved notifications
     */
    private static void createQuitJourneyChannel(Context context, NotificationManager manager) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_QUIT_JOURNEY,
            "Quit Journey",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Important updates about your quit journey and streaks");
        configureHighPriorityChannel(channel);
        manager.createNotificationChannel(channel);
    }

    /**
     * Achievements & Levels Channel (HIGH priority)
     * Used for: Level Upgrades, Milestone Reached, Achievements unlocked
     */
    private static void createAchievementsChannel(Context context, NotificationManager manager) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ACHIEVEMENTS,
            "Achievements & Levels",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Celebrate your progress with level upgrades and achievement unlocks");
        configureHighPriorityChannel(channel);
        manager.createNotificationChannel(channel);
    }

    /**
     * Craving Protection Channel (HIGH priority)
     * Used for: Craving Alerts, Intervention notifications
     */
    private static void createCravingProtectionChannel(Context context, NotificationManager manager) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_CRAVING_PROTECTION,
            "Craving Protection",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alerts and support when cravings are detected");
        configureHighPriorityChannel(channel);
        manager.createNotificationChannel(channel);
    }

    /**
     * Focus Sessions Channel (HIGH priority)
     * Used for: Focus Session start/end, Session completed notifications
     */
    private static void createFocusSessionsChannel(Context context, NotificationManager manager) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_FOCUS_SESSIONS,
            "Focus Sessions",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Updates about your focus sessions and achievements");
        configureHighPriorityChannel(channel);
        manager.createNotificationChannel(channel);
    }

    private static void configureHighPriorityChannel(NotificationChannel channel) {
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 250, 250, 250});
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        Uri sound = Settings.System.DEFAULT_NOTIFICATION_URI;
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(sound, attributes);
    }
}
