package com.dormcheck.app.util

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator

object FeedbackHelper {

    private var toneGenerator: ToneGenerator? = null

    fun init() {
        toneGenerator = try {
            ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
        } catch (e: Exception) {
            null
        }
    }

    fun success(context: Context) {
        vibrate(context, 100)
        toneGenerator?.startTone(ToneGenerator.TONE_PROP_ACK, 150)
    }

    fun warning(context: Context) {
        vibrate(context, 300)
        toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 300)
    }

    fun error(context: Context) {
        vibrate(context, 500)
        toneGenerator?.startTone(ToneGenerator.TONE_CDMA_ABBR_ALERT, 500)
    }

    private fun vibrate(context: Context, durationMs: Long) {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(durationMs)
        }
    }

    fun release() {
        toneGenerator?.release()
        toneGenerator = null
    }
}
