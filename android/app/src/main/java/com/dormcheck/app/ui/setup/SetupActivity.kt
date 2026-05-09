package com.dormcheck.app.ui.setup

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dormcheck.app.BuildConfig
import com.dormcheck.app.DormCheckApp
import com.dormcheck.app.R
import com.dormcheck.app.data.api.ApiClient
import com.dormcheck.app.databinding.ActivitySetupBinding
import com.dormcheck.app.domain.model.DeviceVerifyRequest
import com.dormcheck.app.ui.checkin.CheckinActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SetupActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySetupBinding
    private val prefs by lazy { DormCheckApp.instance.prefs }

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

        binding.btnConnect.setOnClickListener { attemptConnect() }
    }

    private fun attemptConnect() {
        val url = binding.inputServerUrl.text.toString().trim()
        val key = binding.inputApiKey.text.toString().trim()

        if (url.isBlank()) {
            binding.inputServerUrl.error = "请输入服务器地址"
            return
        }
        if (key.isBlank()) {
            binding.inputApiKey.error = "请输入设备密钥"
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

                    DormCheckApp.instance.repository.refreshApi()

                    Toast.makeText(this@SetupActivity, R.string.setup_success, Toast.LENGTH_SHORT).show()
                    navigateToCheckin()
                } else {
                    val error = response.body()?.message ?: "验证失败 (${response.code()})"
                    binding.textError.text = error
                    binding.textError.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.textError.text = "连接失败: ${e.localizedMessage}"
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
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
    }

    private fun navigateToCheckin() {
        startActivity(Intent(this, CheckinActivity::class.java))
        finish()
    }
}
