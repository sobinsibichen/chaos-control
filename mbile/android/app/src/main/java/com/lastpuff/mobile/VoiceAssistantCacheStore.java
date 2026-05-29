package com.lastpuff.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

public final class VoiceAssistantCacheStore {
    private static final String PREFS_NAME = "last_puff_voice_assistant";
    private static final String KEY_CACHE = "cache_json";
    private static final String KEY_ASSISTANT_NAME = "assistant_name";
    private static final String KEY_ENABLED = "voice_enabled";
    private static final String KEY_LAST_SYNC_AT = "last_sync_at";
    private static final String KEY_LAST_COMMAND = "last_command";
    private static final String KEY_LAST_RESPONSE = "last_response";
    private static final String KEY_LAST_INVOCATION_AT = "last_invocation_at";

    private VoiceAssistantCacheStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static synchronized void mergeCache(Context context, JSONObject payload) {
        if (payload == null) {
            return;
        }

        JSONObject merged = readCache(context);
        Iterator<String> keys = payload.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            try {
                merged.put(key, payload.get(key));
            } catch (JSONException ignored) {
                // Keep the previous value if a single field cannot be persisted.
            }
        }

        SharedPreferences.Editor editor = prefs(context).edit();
        editor.putString(KEY_CACHE, merged.toString());
        editor.putLong(KEY_LAST_SYNC_AT, System.currentTimeMillis());

        String assistantName = payload.optString("assistantName", null);
        if (assistantName != null && !assistantName.trim().isEmpty()) {
            editor.putString(KEY_ASSISTANT_NAME, assistantName.trim());
        }

        if (payload.has("voiceEnabled")) {
            editor.putBoolean(KEY_ENABLED, payload.optBoolean("voiceEnabled", true));
        }

        editor.apply();
    }

    public static synchronized JSONObject readCache(Context context) {
        String raw = prefs(context).getString(KEY_CACHE, "{}");
        try {
            return new JSONObject(raw == null ? "{}" : raw);
        } catch (JSONException exception) {
            return new JSONObject();
        }
    }

    public static synchronized void setAssistantName(Context context, String assistantName) {
        String resolved = assistantName == null || assistantName.trim().isEmpty() ? "Nova" : assistantName.trim();
        prefs(context).edit().putString(KEY_ASSISTANT_NAME, resolved).apply();
    }

    public static synchronized String getAssistantName(Context context) {
        String assistantName = prefs(context).getString(KEY_ASSISTANT_NAME, "Nova");
        return assistantName == null || assistantName.trim().isEmpty() ? "Nova" : assistantName.trim();
    }

    public static synchronized void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
    }

    public static synchronized boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, true);
    }

    public static synchronized void markInvocation(Context context, String command, String response) {
        SharedPreferences.Editor editor = prefs(context).edit();
        editor.putString(KEY_LAST_COMMAND, command);
        editor.putString(KEY_LAST_RESPONSE, response);
        editor.putLong(KEY_LAST_INVOCATION_AT, System.currentTimeMillis());
        editor.apply();
    }

    public static synchronized JSObject buildStatus(Context context) {
        JSObject status = new JSObject();
        long lastSyncAt = prefs(context).getLong(KEY_LAST_SYNC_AT, 0L);
        long lastInvocationAt = prefs(context).getLong(KEY_LAST_INVOCATION_AT, 0L);
        String lastCommand = prefs(context).getString(KEY_LAST_COMMAND, null);
        String lastResponse = prefs(context).getString(KEY_LAST_RESPONSE, null);
        JSONObject cache = readCache(context);

        status.put("running", isEnabled(context));
        status.put("assistantName", getAssistantName(context));
        status.put("cacheReady", cache.length() > 0);
        status.put("appActionsReady", true);
        status.put("googleAssistantReady", true);
        status.put("voiceCommandsEnabled", isEnabled(context));
        status.put("cacheUpdatedAt", lastSyncAt);
        status.put("lastInvocationAt", lastInvocationAt);
        status.put("lastCommand", lastCommand);
        status.put("lastResponse", lastResponse);
        status.put("cachedPayload", cache);
        return status;
    }
}
