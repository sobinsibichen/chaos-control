package com.lastpuff.mobile;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

public class BlockScreenActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView countdownView;
    private String blockedPackageName;

    private final Runnable countdownTicker = new Runnable() {
        @Override
        public void run() {
            if (shouldCloseNow()) {
                finishOverlay();
                return;
            }
            if (countdownView != null) {
                countdownView.setText(BlockingEngine.getCountdownLabel(BlockScreenActivity.this));
            }
            handler.postDelayed(this, 1000L);
        }
    };

    private boolean shouldCloseNow() {
        return blockedPackageName == null || !BlockingEngine.shouldBlockPackage(this, blockedPackageName);
    }

    private void finishOverlay() {
        handler.removeCallbacksAndMessages(null);
        finish();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_FULLSCREEN |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        );
        setShowWhenLocked(true);
        setTurnScreenOn(true);
        setContentView(R.layout.activity_block_screen);

        blockedPackageName = getIntent().getStringExtra("packageName");
        String appName = getIntent().getStringExtra("appName");
        if (appName == null || appName.trim().isEmpty()) {
            appName = "This app";
        }

        if (shouldCloseNow()) {
            finishOverlay();
            return;
        }

        TextView appNameLabel = findViewById(R.id.blocked_app_name_label);
        TextView packageNameView = findViewById(R.id.blocked_package_name);
        TextView scheduleStartView = findViewById(R.id.blocked_schedule_start);
        TextView scheduleEndView = findViewById(R.id.blocked_schedule_end);
        countdownView = findViewById(R.id.blocked_countdown);
        Button openLastPuff = findViewById(R.id.blocked_open_last_puff);
        Button goHome = findViewById(R.id.blocked_go_home);

        appNameLabel.setText("App: " + appName);
        packageNameView.setText("Package: " + (blockedPackageName == null ? "unknown" : blockedPackageName));
        scheduleStartView.setText(BlockingEngine.getBlockStartTimeLabel(this));
        scheduleEndView.setText(BlockingEngine.getBlockEndTimeLabel(this));
        countdownView.setText(BlockingEngine.getCountdownLabel(this));

        openLastPuff.setOnClickListener(view -> {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(launch);
            }
            finishOverlay();
        });

        goHome.setOnClickListener(view -> {
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(home);
            finishOverlay();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(countdownTicker);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(countdownTicker);
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(home);
        finishOverlay();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) {
                onBackPressed();
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
