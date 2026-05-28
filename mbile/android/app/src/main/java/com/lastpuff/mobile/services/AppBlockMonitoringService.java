package com.lastpuff.mobile.services;

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

import com.lastpuff.mobile.BlockingEngine;
import com.lastpuff.mobile.MainActivity;
import com.lastpuff.mobile.R;
import com.lastpuff.mobile.data.BlockingRepository;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class AppBlockMonitoringService extends Service {
    private static final String TAG = "BLOCKER";
    private static final int NOTIFICATION_ID = 901;
    private static final String CHANNEL_ID = "last_puff_blocking";
    private static final long LOOP_INTERVAL_MS = 350L;
    private static final long BLOCK_DEBOUNCE_MS = 1000L;

    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private volatile boolean started;
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
        Log.d(TAG, "Monitoring active");
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "Monitoring service destroyed");
        executor.shutdownNow();
        BlockingRepository.setMonitoringState(this, false, BlockingRepository.getForegroundPackage(this));
        super.onDestroy();
    }

    private void tick() {
        try {
            String foregroundPackage = BlockingEngine.resolveForegroundPackage(this);
            BlockingEngine.markMonitoringHeartbeat(this, foregroundPackage);
            Log.d(TAG, "Foreground app: " + foregroundPackage);

            if (BlockingEngine.shouldBlockPackage(this, foregroundPackage)) {
                long now = System.currentTimeMillis();
                if (!foregroundPackage.equals(lastBlockedPackage) || now - lastBlockedAt > BLOCK_DEBOUNCE_MS) {
                    lastBlockedPackage = foregroundPackage;
                    lastBlockedAt = now;
                    Log.d(TAG, "Launching block screen");
                    BlockingEngine.launchBlockScreen(this, foregroundPackage, "monitoring");
                }
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
        BlockingRepository.setMonitoringState(this, true, BlockingRepository.getForegroundPackage(this));
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

        BlockingRepository.getSchedule(this);
        String blockTime = BlockingRepository.getBlockTimeLabel(this);
        int blockedCount = 0;
        try {
            blockedCount = new org.json.JSONArray(BlockingRepository.getSchedule(this).blockedAppsJson == null ? "[]" : BlockingRepository.getSchedule(this).blockedAppsJson).length();
        } catch (Exception ignored) {
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Last Puff monitoring")
            .setContentText("Block time " + blockTime + " • " + blockedCount + " apps")
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
}
