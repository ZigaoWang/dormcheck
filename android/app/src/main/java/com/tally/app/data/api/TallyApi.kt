package com.tally.app.data.api

import com.tally.app.domain.model.CheckinRequest
import com.tally.app.domain.model.CheckinResponse
import com.tally.app.domain.model.CreateStudentRequest
import com.tally.app.domain.model.CreateStudentResponse
import com.tally.app.domain.model.DeviceVerifyRequest
import com.tally.app.domain.model.DeviceVerifyResponse
import com.tally.app.domain.model.StudentInfo
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Query

interface TallyApi {

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

    @POST("/api/students/create")
    suspend fun createStudent(
        @Header("X-Device-API-Key") apiKey: String,
        @Body request: CreateStudentRequest
    ): Response<CreateStudentResponse>

    @GET("/api/lockers/lookup")
    suspend fun lookupLocker(
        @Header("X-Device-API-Key") apiKey: String,
        @Query("student_id") studentId: String
    ): Response<LockerInfo>

    @Multipart
    @POST("/api/upload")
    suspend fun uploadPhoto(
        @Header("X-Device-API-Key") apiKey: String,
        @Part photo: MultipartBody.Part,
        @Part("student_id") studentId: okhttp3.RequestBody
    ): Response<UploadResponse>

    @POST("/api/students/bind")
    suspend fun bindCard(
        @Header("X-Device-API-Key") apiKey: String,
        @Body request: BindCardRequest
    ): Response<Any>

    @POST("/api/lockers")
    suspend fun createLocker(
        @Header("X-Device-API-Key") apiKey: String,
        @Body request: CreateLockerRequest
    ): Response<Any>
}

data class BindCardRequest(
    val student_id: String,
    val uid: String
)

data class CreateLockerRequest(
    val studentId: String,
    val hasPhone: Boolean,
    val hasLaptop: Boolean,
    val hasIpad: Boolean
)
