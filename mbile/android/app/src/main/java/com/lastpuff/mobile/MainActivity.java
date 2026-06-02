package com.lastpuff.mobile;

import android.Manifest;
import android.os.Bundle;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "LASTPUFF_PROTECTION";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.i(TAG, "MainActivity created");

        registerPlugin(InstalledAppsPlugin.class);
        registerPlugin(ProtectionPlugin.class);
        registerPlugin(VoiceAssistantPlugin.class);

        super.onCreate(savedInstanceState);
        NotificationChannelManager.createAllChannels(this);
        requestNotificationPermissionIfNeeded();
        BlockingEngine.syncProtection(this);
    }

    @Override
    public void onResume() {
        Log.d(TAG, "MainActivity resumed");
        super.onResume();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !NotificationHelper.hasNotificationPermission(this)) {
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                4207
            );
        }
    }
}
