package com.lastpuff.mobile;

public final class VoiceCommandOutcome {
    private final String spokenText;
    private final String commandType;

    public VoiceCommandOutcome(String spokenText, String commandType) {
        this.spokenText = spokenText;
        this.commandType = commandType;
    }

    public String getSpokenText() {
        return spokenText;
    }

    public String getCommandType() {
        return commandType;
    }
}
