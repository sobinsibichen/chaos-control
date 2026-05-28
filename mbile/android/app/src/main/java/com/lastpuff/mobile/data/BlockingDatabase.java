package com.lastpuff.mobile.data;

import androidx.room.Database;
import androidx.room.RoomDatabase;

@Database(entities = {BlockingScheduleEntity.class}, version = 1, exportSchema = false)
public abstract class BlockingDatabase extends RoomDatabase {
    public abstract BlockingScheduleDao blockingScheduleDao();
}
