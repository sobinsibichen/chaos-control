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
        if (ProtectionManager.isProtectionRemovalAuthorized(context)) {
            return null;
        }

        Intent challengeIntent = new Intent(context, MainActivity.class);
        challengeIntent.setAction(ACTION_UNINSTALL_CHALLENGE);
        challengeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        setUninstallChallengePending(context, true);
        context.startActivity(challengeIntent);

        return "Complete the Last Puff unlock challenge before disabling uninstall protection.";
    }

    @Override
    public void onEnabled(Context context, Intent intent) {
        setUninstallChallengePending(context, false);
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        if (!ProtectionManager.isProtectionRemovalAuthorized(context)) {
            ProtectionManager.requireChallenge(context, "device-admin-removal");
        }
    }

    public static void setUninstallChallengePending(Context context, boolean pending) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_UNINSTALL_CHALLENGE_PENDING, pending)
            .apply();
    }
}
