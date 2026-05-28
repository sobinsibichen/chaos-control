package com.lastpuff.mobile.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.lastpuff.mobile.BlockingEngine;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BLOCKER";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) {
            return;
        }

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || "android.intent.action.QUICKBOOT_POWERON".equals(action)
            || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Log.d(TAG, "Boot completed");
            BlockingEngine.syncProtection(context);
        }
    }
}
