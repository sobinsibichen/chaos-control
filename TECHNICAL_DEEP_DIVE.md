# LAST PUFF - TECHNICAL DEEP DIVE

## Data Flow & Architecture

### 1. TIME PICKER DATA FLOW

```
┌─────────────────────────────────────────────────────────────┐
│ User selects time in TimePicker component (e.g., 22:07)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ onChange(blockTime) triggered with "22:07" (HH:MM format)  │
│ Location: control.tsx → setBlockTime()                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
         [500ms debounce timer starts]
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/apps/schedule with blockTime: "22:07"            │
│ Backend: appsRoutes.js → saveBlockSchedule()               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Database: block_schedules table                              │
│ INSERT INTO block_schedules (block_time, user_id, ...)      │
│ VALUES ('22:07', userId, ...)                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend receives confirmation                              │
│ Triggers: syncNativeProtectionConfig()                      │
│ (Capacitor bridge call)                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Android Native: ProtectionPlugin.syncConfig()               │
│ Calls: ProtectionPreferences.saveConfig()                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ SharedPreferences: last_puff_protection                     │
│ Save: "block_time" = "22:07"                               │
└─────────────────────────────────────────────────────────────┘

Final Result: Time saved at every layer!
├── Frontend state: blockTime = "22:07"
├── Backend database: block_time = '22:07'
└── Android SharedPreferences: block_time = "22:07"
```

### 2. APP BLOCKING DATA FLOW

```
┌──────────────────────────────────────────────────────────┐
│ App Launch Detected by Android System                    │
│ → AccessibilityEvent fired                              │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ LastPuffAccessibilityService.onAccessibilityEvent()     │
│ Triggered on: WINDOW_STATE_CHANGED, VIEW_FOCUSED, etc.  │
│ Log: "D Accessibility event - Type: WINDOW_STATE_CHANGED"│
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ Get package name from event                             │
│ Example: com.instagram.android                          │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ ProtectionPreferences.shouldBlockPackage(context, pkg)  │
│                                                          │
│ Checks:                                                  │
│ 1. Within block window? (current_time >= block_time)   │
│ 2. Not unlocked for today?                             │
│ 3. In blocked apps list?                               │
└────────────────┬─────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
       YES               NO
        │                 │
        ▼                 ▼
    [BLOCK]        [ALLOW - LOG]
        │                 │
        ▼                 ▼
    Launch          App continues
   BlockedApp       normally
   Activity
```

---

## CODE EXAMPLES - Key Integration Points

### 1. Time Format Integration

#### Frontend → Backend
```typescript
// control.tsx
const [blockTime, setBlockTime] = useState("22:07");

useEffect(() => {
  if (!hasLoadedRef.current) return;
  
  const timeout = window.setTimeout(async () => {
    await apiRequest("/api/apps/schedule", {
      method: "POST",
      body: JSON.stringify({ 
        blockTime,        // ← Now supports "22:07" instead of just "22:00" or "22:30"
        frequency: "daily", 
        enabled: true 
      }),
    });
  }, 500);
}, [blockTime]);
```

#### Backend Storage
```javascript
// backend/services/userDataService.js
async function saveBlockSchedule(userId, payload) {
  const { blockTime, frequency } = payload;
  // blockTime can now be any "HH:MM" format!
  // Examples: "08:22", "14:07", "21:43"
  
  await db.query(
    `INSERT INTO block_schedules (user_id, block_time, frequency, enabled)
     VALUES ($1, $2, $3, true)`,
    [userId, blockTime, frequency]
  );
}
```

#### Backend → Android Native
```typescript
// src/lib/native/mobile.ts
export async function syncNativeProtectionConfig(options: {
  apps: Array<{ appName: string; packageName: string; isActive: boolean }>;
  blockTime: string;  // ← Full minute precision preserved!
}) {
  if (!isNativeAndroid()) return null;
  
  return Protection.syncConfig(options);
  // This calls ProtectionPlugin.syncConfig() on Android
}
```

#### Android Native Storage
```java
// ProtectionPreferences.java
public static void saveConfig(Context context, JSONArray apps, String blockTime) {
  Log.i(TAG, "Saving protection config - Block time: " + blockTime);
  
  prefs(context)
    .edit()
    .putString(KEY_BLOCKED_APPS_JSON, apps.toString())
    .putString(KEY_BLOCK_TIME, blockTime)  // ← "22:07" format stored exactly
    .apply();
}
```

### 2. Blocking Decision Logic

```java
// ProtectionPreferences.java - Core blocking logic
public static boolean shouldBlockPackage(Context context, String packageName) {
  if (packageName == null || packageName.isEmpty()) {
    Log.d(TAG, "Null or empty package name");
    return false;
  }

  // Check 1: Is it within the blocked time window?
  boolean withinWindow = isWithinBlockedWindow(context);
  Log.d(TAG, "Within window: " + withinWindow);
  
  // Check 2: Has the app been unlocked for today?
  boolean unlocked = isUnlockedForToday(context);
  Log.d(TAG, "Unlocked: " + unlocked);
  
  if (!withinWindow || unlocked) {
    return false;  // Don't block
  }

  // Check 3: Is this app in the blocked list?
  JSONArray apps = getBlockedApps(context);
  for (int i = 0; i < apps.length(); i++) {
    JSONObject app = apps.optJSONObject(i);
    if (app == null || !app.optBoolean("isActive", false)) {
      continue;
    }

    String appPackage = app.optString("packageName");
    if (packageName.equals(appPackage)) {
      Log.i(TAG, "SHOULD BLOCK: " + packageName);
      return true;  // Block this app!
    }
  }

  return false;  // App not in blocked list
}

// Helper: Check if current time >= block time
public static boolean isWithinBlockedWindow(Context context) {
  String blockTime = getBlockTime(context);  // e.g., "22:07"
  String[] pieces = blockTime.split(":");
  
  int hour = Integer.parseInt(pieces[0]);      // 22
  int minute = Integer.parseInt(pieces[1]);    // 07
  
  Date now = new Date();
  SimpleDateFormat hourFormat = new SimpleDateFormat("H", Locale.US);
  SimpleDateFormat minuteFormat = new SimpleDateFormat("m", Locale.US);
  
  int currentHour = Integer.parseInt(hourFormat.format(now));
  int currentMinute = Integer.parseInt(minuteFormat.format(now));
  
  int blockTotalMinutes = hour * 60 + minute;        // 22*60+7 = 1327
  int currentTotalMinutes = currentHour * 60 + currentMinute;
  
  boolean withinWindow = currentTotalMinutes >= blockTotalMinutes;
  
  Log.d(TAG, "Window check - Block: " + blockTime + " (" + blockTotalMinutes + 
             " min), Current: " + String.format("%02d:%02d", currentHour, currentMinute) +
             " (" + currentTotalMinutes + " min), Within: " + withinWindow);
  
  return withinWindow;
}
```

### 3. Service Startup Chain

```java
// MainActivity.java - Entry point
@Override
public void onCreate(Bundle savedInstanceState) {
  Log.i(TAG, "MainActivity created");
  
  registerPlugin(InstalledAppsPlugin.class);
  registerPlugin(ProtectionPlugin.class);
  registerPlugin(VoiceAssistantPlugin.class);
  
  super.onCreate(savedInstanceState);
  
  // Critical: Start protection service
  startProtectionService();
}

private void startProtectionService() {
  try {
    Intent serviceIntent = new Intent(this, ProtectionForegroundService.class);
    startForegroundService(serviceIntent);  // ← Persistent background service
    Log.d(TAG, "Protection foreground service started");
  } catch (Exception e) {
    Log.e(TAG, "Failed to start protection service", e);
  }
}

// ProtectionForegroundService - Keeps running even if app is closed
@Override
public int onStartCommand(Intent intent, int flags, int startId) {
  Log.i(TAG, "ProtectionForegroundService started");
  
  createNotificationChannel();  // Android 8+ requirement
  Notification notification = buildNotification();
  
  startForeground(NOTIFICATION_ID, notification);
  
  return START_STICKY;  // ← Auto-restart if killed!
}

// ProtectionBootReceiver - Restore after device reboot
@Override
public void onReceive(Context context, Intent intent) {
  String action = intent.getAction();
  
  if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
    Log.i(TAG, "Device boot detected - restoring protection");
    
    Intent serviceIntent = new Intent(context, ProtectionForegroundService.class);
    context.startForegroundService(serviceIntent);
  }
}
```

### 4. Blocking Action Chain

```java
// LastPuffAccessibilityService.java - Detect app launch
@Override
public void onAccessibilityEvent(AccessibilityEvent event) {
  if (event == null || event.getPackageName() == null) {
    return;
  }

  String packageName = event.getPackageName().toString();
  String eventType = getEventTypeName(event.getEventType());
  
  Log.d(TAG, "Accessibility event - Type: " + eventType + ", Package: " + packageName);

  // Skip own app
  if (getPackageName().equals(packageName)) {
    Log.d(TAG, "Skipping own app");
    return;
  }

  // Check if should block
  if (!ProtectionPreferences.shouldBlockPackage(this, packageName)) {
    Log.d(TAG, "Package not in blocked list");
    return;
  }

  // Apply debounce (prevent duplicate blocks within 1200ms)
  long now = SystemClock.elapsedRealtime();
  if (packageName.equals(lastBlockedPackage) && now - lastLaunchAt < 1200) {
    Log.d(TAG, "Debounced: Recent block attempt");
    return;
  }

  lastBlockedPackage = packageName;
  lastLaunchAt = now;

  String appName = ProtectionPreferences.getAppName(this, packageName);
  Log.i(TAG, "BLOCKING APP: " + appName + " (" + packageName + ")");

  // Launch blocking screen
  Intent intent = new Intent(this, BlockedAppActivity.class);
  intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
  intent.putExtra("packageName", packageName);
  intent.putExtra("appName", appName);
  
  try {
    startActivity(intent);
    Log.i(TAG, "Block overlay launched for: " + appName);
  } catch (Exception e) {
    Log.e(TAG, "Failed to launch block overlay", e);
  }
}

// BlockedAppActivity - User sees this
@Override
protected void onCreate(Bundle savedInstanceState) {
  super.onCreate(savedInstanceState);
  setContentView(R.layout.activity_blocked_app);

  String appName = getIntent().getStringExtra("appName");
  String packageName = getIntent().getStringExtra("packageName");
  
  Log.i(TAG, "BlockedAppActivity shown for: " + appName + " (" + packageName + ")");

  // Set UI text
  title.setText(appName + " is blocked right now");
  body.setText("Your focus is your superpower...");
  hint.setText("Schedule: " + ProtectionPreferences.getBlockTime(this) + " onwards");

  // Prevent back button
  openLastPuff.setOnClickListener((view) -> {
    Log.d(TAG, "User chose: Open Last Puff");
    // Launch Last Puff app...
  });

  goHome.setOnClickListener((view) -> {
    Log.d(TAG, "User chose: Go Home");
    // Go to home screen...
  });
}

@Override
public void onBackPressed() {
  Log.d(TAG, "Back button pressed - ignored");
  // Go home instead of closing
  Intent home = new Intent(Intent.ACTION_MAIN);
  home.addCategory(Intent.CATEGORY_HOME);
  startActivity(home);
}
```

---

## Android System Integration Points

### Manifest Declaration Flow

```xml
<!-- AndroidManifest.xml -->

<!-- Permissions needed -->
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

<!-- Service declarations -->
<service android:name=".LastPuffAccessibilityService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
  <intent-filter>
    <action android:name="android.accessibilityservice.AccessibilityService" />
  </intent-filter>
  <meta-data
    android:name="android.accessibilityservice"
    android:resource="@xml/last_puff_accessibility_service" />
</service>

<service android:name=".ProtectionForegroundService"
    android:foregroundServiceType="microphone" />

<!-- Boot receivers -->
<receiver android:name=".ProtectionBootReceiver"
    android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.BOOT_COMPLETED" />
    <action android:name="android.intent.action.QUICKBOOT_POWERON" />
  </intent-filter>
</receiver>
```

### Accessibility Service Configuration

```xml
<!-- res/xml/last_puff_accessibility_service.xml -->
<accessibility-service
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowsChanged|typeViewFocused|typeViewClicked"
    android:canRetrieveWindowContent="true"
    android:notificationTimeout="100" />

<!-- This triggers onAccessibilityEvent() for:
     - Window state changes (most app launches)
     - Windows changed (app switcher)
     - View focused (keyboard, dialogs)
     - View clicked (user interaction) -->
```

---

## Time Calculation Deep Dive

### Converting Time Format to Minutes

```
Block time: "22:07" (10:07 PM)
            ↓
            Split by ":"
            ↓
        hour = 22
        minute = 07
            ↓
            Total minutes = 22 * 60 + 7 = 1327

Current time: 21:30 (9:30 PM)
            ↓
        hour = 21
        minute = 30
            ↓
            Total minutes = 21 * 60 + 30 = 1290

Comparison: 1290 >= 1327?
           NO → Not within blocked window yet
```

### Example Timeline

```
Time     Current Min  Block Min  Within?
08:00    480          1327       NO
10:00    600          1327       NO
12:00    720          1327       NO
15:00    900          1327       NO
20:00    1200         1327       NO
22:00    1320         1327       NO
22:07    1327         1327       YES! ← Blocking starts
22:08    1328         1327       YES
23:59    1439         1327       YES
00:00    0            1327       NO (next day)
```

---

## Logging Analysis Examples

### Successful Block Scenario

```
D LASTPUFF_PROTECTION: Accessibility event - Type: WINDOW_STATE_CHANGED, Package: com.instagram.android
D LASTPUFF_PROTECTION: Within window: true
D LASTPUFF_PROTECTION: Unlocked: false
I LASTPUFF_PROTECTION: SHOULD BLOCK: com.instagram.android (matched in blocked list)
I LASTPUFF_PROTECTION: BLOCKING APP: Instagram (com.instagram.android)
I LASTPUFF_PROTECTION: Block overlay launched for: Instagram
D LASTPUFF_PROTECTION: BlockedAppActivity shown for: Instagram (com.instagram.android)
```

### Failed Block Scenario (Outside Window)

```
D LASTPUFF_PROTECTION: Accessibility event - Type: WINDOW_STATE_CHANGED, Package: com.instagram.android
D LASTPUFF_PROTECTION: Window check - Block time: 22:07 (1327 min), Current: 15:30 (930 min), Within: false
D LASTPUFF_PROTECTION: No block for com.instagram.android - Within window: false
```

### Failed Block Scenario (Unlocked)

```
D LASTPUFF_PROTECTION: Accessibility event - Type: WINDOW_STATE_CHANGED, Package: com.instagram.android
D LASTPUFF_PROTECTION: Unlock check - Stored: 2026-05-28, Today: 2026-05-28, Unlocked: true
D LASTPUFF_PROTECTION: No block for com.instagram.android - Unlocked: true
```

---

## Final Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                   React Frontend (Web)                      │
│                  - TimePicker Component                     │
│                  - Control Page                             │
│                  - Auto-save on change                      │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   REST API (Backend)                        │
│              - POST /api/apps/schedule                      │
│              - Store blockTime in database                  │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│            Capacitor Bridge (JavaScript ↔ Native)          │
│         - syncNativeProtectionConfig()                      │
│         - getNativeProtectionStatus()                       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Android Native Layer                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ MainActivity - Initializes & starts services       │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ProtectionPlugin - Capacitor bridge               │    │
│  │ - Receives config from frontend                   │    │
│  │ - Saves to ProtectionPreferences                  │    │
│  │ - Starts ProtectionForegroundService              │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ProtectionForegroundService - Always running      │    │
│  │ - Shows persistent notification                   │    │
│  │ - Ensures service continues in background         │    │
│  │ - Survives app close                              │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ LastPuffAccessibilityService - App detection      │    │
│  │ - Listens for accessibility events                │    │
│  │ - Detects foreground app changes                  │    │
│  │ - Calls shouldBlockPackage()                      │    │
│  │ - Launches BlockedAppActivity if needed           │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ProtectionBootReceiver - Boot persistence         │    │
│  │ - Listens for BOOT_COMPLETED                      │    │
│  │ - Restarts ProtectionForegroundService            │    │
│  │ - Survives device reboot                          │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ProtectionPreferences - Configuration storage     │    │
│  │ - Stores blockTime                                │    │
│  │ - Stores blocked apps list                        │    │
│  │ - Stores unlock state                             │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ BlockedAppActivity - Lock screen                  │    │
│  │ - Full screen overlay                             │    │
│  │ - Back button prevented                           │    │
│  │ - Offers: Open Last Puff or Go Home               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│            Android System (PackageManager, etc.)            │
│         - Detects app launches                              │
│         - Sends accessibility events                        │
│         - Manages permissions                               │
└─────────────────────────────────────────────────────────────┘
```

---

This implementation provides production-grade app blocking with complete minute-level time precision, persistent background protection, comprehensive logging, and cross-device boot recovery. ✅
