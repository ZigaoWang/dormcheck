package com.dormcheck.app.data.repository

import com.dormcheck.app.data.api.ApiClient
import com.dormcheck.app.data.api.DormCheckApi
import com.dormcheck.app.data.local.PendingCheckin
import com.dormcheck.app.data.local.PendingCheckinDao
import com.dormcheck.app.data.local.PrefsManager
import com.dormcheck.app.domain.model.CheckinRequest
import com.dormcheck.app.domain.model.CheckinResponse
import com.dormcheck.app.domain.model.CheckinResult
import com.dormcheck.app.domain.model.CreateStudentRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class CheckinRepository(
    private var api: DormCheckApi,
    private val dao: PendingCheckinDao,
    private val prefs: PrefsManager
) {

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    fun refreshApi() {
        api = ApiClient.create(prefs)
    }

    suspend fun checkin(uid: String, temperature: Float?): CheckinResult {
        val request = CheckinRequest(
            uid = uid,
            temperature = temperature,
            check_type = prefs.checkType,
            device_id = prefs.deviceId,
            client_timestamp = isoFormat.format(Date())
        )

        return withContext(Dispatchers.IO) {
            try {
                val response = api.checkin(prefs.apiKey, request)
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.ok) {
                        when {
                            body.is_fever -> CheckinResult.Fever(body)
                            body.is_late -> CheckinResult.Late(body)
                            else -> CheckinResult.Success(body)
                        }
                    } else {
                        CheckinResult.Error(body?.error ?: body?.message ?: "未知错误")
                    }
                } else {
                    val errorMsg = when (response.code()) {
                        404 -> "未识别的卡片"
                        401 -> "设备密钥无效"
                        else -> "服务器错误 (${response.code()})"
                    }
                    if (response.code() == 404) {
                        CheckinResult.UnknownCard(uid)
                    } else {
                        enqueue(request)
                        val count = dao.getCount()
                        CheckinResult.Queued(count)
                    }
                }
            } catch (e: Exception) {
                enqueue(request)
                val count = dao.getCount()
                CheckinResult.Queued(count)
            }
        }
    }

    private fun enqueue(request: CheckinRequest) {
        dao.insert(
            PendingCheckin(
                uid = request.uid,
                temperature = request.temperature,
                checkType = request.check_type,
                deviceId = request.device_id,
                clientTimestamp = request.client_timestamp ?: isoFormat.format(Date())
            )
        )
    }

    suspend fun syncPending(): Int {
        return withContext(Dispatchers.IO) {
            dao.deleteStale()
            val pending = dao.getAll()
            var synced = 0
            for (item in pending) {
                try {
                    val request = CheckinRequest(
                        uid = item.uid,
                        temperature = item.temperature,
                        check_type = item.checkType,
                        device_id = item.deviceId,
                        client_timestamp = item.clientTimestamp
                    )
                    val response = api.checkin(prefs.apiKey, request)
                    if (response.isSuccessful || response.code() == 404) {
                        dao.deleteById(item.id)
                        synced++
                    } else {
                        dao.incrementRetry(item.id)
                    }
                } catch (e: Exception) {
                    dao.incrementRetry(item.id)
                    break
                }
            }
            synced
        }
    }

    suspend fun getPendingCount(): Int {
        return withContext(Dispatchers.IO) { dao.getCount() }
    }

    suspend fun checkinByStudentId(studentId: String, temperature: Float?): CheckinResult {
        val request = CheckinRequest(
            uid = "",
            student_id = studentId,
            temperature = temperature,
            check_type = prefs.checkType,
            device_id = prefs.deviceId,
            client_timestamp = isoFormat.format(Date())
        )

        return withContext(Dispatchers.IO) {
            try {
                val response = api.checkin(prefs.apiKey, request)
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.ok) {
                        when {
                            body.is_fever -> CheckinResult.Fever(body)
                            body.is_late -> CheckinResult.Late(body)
                            else -> CheckinResult.Success(body)
                        }
                    } else {
                        CheckinResult.Error(body?.error ?: body?.message ?: "未知错误")
                    }
                } else {
                    CheckinResult.Error("签到失败 (${response.code()})")
                }
            } catch (e: Exception) {
                CheckinResult.Error("网络错误: ${e.localizedMessage}")
            }
        }
    }

    suspend fun bindAndCheckin(uid: String, studentId: String, temperature: Float?): CheckinResult {
        val request = CheckinRequest(
            uid = uid,
            student_id = studentId,
            temperature = temperature,
            check_type = prefs.checkType,
            device_id = prefs.deviceId,
            client_timestamp = isoFormat.format(Date())
        )

        return withContext(Dispatchers.IO) {
            try {
                val response = api.checkin(prefs.apiKey, request)
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.ok) {
                        when {
                            body.is_fever -> CheckinResult.Fever(body)
                            body.is_late -> CheckinResult.Late(body)
                            else -> CheckinResult.Success(body)
                        }
                    } else {
                        CheckinResult.Error(body?.error ?: body?.message ?: "未知错误")
                    }
                } else {
                    CheckinResult.Error("绑定失败 (${response.code()})")
                }
            } catch (e: Exception) {
                CheckinResult.Error("网络错误: ${e.localizedMessage}")
            }
        }
    }

    suspend fun lookupStudent(uid: String? = null, studentId: String? = null): CheckinResult.AwaitingTemperature? {
        return withContext(Dispatchers.IO) {
            try {
                val response = api.lookupStudent(prefs.apiKey, uid, studentId)
                if (response.isSuccessful) {
                    val student = response.body()
                    if (student != null) {
                        CheckinResult.AwaitingTemperature(
                            uid = uid,
                            studentId = student.student_id,
                            name = student.name
                        )
                    } else {
                        null
                    }
                } else {
                    null
                }
            } catch (e: Exception) {
                null
            }
        }
    }

    suspend fun createStudent(studentId: String, name: String, grade: Int): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val response = api.createStudent(
                    prefs.apiKey,
                    CreateStudentRequest(student_id = studentId, name = name, grade = grade)
                )
                response.isSuccessful && response.body()?.ok == true
            } catch (e: Exception) {
                false
            }
        }
    }
}
