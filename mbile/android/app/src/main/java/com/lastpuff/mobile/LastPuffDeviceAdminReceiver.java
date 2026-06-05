package com.lastpuff.mobile;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;

public class LastPuffDeviceAdminReceiver extends DeviceAdminReceiver {
    public static final String ACTION_UNINSTALL_CHALLENGE = "com.lastpuff.mobile.UNINSTALL_CHALLENGE";
    public static final String PREFS_NAME = "last_puff_uninstall_protection";
    public static final String KEY_UNINSTALL_CHALLENGE_PENDING = "uninstall_challenge_pending";

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        // Android shows this warning before admin removal; Last Puff also opens the challenge gate.
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_UNINSTALL_CHALLENGE_PENDING, true)
            .apply();

        Intent challengeIntent = new Intent(context, MainActivity.class);
        challengeIntent.setAction(ACTION_UNINSTALL_CHALLENGE);
        challengeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        context.startActivity(challengeIntent);

        return "Complete the Last Puff unlock challenge before disabling uninstall protection.";
    }

    @Override
    public void onEnabled(Context context, Intent intent) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_UNINSTALL_CHALLENGE_PENDING, false)
            .apply();
    }
}
