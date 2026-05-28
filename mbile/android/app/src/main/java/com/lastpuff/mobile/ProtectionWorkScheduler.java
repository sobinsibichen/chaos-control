package com.lastpuff.mobile;

import android.content.Context;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.lastpuff.mobile.workers.ProtectionWatchdogWorker;

import java.util.concurrent.TimeUnit;

public final class ProtectionWorkScheduler {
    private static final String UNIQUE_WORK_NAME = "last_puff_watchdog";

    private ProtectionWorkScheduler() {
    }

    public static void schedule(Context context) {
        PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
            ProtectionWatchdogWorker.class,
            15,
            TimeUnit.MINUTES
        ).build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            workRequest
        );
    }
}
