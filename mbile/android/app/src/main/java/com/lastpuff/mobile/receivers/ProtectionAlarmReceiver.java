package com.lastpuff.mobile.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.lastpuff.mobile.BlockingEngine;

public class ProtectionAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "BLOCKER";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Alarm triggered");
        BlockingEngine.onAlarmTriggered(context);
    }
}
