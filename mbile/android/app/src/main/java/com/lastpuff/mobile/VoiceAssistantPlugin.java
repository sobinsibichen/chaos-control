package com.lastpuff.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

@CapacitorPlugin(name = "VoiceAssistant")
public class VoiceAssistantPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        VoiceAssistantCacheStore.setEnabled(getContext(), true);
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        VoiceAssistantCacheStore.setEnabled(getContext(), false);
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void syncCache(PluginCall call) {
        JSONObject payload = call.getObject("payload");
        if (payload != null) {
            VoiceAssistantCacheStore.mergeCache(getContext(), payload);
        }
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void setAssistantName(PluginCall call) {
        String assistantName = call.getString("assistantName", "Nova");
        VoiceAssistantCacheStore.setAssistantName(getContext(), assistantName);
        call.resolve(buildStatus());
    }

    private JSObject buildStatus() {
        return VoiceAssistantCacheStore.buildStatus(getContext());
    }
}
