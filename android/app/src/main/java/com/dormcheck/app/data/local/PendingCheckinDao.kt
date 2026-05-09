package com.dormcheck.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface PendingCheckinDao {

    @Insert
    fun insert(checkin: PendingCheckin)

    @Query("SELECT * FROM pending_checkins ORDER BY createdAt ASC")
    fun getAll(): List<PendingCheckin>

    @Query("SELECT COUNT(*) FROM pending_checkins")
    fun getCount(): Int

    @Query("DELETE FROM pending_checkins WHERE id = :id")
    fun deleteById(id: Long)

    @Query("UPDATE pending_checkins SET retryCount = retryCount + 1 WHERE id = :id")
    fun incrementRetry(id: Long)

    @Query("DELETE FROM pending_checkins WHERE retryCount > :maxRetries")
    fun deleteStale(maxRetries: Int = 50)
}
