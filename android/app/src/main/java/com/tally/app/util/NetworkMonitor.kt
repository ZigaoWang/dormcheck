package com.tally.app.util

import android.os.Handler
import android.os.Looper
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class NetworkMonitor(private val serverUrl: String) {

    private val _isConnected = MutableLiveData<Boolean>()
    val isConnected: LiveData<Boolean> = _isConnected

    private val handler = Handler(Looper.getMainLooper())
    private var running = false

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    private val checkRunnable = object : Runnable {
        override fun run() {
            if (!running) return
            Thread {
                val reachable = pingServer()
                _isConnected.postValue(reachable)
            }.start()
            handler.postDelayed(this, PING_INTERVAL_MS)
        }
    }

    private fun pingServer(): Boolean {
        if (serverUrl.isBlank()) return false
        return try {
            val url = serverUrl.trimEnd('/') + "/api/health"
            val request = Request.Builder().url(url).get().build()
            val response = client.newCall(request).execute()
            val ok = response.code == 200
            response.close()
            ok
        } catch (_: Exception) {
            false
        }
    }

    fun start() {
        running = true
        Thread {
            val reachable = pingServer()
            _isConnected.postValue(reachable)
        }.start()
        handler.postDelayed(checkRunnable, PING_INTERVAL_MS)
    }

    fun stop() {
        running = false
        handler.removeCallbacks(checkRunnable)
    }

    companion object {
        private const val PING_INTERVAL_MS = 5_000L
    }
}
