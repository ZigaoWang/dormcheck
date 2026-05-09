package com.dormcheck.app.domain.model

enum class CheckType(val value: String, val displayName: String) {
    MORNING("morning", "晨检"),
    EVENING("evening", "晚检"),
    STUDYHALL("studyhall", "晚自习");

    companion object {
        fun fromValue(value: String): CheckType {
            return values().find { it.value == value } ?: MORNING
        }
    }
}
