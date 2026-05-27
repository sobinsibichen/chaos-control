package com.lastpuff.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

public class VoiceAssistantService extends Service {
    public static final String ACTION_START = "com.lastpuff.mobile.voice.START";
    public static final String ACTION_STOP = "com.lastpuff.mobile.voice.STOP";
    public static final String EXTRA_WAKE_WORD = "wakeWord";
    public static final String CHANNEL_ID = "last_puff_voice_assistant";
    public static final int NOTIFICATION_ID = 4107;

    private static boolean running = false;
    private static String wakeWord = "Hey Nova";
    private static String lastCommandAt = null;

    public static boolean isRunning() {
        return running;
    }

    public static String getWakeWord() {
        return wakeWord;
    }

    public static String getLastCommandAt() {
        return lastCommandAt;
    }

    public static void updateLastCommandAt(String timestamp) {
        lastCommandAt = timestamp;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;

        if (ACTION_STOP.equals(action)) {
            running = false;
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null && intent.getStringExtra(EXTRA_WAKE_WORD) != null) {
            wakeWord = intent.getStringExtra(EXTRA_WAKE_WORD);
        }

        running = true;
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Last Puff Nova")
            .setContentText("Listening for " + wakeWord + " in the background")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Nova Voice Assistant",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Keeps Nova awake for background voice commands.");
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
