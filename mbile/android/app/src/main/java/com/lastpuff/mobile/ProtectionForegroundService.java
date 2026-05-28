package com.lastpuff.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps app protection running even when the main app is minimized or closed.
 * Shows a persistent notification to maintain service priority.
 */
public class ProtectionForegroundService extends Service {
    private static final String TAG = "LASTPUFF_PROTECTION";
    private static final int NOTIFICATION_ID = 1;
    private static final String NOTIFICATION_CHANNEL_ID = "lastpuff_protection";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "ProtectionForegroundService started");

        // Create notification channel for Android 8+
        createNotificationChannel();

        // Build persistent notification
        Notification notification = buildNotification();

        // Start foreground service with notification
        startForeground(NOTIFICATION_ID, notification);

        // Return sticky so service restarts if killed
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "ProtectionForegroundService destroyed");
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Last Puff Protection",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Monitoring protected apps");
            channel.enableLights(false);
            channel.enableVibration(false);
            channel.setSound(null, null);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created");
            }
        }
    }

    private Notification buildNotification() {
        try {
            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, mainIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            String blockTime = ProtectionPreferences.getBlockTime(this);
            int blockedCount = ProtectionPreferences.getBlockedApps(this).length();
            String status = "Protected";
            if (ProtectionPreferences.isUnlockedForToday(this)) {
                status = "Unlocked";
            } else if (!ProtectionPreferences.isWithinBlockedWindow(this)) {
                status = "Waiting";
            }

            return new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setContentTitle("Last Puff Protection Active")
                .setContentText("Block time: " + blockTime + " • " + blockedCount + " apps • " + status)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVibrate(new long[]{0})
                .build();
        } catch (Exception e) {
            Log.e(TAG, "Error building notification", e);
            return new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setContentTitle("Last Puff Protection")
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setOngoing(true)
                .build();
        }
    }
}
