package com.dormcheck.app.data.api

import com.dormcheck.app.domain.model.CheckinRequest
import com.dormcheck.app.domain.model.CheckinResponse
import com.dormcheck.app.domain.model.DeviceVerifyRequest
import com.dormcheck.app.domain.model.DeviceVerifyResponse
import com.dormcheck.app.domain.model.StudentInfo
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

interface DormCheckApi {

    @POST("/api/checkin")
    suspend fun checkin(
        @Header("X-Device-API-Key") apiKey: String,
        @Body request: CheckinRequest
    ): Response<CheckinResponse>

    @POST("/api/devices/verify")
    suspend fun verifyDevice(
        @Body request: DeviceVerifyRequest
    ): Response<DeviceVerifyResponse>

    @GET("/api/students/lookup")
    suspend fun lookupStudent(
        @Header("X-Device-API-Key") apiKey: String,
        @Query("uid") uid: String? = null,
        @Query("student_id") studentId: String? = null
    ): Response<StudentInfo>
}
