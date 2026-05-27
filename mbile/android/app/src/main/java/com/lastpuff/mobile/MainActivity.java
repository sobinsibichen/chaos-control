package com.lastpuff.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InstalledAppsPlugin.class);
        registerPlugin(ProtectionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
