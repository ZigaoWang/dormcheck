package com.tally.app.device.thermometer

import android.os.Handler
import android.os.Looper
import com.ubx.tempotgutil.OtgUtils

class ThermometerManager {

    private var otgUtils: OtgUtils? = null
    private val handler = Handler(Looper.getMainLooper())
    private var polling = false
    private var listener: ((Float) -> Unit)? = null

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (!polling) return
            val tempStr = otgUtils?.getrealTemp() ?: return
            val temp = tempStr.toFloatOrNull()
            if (temp != null && temp in 34.0f..42.0f) {
                listener?.invoke(temp)
            }
            handler.postDelayed(this, POLL_INTERVAL)
        }
    }

    fun open(): Boolean {
        return try {
            otgUtils = OtgUtils()
            otgUtils?.open()
            true
        } catch (e: Exception) {
            otgUtils = null
            false
        }
    }

    fun readOnce(): Float? {
        val tempStr = otgUtils?.getrealTemp() ?: return null
        val temp = tempStr.toFloatOrNull() ?: return null
        return if (temp in 34.0f..42.0f) temp else null
    }

    fun startPolling(onTemperatureRead: (Float) -> Unit) {
        listener = onTemperatureRead
        polling = true
        handler.postDelayed(pollRunnable, POLL_INTERVAL)
    }

    fun stopPolling() {
        polling = false
        listener = null
        handler.removeCallbacks(pollRunnable)
    }

    fun release() {
        stopPolling()
        otgUtils = null
    }

    companion object {
        private const val POLL_INTERVAL = 1500L
    }
}
