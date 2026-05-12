package com.dormcheck.app.domain.model

enum class CheckType(val value: String, val displayName: String) {
    MORNING("morning", "Morning"),
    EVENING("evening", "Evening"),
    STUDYHALL("studyhall", "Study Hall");

    companion object {
        fun fromValue(value: String): CheckType {
            return values().find { it.value == value } ?: MORNING
        }
    }
}
