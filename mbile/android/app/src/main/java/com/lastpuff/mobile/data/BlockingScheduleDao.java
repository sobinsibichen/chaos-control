package com.lastpuff.mobile.data;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

@Dao
public interface BlockingScheduleDao {
    @Query("SELECT * FROM blocking_schedule WHERE id = 1 LIMIT 1")
    BlockingScheduleEntity getSchedule();

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void upsert(BlockingScheduleEntity entity);

    @Query("UPDATE blocking_schedule SET unlockedForToday = :unlockedForToday, updatedAt = :updatedAt WHERE id = 1")
    void updateUnlockState(boolean unlockedForToday, long updatedAt);

    @Query("UPDATE blocking_schedule SET lastHeartbeatAt = :lastHeartbeatAt, monitoringActive = :monitoringActive, foregroundPackage = :foregroundPackage, updatedAt = :updatedAt WHERE id = 1")
    void updateMonitoringState(long lastHeartbeatAt, boolean monitoringActive, String foregroundPackage, long updatedAt);

    @Query("UPDATE blocking_schedule SET accessibilityHeartbeatAt = :accessibilityHeartbeatAt, updatedAt = :updatedAt WHERE id = 1")
    void updateAccessibilityState(long accessibilityHeartbeatAt, long updatedAt);

    @Query("UPDATE blocking_schedule SET nextAlarmAt = :nextAlarmAt, scheduleActive = :scheduleActive, updatedAt = :updatedAt WHERE id = 1")
    void updateAlarmState(long nextAlarmAt, boolean scheduleActive, long updatedAt);

    @Query("DELETE FROM blocking_schedule")
    void clear();
}
