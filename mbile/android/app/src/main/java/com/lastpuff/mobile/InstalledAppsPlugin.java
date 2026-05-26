package com.lastpuff.mobile;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "InstalledApps")
public class InstalledAppsPlugin extends Plugin {
    @PluginMethod
    public void listInstalledApps(PluginCall call) {
        boolean includeSystemApps = call.getBoolean("includeSystemApps", false);
        PackageManager packageManager = getContext().getPackageManager();
        List<PackageInfo> installedPackages = packageManager.getInstalledPackages(PackageManager.GET_META_DATA);
        List<JSObject> apps = new ArrayList<>();
        String ownPackageName = getContext().getPackageName();

        for (PackageInfo packageInfo : installedPackages) {
            ApplicationInfo applicationInfo = packageInfo.applicationInfo;
            if (applicationInfo == null) {
                continue;
            }

            String packageName = packageInfo.packageName;
            if (ownPackageName.equals(packageName)) {
                continue;
            }

            Intent launchIntent = packageManager.getLaunchIntentForPackage(packageName);
            if (launchIntent == null) {
                continue;
            }

            boolean systemApp = (applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
            if (!includeSystemApps && systemApp) {
                continue;
            }

            CharSequence label = packageManager.getApplicationLabel(applicationInfo);
            String appName = label != null ? label.toString().trim() : packageName;
            if (appName.isEmpty()) {
                appName = packageName;
            }

            JSObject app = new JSObject();
            app.put("appName", appName);
            app.put("packageName", packageName);
            app.put("systemApp", systemApp);
            apps.add(app);
        }

        Collator collator = Collator.getInstance(Locale.getDefault());
        apps.sort(Comparator.comparing(app -> app.getString("appName", ""), collator));

        JSArray result = new JSArray();
        for (JSObject app : apps) {
            result.put(app);
        }

        JSObject response = new JSObject();
        response.put("apps", result);
        call.resolve(response);
    }
}
