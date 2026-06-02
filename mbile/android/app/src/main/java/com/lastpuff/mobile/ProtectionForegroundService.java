package com.lastpuff.mobile;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.lastpuff.mobile.data.BlockingRepository;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class ProtectionForegroundService extends Service {
    private static final String TAG = "BLOCKER";
    private static final int NOTIFICATION_ID = 901;
    private static final String CHANNEL_ID = "last_puff_blocking";
    private static final long LOOP_INTERVAL_MS = 400L;
    private static final long BLOCK_DEBOUNCE_MS = 850L;

    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private volatile boolean started;
    private volatile String lastForegroundPackage = "";
    private volatile String lastBlockedPackage = "";
    private volatile long lastBlockedAt = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startInForeground();
        if (!started) {
            started = true;
            executor.scheduleAtFixedRate(this::tick, 0L, LOOP_INTERVAL_MS, TimeUnit.MILLISECONDS);
        }
        BlockingRepository.setServiceRunning(this, true);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        BlockingRepository.setServiceRunning(this, false);
        executor.shutdownNow();
        restartSelf();
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        restartSelf();
    }

    private void tick() {
        try {
            String foregroundPackage = BlockingEngine.resolveForegroundPackage(this);
            if (foregroundPackage == null) {
                foregroundPackage = "";
            }

            lastForegroundPackage = foregroundPackage;
            BlockingEngine.markMonitoringHeartbeat(this, foregroundPackage);
            BlockingRepository.setForegroundPackage(this, foregroundPackage);

            if (BlockingEngine.shouldBlockPackage(this, foregroundPackage)) {
                long now = System.currentTimeMillis();
                if (foregroundPackage.equals(this.lastBlockedPackage) && now - lastBlockedAt < BLOCK_DEBOUNCE_MS) {
                    return;
                }
                BlockingEngine.launchBlockScreen(this, foregroundPackage, "foreground-service");
                this.lastBlockedPackage = foregroundPackage;
                this.lastBlockedAt = now;
            }
        } catch (Exception error) {
            Log.e(TAG, "Monitoring tick failed", error);
        }
    }

    private void startInForeground() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String blockWindow = BlockingEngine.getBlockWindowLabel(this);
        String status = BlockingEngine.isWithinBlockedWindow(this) ? "Blocking active" : "Watching schedule";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Last Puff protection running")
            .setContentText(blockWindow + " • " + status)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.blocking_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.blocking_channel_description));
        channel.enableLights(false);
        channel.enableVibration(false);
        NotificationManager notificationManager = getSystemService(NotificationManager.class);
        if (notificationManager != null) {
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void restartSelf() {
        try {
            Intent restartIntent = new Intent(this, ProtectionForegroundService.class);
            PendingIntent pendingIntent = PendingIntent.getService(
                this,
                901,
                restartIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager alarmManager = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (alarmManager != null) {
                long triggerAt = System.currentTimeMillis() + 1000L;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
                }
            }
        } catch (Exception error) {
            Log.e(TAG, "Unable to restart protection service", error);
        }
    }
}
