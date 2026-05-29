package com.lastpuff.mobile;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowManager;

import java.util.HashMap;
import java.util.Locale;
import java.util.UUID;

public class VoiceAssistantActivity extends Activity implements TextToSpeech.OnInitListener {
    private TextToSpeech textToSpeech;
    private String pendingResponse;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        String command = extractCommand();
        String assistantName = VoiceAssistantCacheStore.getAssistantName(this);
        VoiceCommandOutcome outcome = VoiceCommandRouter.resolve(command, VoiceAssistantCacheStore.readCache(this), assistantName);

        pendingResponse = outcome.getSpokenText();
        VoiceAssistantCacheStore.markInvocation(this, command, pendingResponse);

        textToSpeech = new TextToSpeech(this, this);
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS || textToSpeech == null) {
            finishSilently();
            return;
        }

        int languageStatus = textToSpeech.setLanguage(Locale.US);
        if (languageStatus == TextToSpeech.LANG_MISSING_DATA || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
            finishSilently();
            return;
        }

        textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {}

            @Override
            public void onDone(String utteranceId) {
                runOnUiThread(VoiceAssistantActivity.this::finishSilently);
            }

            @Override
            public void onError(String utteranceId) {
                runOnUiThread(VoiceAssistantActivity.this::finishSilently);
            }
        });

        HashMap<String, String> params = new HashMap<>();
        params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, UUID.randomUUID().toString());
        textToSpeech.speak(pendingResponse, TextToSpeech.QUEUE_FLUSH, params);
    }

    @Override
    protected void onDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        super.onDestroy();
    }

    private String extractCommand() {
        if (getIntent() == null) {
            return "";
        }

        String[] keys = {
            "command",
            "query",
            "assistant_command",
            "android.intent.extra.TEXT"
        };

        for (String key : keys) {
            if (getIntent().hasExtra(key)) {
                String value = getIntent().getStringExtra(key);
                if (value != null && !value.trim().isEmpty()) {
                    return value.trim();
                }
            }
        }

        Uri data = getIntent().getData();
        if (data != null) {
            String command = data.getQueryParameter("command");
            if (command != null && !command.trim().isEmpty()) {
                return command.trim();
            }

            if (data.getLastPathSegment() != null && !data.getLastPathSegment().trim().isEmpty()) {
                return data.getLastPathSegment().replace('-', ' ').trim();
            }
        }

        if (getIntent().getDataString() != null) {
            return getIntent().getDataString();
        }

        return "";
    }

    private void finishSilently() {
        if (!isFinishing()) {
            finish();
        }
        overridePendingTransition(0, 0);
    }
}
