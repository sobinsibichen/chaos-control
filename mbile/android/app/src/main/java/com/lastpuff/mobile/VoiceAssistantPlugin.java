package com.lastpuff.mobile;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VoiceAssistant")
public class VoiceAssistantPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        String wakeWord = call.getString("wakeWord", "Hey Nova");
        Intent intent = new Intent(getContext(), VoiceAssistantService.class);
        intent.setAction(VoiceAssistantService.ACTION_START);
        intent.putExtra(VoiceAssistantService.EXTRA_WAKE_WORD, wakeWord);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        call.resolve(buildStatus());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), VoiceAssistantService.class);
        intent.setAction(VoiceAssistantService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void syncCache(PluginCall call) {
        // Native cache hooks for smoke stats, replay, and craving data can be hydrated here.
        call.resolve();
    }

    private JSObject buildStatus() {
        JSObject status = new JSObject();
        status.put("running", VoiceAssistantService.isRunning());
        status.put("wakeWord", VoiceAssistantService.getWakeWord());
        status.put("lastCommandAt", VoiceAssistantService.getLastCommandAt());
        return status;
    }
}
