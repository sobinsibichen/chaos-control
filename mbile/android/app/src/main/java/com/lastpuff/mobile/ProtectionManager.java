package com.lastpuff.mobile;

import android.content.Context;
import android.content.Intent;

import com.lastpuff.mobile.data.BlockingRepository;

public final class ProtectionManager {
    public static final long UNINSTALL_AUTHORIZATION_WINDOW_MS = 2 * 60 * 1000L;
    public static final String ACTION_PROTECTION_CHALLENGE = "com.lastpuff.mobile.PROTECTION_CHALLENGE";
    public static final String EXTRA_CHALLENGE_REASON = "challengeReason";

    private ProtectionManager() {
    }

    public static void requireChallenge(Context context, String reason) {
        if (context == null) {
            return;
        }

        LastPuffDeviceAdminReceiver.setUninstallChallengePending(context, true);
        Intent challengeIntent = new Intent(context, MainActivity.class);
        challengeIntent.setAction(ACTION_PROTECTION_CHALLENGE);
        challengeIntent.putExtra(EXTRA_CHALLENGE_REASON, reason == null ? "protection" : reason);
        challengeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        context.startActivity(challengeIntent);
    }

    public static void authorizeProtectionRemoval(Context context) {
        BlockingRepository.authorizeUninstall(context, UNINSTALL_AUTHORIZATION_WINDOW_MS);
        LastPuffDeviceAdminReceiver.setUninstallChallengePending(context, false);
    }

    public static boolean isProtectionRemovalAuthorized(Context context) {
        return BlockingRepository.isUninstallAuthorized(context);
    }

    public static void clearProtectionRemovalAuthorization(Context context) {
        BlockingRepository.clearUninstallAuthorization(context);
        LastPuffDeviceAdminReceiver.setUninstallChallengePending(context, false);
    }
}
