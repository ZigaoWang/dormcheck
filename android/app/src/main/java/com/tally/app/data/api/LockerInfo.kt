package com.tally.app.data.api

data class LockerInfo(
    val ok: Boolean,
    val studentId: String?,
    val hasPhone: Boolean,
    val hasLaptop: Boolean,
    val hasIpad: Boolean
)
