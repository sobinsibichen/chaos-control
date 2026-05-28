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

import com.lastpuff.mobile.data.BlockingRepository;

public class BlockScreenActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView countdownView;
    private final Runnable countdownTicker = new Runnable() {
        @Override
        public void run() {
            if (countdownView != null) {
                countdownView.setText(formatCountdown(BlockingEngine.getCountdownMillis()));
            }
            handler.postDelayed(this, 1000L);
        }
    };

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

        String packageName = getIntent().getStringExtra("packageName");
        String appName = getIntent().getStringExtra("appName");
        String reason = getIntent().getStringExtra("reason");
        if (appName == null || appName.trim().isEmpty()) {
            appName = "This app";
        }

        TextView title = findViewById(R.id.blocked_app_title);
        TextView body = findViewById(R.id.blocked_app_body);
        TextView hint = findViewById(R.id.blocked_app_hint);
        countdownView = findViewById(R.id.blocked_countdown);
        Button openLastPuff = findViewById(R.id.blocked_open_last_puff);
        Button goHome = findViewById(R.id.blocked_go_home);

        title.setText(appName + " is blocked");
        body.setText(getString(R.string.block_screen_quote));
        String schedule = "Schedule " + BlockingRepository.getBlockTimeLabel(this) + " • " + (reason == null ? "protection active" : reason);
        hint.setText(schedule + (packageName == null ? "" : " • " + packageName));
        countdownView.setText(formatCountdown(BlockingEngine.getCountdownMillis()));

        openLastPuff.setOnClickListener(view -> {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(launch);
            }
            finish();
        });

        goHome.setOnClickListener(view -> {
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(home);
            finish();
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
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private String formatCountdown(long millis) {
        long seconds = Math.max(0L, millis / 1000L);
        long hours = seconds / 3600L;
        long minutes = (seconds % 3600L) / 60L;
        long remainingSeconds = seconds % 60L;
        return String.format("Unlocks in %02d:%02d:%02d", hours, minutes, remainingSeconds);
    }
}
