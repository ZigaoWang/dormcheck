package com.dormcheck.app.domain.model

data class CreateStudentRequest(
    val student_id: String,
    val name: String,
    val grade: Int
)
