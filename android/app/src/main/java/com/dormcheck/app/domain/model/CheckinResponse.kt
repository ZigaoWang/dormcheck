package com.dormcheck.app.domain.model

data class CheckinResponse(
    val ok: Boolean,
    val student_id: String? = null,
    val name: String? = null,
    val grade: Int? = null,
    val is_late: Boolean = false,
    val is_fever: Boolean = false,
    val is_update: Boolean = false,
    val message: String? = null,
    val error: String? = null
)
