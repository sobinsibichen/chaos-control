package com.lastpuff.mobile;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

public final class BlockOverlayManager {
    private static volatile BlockOverlayManager instance;

    private final Context context;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private WindowManager windowManager;
    private View overlayView;
    private TextView titleView;
    private TextView appView;
    private TextView countdownView;
    private TextView messageView;
    private String blockedPackage = "";
    private String blockedAppName = "";
    private String blockedReason = "";
    private long triggerAt = 0L;
    private long remainingAtShow = 0L;
    private final Runnable countdownUpdater = new Runnable() {
        @Override
        public void run() {
            if (overlayView == null) {
                return;
            }

            updateCountdownText();
            handler.postDelayed(this, 1000L);
        }
    };

    private BlockOverlayManager(Context context) {
        this.context = context.getApplicationContext();
    }

    public static BlockOverlayManager getInstance(Context context) {
        if (instance == null) {
            synchronized (BlockOverlayManager.class) {
                if (instance == null) {
                    instance = new BlockOverlayManager(context);
                }
            }
        }
        return instance;
    }

    @SuppressLint("InflateParams")
    public synchronized boolean showOverlay(String packageName, String appName, String reason, long remainingMillis) {
        blockedPackage = packageName == null ? "" : packageName;
        blockedAppName = appName == null || appName.trim().isEmpty() ? "This app" : appName.trim();
        blockedReason = reason == null ? "protection active" : reason;
        triggerAt = System.currentTimeMillis();
        remainingAtShow = Math.max(0L, remainingMillis);

        if (overlayView != null) {
            bindContent();
            updateCountdownText();
            return true;
        }

        overlayView = LayoutInflater.from(context).inflate(R.layout.overlay_block_screen, null);
        titleView = overlayView.findViewById(R.id.overlay_block_title);
        appView = overlayView.findViewById(R.id.overlay_block_app_name);
        countdownView = overlayView.findViewById(R.id.overlay_block_countdown);
        messageView = overlayView.findViewById(R.id.overlay_block_message);
        Button backButton = overlayView.findViewById(R.id.overlay_block_back);
        Button homeButton = overlayView.findViewById(R.id.overlay_block_home);

        bindContent();

        overlayView.setFocusable(true);
        overlayView.setFocusableInTouchMode(true);
        overlayView.setOnKeyListener((view, keyCode, event) -> keyCode == KeyEvent.KEYCODE_BACK);

        backButton.setOnClickListener(view -> launchLastPuff());
        homeButton.setOnClickListener(view -> launchHome());

        windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        if (windowManager == null) {
            overlayView = null;
            BlockingEngine.markOverlayHidden(context);
            return false;
        }

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                | WindowManager.LayoutParams.FLAG_FULLSCREEN,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;

        try {
            windowManager.addView(overlayView, params);
            overlayView.requestFocus();
            BlockingEngine.markOverlayShown(context, blockedPackage);
            handler.removeCallbacks(countdownUpdater);
            handler.post(countdownUpdater);
            return true;
        } catch (Exception error) {
            overlayView = null;
            BlockingEngine.markOverlayHidden(context);
            return false;
        }
    }

    public synchronized void refreshOverlay() {
        if (overlayView == null) {
            return;
        }

        updateCountdownText();
    }

    public synchronized boolean isVisible() {
        return overlayView != null;
    }

    public synchronized void hideOverlay() {
        handler.removeCallbacks(countdownUpdater);
        if (overlayView == null || windowManager == null) {
            BlockingEngine.markOverlayHidden(context);
            return;
        }

        try {
            windowManager.removeViewImmediate(overlayView);
        } catch (Exception ignored) {
        } finally {
            overlayView = null;
            titleView = null;
            appView = null;
            countdownView = null;
            messageView = null;
            BlockingEngine.markOverlayHidden(context);
        }
    }

    private void bindContent() {
        if (titleView != null) {
            titleView.setText("App Blocked");
        }
        if (appView != null) {
            appView.setText(blockedAppName);
        }
        if (messageView != null) {
            messageView.setText("Hold the line. This window passes.");
        }
        updateCountdownText();
    }

    private void updateCountdownText() {
        if (countdownView == null) {
            return;
        }

        long remainingMillis = BlockingEngine.getRemainingBlockMillis(context);
        if (remainingMillis <= 0L && remainingAtShow > 0L) {
            remainingMillis = remainingAtShow;
        }

        long totalSeconds = Math.max(0L, remainingMillis / 1000L);
        long hours = totalSeconds / 3600L;
        long minutes = (totalSeconds % 3600L) / 60L;
        long seconds = totalSeconds % 60L;
        countdownView.setText(String.format("Remaining: %02d:%02d:%02d", hours, minutes, seconds));
    }

    private void launchLastPuff() {
        hideOverlay();
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) {
            return;
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        context.startActivity(intent);
    }

    private void launchHome() {
        hideOverlay();
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_HOME);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
}
