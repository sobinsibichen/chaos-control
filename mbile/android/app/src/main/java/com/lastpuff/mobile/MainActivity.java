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
        ProtectionWorkScheduler.schedule(this);
    }

    @Override
    public void onResume() {
        Log.d(TAG, "MainActivity resumed");
        super.onResume();
    }

}
