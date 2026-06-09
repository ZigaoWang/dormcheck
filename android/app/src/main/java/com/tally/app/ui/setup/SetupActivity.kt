package com.tally.app.ui.setup

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.tally.app.BuildConfig
import com.tally.app.TallyApp
import com.tally.app.R
import com.tally.app.data.api.ApiClient
import com.tally.app.databinding.ActivitySetupBinding
import com.tally.app.domain.model.DeviceVerifyRequest
import com.tally.app.ui.checkin.CheckinActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SetupActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySetupBinding
    private val prefs by lazy { TallyApp.instance.prefs }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (prefs.isConfigured) {
            navigateToCheckin()
            return
        }

        binding = ActivitySetupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.inputServerUrl.setText(prefs.serverUrl.ifBlank { BuildConfig.API_BASE_URL })
        binding.inputApiKey.setText(prefs.apiKey)
        binding.checkboxThermometer.isChecked = prefs.hasThermometer

        binding.btnConnect.setOnClickListener { attemptConnect() }
    }

    private fun attemptConnect() {
        val url = binding.inputServerUrl.text.toString().trim()
        val key = binding.inputApiKey.text.toString().trim()

        if (url.isBlank()) {
            binding.inputServerUrl.error = "Please enter server URL"
            return
        }
        if (key.isBlank()) {
            binding.inputApiKey.error = "Please enter device key"
            return
        }

        setLoading(true)

        lifecycleScope.launch {
            try {
                val api = ApiClient.createWithUrl(url)
                val response = withContext(Dispatchers.IO) {
                    api.verifyDevice(DeviceVerifyRequest(apiKey = key))
                }

                if (response.isSuccessful && response.body()?.ok == true) {
                    val body = response.body()!!
                    val device = body.device
                    prefs.serverUrl = url
                    prefs.apiKey = key
                    prefs.deviceId = device?.id ?: ""
                    prefs.deviceName = device?.name ?: ""
                    prefs.house = device?.house ?: ""
                    prefs.hasThermometer = binding.checkboxThermometer.isChecked

                    TallyApp.instance.repository.refreshApi()

                    Toast.makeText(this@SetupActivity, R.string.setup_success, Toast.LENGTH_SHORT).show()
                    navigateToCheckin()
                } else {
                    val error = response.body()?.message ?: "Verification failed (${response.code()})"
                    binding.textError.text = error
                    binding.textError.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.textError.text = "Connection failed: ${e.localizedMessage}"
                binding.textError.visibility = View.VISIBLE
            } finally {
                setLoading(false)
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.btnConnect.isEnabled = !loading
        binding.btnConnect.text = getString(
            if (loading) R.string.setup_connecting else R.string.setup_connect
        )
        binding.btnConnect.alpha = if (loading) 0.5f else 1.0f
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
    }

    private fun navigateToCheckin() {
        startActivity(Intent(this, CheckinActivity::class.java))
        finish()
    }
}
