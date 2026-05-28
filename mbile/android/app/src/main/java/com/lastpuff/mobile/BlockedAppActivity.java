package com.lastpuff.mobile;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.widget.Button;
import android.widget.TextView;

/**
 * Full-screen blocking activity that appears when a protected app is launched.
 * Prevents easy dismissal and encourages user to return to Last Puff or go home.
 */
public class BlockedAppActivity extends Activity {
    private static final String TAG = "LASTPUFF_PROTECTION";
    private String packageName;
    private String appName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_blocked_app);

        packageName = getIntent().getStringExtra("packageName");
        appName = getIntent().getStringExtra("appName");
        
        if (appName == null || appName.trim().isEmpty()) {
            appName = "This app";
        }

        Log.i(TAG, "BlockedAppActivity shown for: " + appName + " (" + packageName + ")");

        // Get UI elements
        TextView title = findViewById(R.id.blocked_app_title);
        TextView body = findViewById(R.id.blocked_app_body);
        TextView hint = findViewById(R.id.blocked_app_hint);
        Button openLastPuff = findViewById(R.id.blocked_open_last_puff);
        Button goHome = findViewById(R.id.blocked_go_home);

        // Set text
        title.setText(appName + " is blocked right now");
        body.setText("Your focus is your superpower. Complete the mental stability challenge in Last Puff to unlock your protected apps for today.");
        
        String blockTime = ProtectionPreferences.getBlockTime(this);
        String schedule = "Daily from " + blockTime + " onwards";
        hint.setText("Schedule: " + schedule);

        Log.d(TAG, "Block time: " + blockTime + ", Block window active: " + ProtectionPreferences.isWithinBlockedWindow(this));

        // Open Last Puff button
        if (openLastPuff != null) {
            openLastPuff.setOnClickListener((view) -> {
                Log.d(TAG, "User chose: Open Last Puff");
                Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (launch != null) {
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(launch);
                }
                finish();
            });
        }

        // Go Home button
        if (goHome != null) {
            goHome.setOnClickListener((view) -> {
                Log.d(TAG, "User chose: Go Home");
                Intent home = new Intent(Intent.ACTION_MAIN);
                home.addCategory(Intent.CATEGORY_HOME);
                home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(home);
                finish();
            });
        }
    }

    @Override
    public void onBackPressed() {
        // Prevent back button from closing the activity
        Log.d(TAG, "Back button pressed - ignored");
        // Optionally, could launch home screen instead
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(home);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Prevent home button and other system navigation
        if (event.getKeyCode() == KeyEvent.KEYCODE_HOME) {
            Log.d(TAG, "Home button pressed - blocked");
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        // Log touch attempts
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            Log.d(TAG, "Touch detected on block screen");
        }
        return super.dispatchTouchEvent(event);
    }

    @Override
    public void onPause() {
        Log.d(TAG, "BlockedAppActivity paused");
        super.onPause();
    }

    @Override
    public void onResume() {
        Log.d(TAG, "BlockedAppActivity resumed");
        super.onResume();
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "BlockedAppActivity destroyed");
        super.onDestroy();
    }
}
