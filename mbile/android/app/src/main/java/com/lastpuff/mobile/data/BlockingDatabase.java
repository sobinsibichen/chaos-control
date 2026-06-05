package com.lastpuff.mobile.data;

import androidx.room.Database;
import androidx.room.migration.Migration;
import androidx.room.RoomDatabase;
import androidx.sqlite.db.SupportSQLiteDatabase;

@Database(entities = {BlockingScheduleEntity.class}, version = 2, exportSchema = false)
public abstract class BlockingDatabase extends RoomDatabase {
    public static final Migration MIGRATION_1_2 = new Migration(1, 2) {
        @Override
        public void migrate(SupportSQLiteDatabase database) {
            database.execSQL("ALTER TABLE blocking_schedule ADD COLUMN blockEndHour INTEGER NOT NULL DEFAULT 0");
            database.execSQL("ALTER TABLE blocking_schedule ADD COLUMN blockEndMinute INTEGER NOT NULL DEFAULT 0");
        }
    };

    public abstract BlockingScheduleDao blockingScheduleDao();
}
