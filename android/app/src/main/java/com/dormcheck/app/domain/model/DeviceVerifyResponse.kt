package com.dormcheck.app.domain.model

import com.google.gson.annotations.SerializedName

data class DeviceVerifyResponse(
    val ok: Boolean,
    val device: DeviceInfo? = null,
    val message: String? = null
)

data class DeviceInfo(
    val id: String,
    val name: String,
    val house: String? = null
)
