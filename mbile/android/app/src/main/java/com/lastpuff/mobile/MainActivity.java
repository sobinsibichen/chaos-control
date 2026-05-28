package com.lastpuff.mobile;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

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
    }

    @Override
    public void onResume() {
        Log.d(TAG, "MainActivity resumed");
        super.onResume();
    }

    private void startProtectionService() {
        try {
            Intent serviceIntent = new Intent(this, ProtectionForegroundService.class);
            startForegroundService(serviceIntent);
            Log.d(TAG, "Protection foreground service started from MainActivity");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start protection service from MainActivity", e);
        }
    }
}
