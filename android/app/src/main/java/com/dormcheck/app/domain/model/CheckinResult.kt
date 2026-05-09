package com.dormcheck.app.domain.model

sealed class CheckinResult {
    object Idle : CheckinResult()
    object Processing : CheckinResult()
    data class AwaitingTemperature(val uid: String? = null, val studentId: String? = null, val name: String? = null) : CheckinResult()
    data class Success(val response: CheckinResponse) : CheckinResult()
    data class Late(val response: CheckinResponse) : CheckinResult()
    data class Fever(val response: CheckinResponse) : CheckinResult()
    data class Error(val message: String, val uid: String? = null) : CheckinResult()
    data class UnknownCard(val uid: String) : CheckinResult()
    data class Queued(val pendingCount: Int) : CheckinResult()
}
