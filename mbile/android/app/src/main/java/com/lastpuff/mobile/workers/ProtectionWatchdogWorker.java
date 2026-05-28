package com.lastpuff.mobile.workers;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.lastpuff.mobile.BlockingEngine;
import com.lastpuff.mobile.ProtectionWorkScheduler;

public class ProtectionWatchdogWorker extends Worker {
    private static final String TAG = "BLOCKER";

    public ProtectionWatchdogWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            Log.d(TAG, "Watchdog running");
            BlockingEngine.syncProtection(getApplicationContext());
            ProtectionWorkScheduler.schedule(getApplicationContext());
            return Result.success();
        } catch (Exception error) {
            Log.e(TAG, "Watchdog failed", error);
            return Result.retry();
        }
    }
}
