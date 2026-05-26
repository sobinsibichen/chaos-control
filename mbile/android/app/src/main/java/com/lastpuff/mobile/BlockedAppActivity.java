package com.lastpuff.mobile;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

public class BlockedAppActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_blocked_app);

        String appName = getIntent().getStringExtra("appName");
        if (appName == null || appName.trim().isEmpty()) {
            appName = "This app";
        }

        TextView title = findViewById(R.id.blocked_app_title);
        TextView body = findViewById(R.id.blocked_app_body);
        TextView hint = findViewById(R.id.blocked_app_hint);
        Button openLastPuff = findViewById(R.id.blocked_open_last_puff);
        Button goHome = findViewById(R.id.blocked_go_home);

        title.setText(appName + " is blocked right now");
        body.setText("Complete the challenge in Last Puff to unlock your protected apps for today.");
        hint.setText("Schedule: " + ProtectionPreferences.getBlockTime(this) + " onwards");

        openLastPuff.setOnClickListener((view) -> {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(launch);
            }
            finish();
        });

        goHome.setOnClickListener((view) -> {
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(home);
            finish();
        });
    }
}
