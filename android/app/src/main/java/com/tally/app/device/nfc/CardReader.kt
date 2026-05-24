package com.tally.app.device.nfc

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.NfcA

class CardReader(private val activity: Activity) {

    private var nfcAdapter: NfcAdapter? = null
    private var onCardRead: ((String) -> Unit)? = null

    val isAvailable: Boolean
        get() = nfcAdapter != null

    val isEnabled: Boolean
        get() = nfcAdapter?.isEnabled == true

    fun init() {
        nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
    }

    fun setOnCardReadListener(listener: (String) -> Unit) {
        onCardRead = listener
    }

    fun enableForegroundDispatch() {
        val adapter = nfcAdapter ?: return
        val intent = Intent(activity, activity.javaClass).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            activity, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT
        )
        val filters = arrayOf(
            IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED),
            IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED)
        )
        val techLists = arrayOf(
            arrayOf(NfcA::class.java.name),
            arrayOf(MifareClassic::class.java.name),
            arrayOf(IsoDep::class.java.name)
        )
        adapter.enableForegroundDispatch(activity, pendingIntent, filters, techLists)
    }

    fun disableForegroundDispatch() {
        nfcAdapter?.disableForegroundDispatch(activity)
    }

    fun handleIntent(intent: Intent): Boolean {
        val action = intent.action ?: return false
        if (action != NfcAdapter.ACTION_TECH_DISCOVERED &&
            action != NfcAdapter.ACTION_TAG_DISCOVERED &&
            action != NfcAdapter.ACTION_NDEF_DISCOVERED
        ) {
            return false
        }

        val tag = intent.getParcelableExtra<Tag>(NfcAdapter.EXTRA_TAG) ?: return false
        val uid = tag.id.toHexString()
        onCardRead?.invoke(uid)
        return true
    }

    private fun ByteArray.toHexString(): String {
        return joinToString("") { "%02X".format(it) }
    }
}
