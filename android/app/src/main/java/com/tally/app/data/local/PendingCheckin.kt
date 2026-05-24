package com.tally.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_checkins")
data class PendingCheckin(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val uid: String,
    val temperature: Float? = null,
    val checkType: String,
    val deviceId: String?,
    val clientTimestamp: String,
    val retryCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)
