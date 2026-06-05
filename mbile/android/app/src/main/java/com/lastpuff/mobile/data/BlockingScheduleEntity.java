package com.lastpuff.mobile.data;

import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "blocking_schedule")
public class BlockingScheduleEntity {
    @PrimaryKey
    public int id = 1;

    public int blockHour;
    public int blockMinute;
    public int blockEndHour;
    public int blockEndMinute;
    public String repeatType;
    public boolean enabled;
    public boolean protectionActive;
    public boolean monitoringActive;
    public boolean scheduleActive;
    public boolean batteryOptimizationIgnored;
    public boolean unlockedForToday;
    public long nextAlarmAt;
    public long lastHeartbeatAt;
    public long accessibilityHeartbeatAt;
    public String foregroundPackage;
    public String blockedAppsJson;
    public long updatedAt;

    public BlockingScheduleEntity() {
    }
}
