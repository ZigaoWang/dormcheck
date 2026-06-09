package com.tally.app.data.local

import android.content.Context
import android.content.SharedPreferences

class PrefsManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "") ?: ""
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value.trimEnd('/')).apply()

    var apiKey: String
        get() = prefs.getString(KEY_API_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_API_KEY, value.trim()).apply()

    var deviceId: String
        get() = prefs.getString(KEY_DEVICE_ID, "") ?: ""
        set(value) = prefs.edit().putString(KEY_DEVICE_ID, value).apply()

    var deviceName: String
        get() = prefs.getString(KEY_DEVICE_NAME, "") ?: ""
        set(value) = prefs.edit().putString(KEY_DEVICE_NAME, value).apply()

    var house: String
        get() = prefs.getString(KEY_HOUSE, "") ?: ""
        set(value) = prefs.edit().putString(KEY_HOUSE, value).apply()

    var checkType: String
        get() = prefs.getString(KEY_CHECK_TYPE, "morning") ?: "morning"
        set(value) = prefs.edit().putString(KEY_CHECK_TYPE, value).apply()

    var hasThermometer: Boolean
        get() = prefs.getBoolean(KEY_HAS_THERMOMETER, false)
        set(value) = prefs.edit().putBoolean(KEY_HAS_THERMOMETER, value).apply()

    val isConfigured: Boolean
        get() = serverUrl.isNotBlank() && apiKey.isNotBlank() && deviceId.isNotBlank()

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "tally_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_API_KEY = "api_key"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DEVICE_NAME = "device_name"
        private const val KEY_HOUSE = "house"
        private const val KEY_CHECK_TYPE = "check_type"
        private const val KEY_HAS_THERMOMETER = "has_thermometer"
    }
}
