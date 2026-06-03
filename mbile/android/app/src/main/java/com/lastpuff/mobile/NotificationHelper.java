package com.lastpuff.mobile;

import android.app.PendingIntent;
import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Helper class for sending important notifications on the appropriate channels.
 * All notifications use PRIORITY_HIGH for heads-up display.
 */
public class NotificationHelper {
    private static final int REQUEST_CODE = 42;

    /**
     * Send a reminder notification (e.g., Log Cigarette reminder)
     */
    public static void sendReminderNotification(Context context, String title, String message) {
        sendHighPriorityNotification(
            context,
            NotificationChannelManager.CHANNEL_REMINDERS,
            title,
            message,
            101
        );
    }

    /**
     * Send a quit journey notification (e.g., Quit Attempt, Streak Achieved)
     */
    public static void sendQuitJourneyNotification(Context context, String title, String message) {
        sendHighPriorityNotification(
            context,
            NotificationChannelManager.CHANNEL_QUIT_JOURNEY,
            title,
            message,
            102
        );
    }

    /**
     * Send an achievement notification (e.g., Level Upgrade, Milestone Reached)
     */
    public static void sendAchievementNotification(Context context, String title, String message) {
        sendHighPriorityNotification(
            context,
            NotificationChannelManager.CHANNEL_ACHIEVEMENTS,
            title,
            message,
            103
        );
    }

    /**
     * Send a craving protection alert (e.g., Craving Alert)
     */
    public static void sendCravingAlert(Context context, String title, String message) {
        sendHighPriorityNotification(
            context,
            NotificationChannelManager.CHANNEL_CRAVING_PROTECTION,
            title,
            message,
            104
        );
    }

    /**
     * Send a focus session notification (e.g., Session started/ended)
     */
    public static void sendFocusSessionNotification(Context context, String title, String message) {
        sendHighPriorityNotification(
            context,
            NotificationChannelManager.CHANNEL_FOCUS_SESSIONS,
            title,
            message,
            105
        );
    }

    /**
     * Generic method to send high-priority notifications
     * Shows heads-up notification, plays sound, vibrates, and shows on lock screen
     */
    private static void sendHighPriorityNotification(
        Context context,
        String channelId,
        String title,
        String message,
        int notificationId
    ) {
        if (!hasNotificationPermission(context)) {
            return;
        }

        NotificationChannelManager.createAllChannels(context);

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            REQUEST_CODE,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher))
            .setContentTitle(title)
            .setContentText(message)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            // High priority settings for heads-up notification
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            // Allow notification to show on lock screen
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // Ensure sound and vibration work
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(new long[]{0, 250, 250, 250});

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        notificationManager.notify(notificationId, builder.build());
    }

    public static boolean hasNotificationPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }
}
