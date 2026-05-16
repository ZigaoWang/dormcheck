package com.dormcheck.app.domain.model

data class CheckinRequest(
    val uid: String,
    val student_id: String? = null,
    val temperature: Float? = null,
    val check_type: String,
    val device_id: String? = null,
    val client_timestamp: String? = null,
    val photo_url: String? = null
)
