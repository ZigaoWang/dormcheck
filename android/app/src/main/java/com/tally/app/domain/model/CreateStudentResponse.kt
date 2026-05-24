package com.tally.app.domain.model

data class CreateStudentResponse(
    val ok: Boolean,
    val student_id: String? = null,
    val name: String? = null,
    val grade: Int? = null,
    val house: String? = null,
    val error: String? = null
)
