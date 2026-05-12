package com.dormcheck.app.ui.checkin

import android.content.Intent
import android.nfc.NfcAdapter
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import com.dormcheck.app.DormCheckApp
import com.dormcheck.app.R
import com.dormcheck.app.databinding.ActivityCheckinBinding
import com.dormcheck.app.device.nfc.CardReader
import com.dormcheck.app.domain.model.CheckType
import com.dormcheck.app.domain.model.CheckinResult
import com.dormcheck.app.ui.setup.SetupActivity
import com.dormcheck.app.util.FeedbackHelper

class CheckinActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCheckinBinding
    private lateinit var viewModel: CheckinViewModel
    private lateinit var cardReader: CardReader

    private var barcodeBuffer = StringBuilder()
    private val tempBuffer = StringBuilder()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCheckinBinding.inflate(layoutInflater)
        setContentView(binding.root)

        viewModel = ViewModelProvider(this).get(CheckinViewModel::class.java)

        FeedbackHelper.init()
        setupCardReader()
        setupBarcodeInput()
        setupUI()
        observeState()

        viewModel.refreshPendingCount()
    }

    private fun setupCardReader() {
        cardReader = CardReader(this)
        cardReader.init()

        if (!cardReader.isAvailable) {
            Toast.makeText(this, R.string.no_nfc, Toast.LENGTH_LONG).show()
            return
        }

        if (!cardReader.isEnabled) {
            AlertDialog.Builder(this)
                .setMessage(R.string.nfc_disabled)
                .setPositiveButton("设置") { _, _ ->
                    startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
                }
                .setNegativeButton("取消", null)
                .show()
        }

        cardReader.setOnCardReadListener { uid ->
            runOnUiThread {
                viewModel.onCardScanned(uid)
            }
        }
    }

    private fun setupBarcodeInput() {
        binding.editBarcode.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                handleBarcodeInput()
                true
            } else false
        }

        binding.editBarcode.setOnKeyListener { _, keyCode, event ->
            if (event.action == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_ENTER) {
                handleBarcodeInput()
                true
            } else false
        }
    }

    private fun handleBarcodeInput() {
        val text = binding.editBarcode.text.toString().trim()
        if (text.isNotEmpty()) {
            binding.editBarcode.setText("")
            viewModel.onStudentIdEntered(text)
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (binding.overlayTemperature.visibility == View.VISIBLE) {
            return super.dispatchKeyEvent(event)
        }

        if (event.action == KeyEvent.ACTION_DOWN) {
            val char = event.unicodeChar.toChar()
            if (char.isDigit()) {
                barcodeBuffer.append(char)
                return true
            } else if (event.keyCode == KeyEvent.KEYCODE_ENTER && barcodeBuffer.isNotEmpty()) {
                val scanned = barcodeBuffer.toString()
                barcodeBuffer.clear()
                viewModel.onStudentIdEntered(scanned)
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun setupUI() {
        val prefs = DormCheckApp.instance.prefs
        binding.textDeviceName.text = getString(R.string.device_name, prefs.deviceName)

        binding.chipGroupCheckType.setOnCheckedChangeListener { _, checkedId ->
            val type = when (checkedId) {
                R.id.chip_morning -> CheckType.MORNING
                R.id.chip_evening -> CheckType.EVENING
                R.id.chip_studyhall -> CheckType.STUDYHALL
                else -> return@setOnCheckedChangeListener
            }
            viewModel.setCheckType(type)
        }

        when (viewModel.checkType.value) {
            CheckType.MORNING -> binding.chipMorning.isChecked = true
            CheckType.EVENING -> binding.chipEvening.isChecked = true
            CheckType.STUDYHALL -> binding.chipStudyhall.isChecked = true
            else -> binding.chipMorning.isChecked = true
        }

        binding.btnSync.setOnClickListener {
            viewModel.syncPending()
            Toast.makeText(this, R.string.syncing, Toast.LENGTH_SHORT).show()
        }

        binding.btnManualInput.setOnClickListener { showManualInputDialog() }
        binding.btnSettings.setOnClickListener { showSettingsDialog() }

        setupTemperatureKeypad()
    }

    private fun setupTemperatureKeypad() {
        val digitClick = { digit: String ->
            if (tempBuffer.length < 4) {
                tempBuffer.append(digit)
                refreshTempDisplay()
            }
        }

        binding.btnNum0.setOnClickListener { digitClick("0") }
        binding.btnNum1.setOnClickListener { digitClick("1") }
        binding.btnNum2.setOnClickListener { digitClick("2") }
        binding.btnNum3.setOnClickListener { digitClick("3") }
        binding.btnNum4.setOnClickListener { digitClick("4") }
        binding.btnNum5.setOnClickListener { digitClick("5") }
        binding.btnNum6.setOnClickListener { digitClick("6") }
        binding.btnNum7.setOnClickListener { digitClick("7") }
        binding.btnNum8.setOnClickListener { digitClick("8") }
        binding.btnNum9.setOnClickListener { digitClick("9") }

        binding.btnNumDot.setOnClickListener {
            if (!tempBuffer.contains(".") && tempBuffer.isNotEmpty() && tempBuffer.length < 4) {
                tempBuffer.append(".")
                refreshTempDisplay()
            }
        }

        binding.btnNumBack.setOnClickListener {
            if (tempBuffer.isNotEmpty()) {
                tempBuffer.deleteCharAt(tempBuffer.length - 1)
                refreshTempDisplay()
            }
        }

        binding.btnTempConfirm.setOnClickListener {
            val temp = tempBuffer.toString().toFloatOrNull()
            if (temp != null && temp in 34.0f..42.0f) {
                hideTemperatureOverlay()
                viewModel.submitTemperature(temp)
            } else {
                Toast.makeText(this, "请输入有效体温 (34.0-42.0)", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnTempCancel.setOnClickListener {
            hideTemperatureOverlay()
            viewModel.cancelTemperatureInput()
        }
    }

    private fun refreshTempDisplay() {
        binding.textTempDisplay.text = if (tempBuffer.isEmpty()) "--.-" else tempBuffer.toString()
        binding.textTempDisplay.setTextColor(
            if (tempBuffer.isEmpty()) getColor(R.color.text_secondary)
            else getColor(R.color.text_primary)
        )
    }

    private fun observeState() {
        viewModel.state.observe(this) { result ->
            if (result !is CheckinResult.AwaitingTemperature && binding.overlayTemperature.visibility == View.VISIBLE) {
                hideTemperatureOverlay()
            }
            when (result) {
                is CheckinResult.Idle -> showIdle()
                is CheckinResult.Processing -> showProcessing()
                is CheckinResult.AwaitingTemperature -> showTemperatureInput(result)
                is CheckinResult.StudentNotFound -> showStudentNotFound(result)
                is CheckinResult.Success -> showSuccess(result)
                is CheckinResult.Late -> showLate(result)
                is CheckinResult.Fever -> showFever(result)
                is CheckinResult.Error -> showError(result)
                is CheckinResult.UnknownCard -> showUnknownCard(result)
                is CheckinResult.Queued -> showQueued(result)
            }
        }

        viewModel.pendingCount.observe(this) { count ->
            binding.textStatQueued.text = count.toString()
            binding.btnSync.visibility = if (count > 0) View.VISIBLE else View.GONE
        }

        viewModel.todayCount.observe(this) { binding.textStatChecked.text = it.toString() }
        viewModel.lateCount.observe(this) { binding.textStatLate.text = it.toString() }
        viewModel.feverCount.observe(this) { binding.textStatFever.text = it.toString() }
    }

    private fun showIdle() {
        binding.cardResult.setCardBackgroundColor(getColor(R.color.card_background))
        binding.textStatus.text = getString(R.string.checkin_ready)
        binding.textStatus.setTextColor(getColor(R.color.text_primary))
        binding.textStudentName.text = ""
        binding.textStudentInfo.text = ""
        binding.iconStatus.setImageResource(R.drawable.ic_card_scan)
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setOnClickListener(null)
    }

    private fun showProcessing() {
        binding.progressCheckin.visibility = View.VISIBLE
        binding.textStatus.text = getString(R.string.checkin_processing)
        binding.cardResult.setOnClickListener(null)
    }

    private fun showTemperatureInput(result: CheckinResult.AwaitingTemperature) {
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setCardBackgroundColor(getColor(R.color.card_background))
        binding.textStatus.text = getString(R.string.checkin_awaiting_temp)
        binding.textStatus.setTextColor(getColor(R.color.primary))
        binding.textStudentName.text = result.name ?: result.studentId ?: result.uid ?: ""
        binding.textStudentInfo.text = ""
        binding.iconStatus.setImageResource(R.drawable.ic_card_scan)

        showTemperatureOverlay(result)
    }

    private fun showTemperatureOverlay(result: CheckinResult.AwaitingTemperature) {
        val displayName = result.name ?: result.studentId ?: result.uid ?: ""
        binding.textTempStudentName.text = displayName

        if (result.studentId != null && result.name != null) {
            binding.textTempStudentId.text = result.studentId
            binding.textTempStudentId.visibility = View.VISIBLE
        } else {
            binding.textTempStudentId.visibility = View.GONE
        }

        tempBuffer.clear()
        refreshTempDisplay()
        binding.overlayTemperature.visibility = View.VISIBLE
        binding.overlayTemperature.alpha = 0f
        binding.overlayTemperature.animate().alpha(1f).setDuration(150).start()
    }

    private fun hideTemperatureOverlay() {
        tempBuffer.clear()
        binding.overlayTemperature.animate().alpha(0f).setDuration(120).withEndAction {
            binding.overlayTemperature.visibility = View.GONE
            refreshTempDisplay()
        }.start()
    }

    private fun showSuccess(result: CheckinResult.Success) {
        FeedbackHelper.success(this)
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setCardBackgroundColor(getColor(R.color.success_light))
        binding.textStatus.text = getString(R.string.checkin_success)
        binding.textStatus.setTextColor(getColor(R.color.success))
        binding.textStudentName.text = result.response.name ?: ""
        binding.textStudentInfo.text = buildStudentInfo(result.response.grade, result.response.student_id)
        binding.iconStatus.setImageResource(R.drawable.ic_check_circle)
    }

    private fun showLate(result: CheckinResult.Late) {
        FeedbackHelper.warning(this)
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setCardBackgroundColor(getColor(R.color.warning_light))
        binding.textStatus.text = getString(R.string.checkin_late)
        binding.textStatus.setTextColor(getColor(R.color.warning))
        binding.textStudentName.text = result.response.name ?: ""
        binding.textStudentInfo.text = buildStudentInfo(result.response.grade, result.response.student_id)
        binding.iconStatus.setImageResource(R.drawable.ic_warning)
    }

    private fun showFever(result: CheckinResult.Fever) {
        FeedbackHelper.error(this)
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setCardBackgroundColor(getColor(R.color.error_light))
        binding.textStatus.text = getString(R.string.checkin_fever)
        binding.textStatus.setTextColor(getColor(R.color.error))
        binding.textStudentName.text = result.response.name ?: ""
        binding.textStudentInfo.text = buildStudentInfo(result.response.grade, result.response.student_id)
        binding.iconStatus.setImageResource(R.drawable.ic_fever)
    }

    private fun showError(result: CheckinResult.Error) {
        FeedbackHelper.error(this)
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setCardBackgroundColor(getColor(R.color.error_light))
        binding.textStatus.text = result.message
        binding.textStatus.setTextColor(getColor(R.color.error))
        binding.textStudentName.text = ""
        binding.textStudentInfo.text = ""
        binding.iconStatus.setImageResource(R.drawable.ic_error)
    }

    private fun showStudentNotFound(result: CheckinResult.StudentNotFound) {
        FeedbackHelper.warning(this)
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setCardBackgroundColor(getColor(R.color.warning_light))
        binding.textStatus.text = "学生不存在"
        binding.textStatus.setTextColor(getColor(R.color.warning))
        binding.textStudentName.text = result.studentId
        binding.textStudentInfo.text = "点击添加学生"
        binding.iconStatus.setImageResource(R.drawable.ic_warning)

        binding.cardResult.setOnClickListener {
            showAddStudentDialog(result.studentId, result.uid)
        }
    }

    private fun showAddStudentDialog(studentId: String, uid: String?) {
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 32, 48, 16)
        }

        val nameInput = EditText(this).apply {
            hint = "姓名"
            setPadding(24, 24, 24, 24)
            textSize = 18f
        }
        layout.addView(nameInput)

        val gradeInput = EditText(this).apply {
            hint = "年级 (如 9, 10, 11, 12)"
            setPadding(24, 24, 24, 24)
            textSize = 18f
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }
        layout.addView(gradeInput)

        AlertDialog.Builder(this)
            .setTitle("添加学生")
            .setMessage("学号: $studentId")
            .setView(layout)
            .setPositiveButton("添加") { _, _ ->
                val name = nameInput.text.toString().trim()
                val grade = gradeInput.text.toString().trim().toIntOrNull()
                if (name.isNotBlank() && grade != null && grade in 7..12) {
                    binding.cardResult.setOnClickListener(null)
                    viewModel.createStudentAndProceed(studentId, name, grade)
                } else {
                    Toast.makeText(this, "请输入有效的姓名和年级", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("取消") { _, _ ->
                binding.cardResult.setOnClickListener(null)
                viewModel.dismissStudentNotFound()
            }
            .setCancelable(false)
            .show()
    }

    private fun showUnknownCard(result: CheckinResult.UnknownCard) {
        FeedbackHelper.warning(this)
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setCardBackgroundColor(getColor(R.color.warning_light))
        binding.textStatus.text = "未绑定卡片"
        binding.textStatus.setTextColor(getColor(R.color.warning))
        binding.textStudentName.text = "UID: ${result.uid}"
        binding.textStudentInfo.text = "点击屏幕绑定学生"
        binding.iconStatus.setImageResource(R.drawable.ic_warning)

        binding.cardResult.setOnClickListener {
            showBindDialog(result.uid)
        }
    }

    private fun showBindDialog(uid: String) {
        val input = EditText(this).apply {
            hint = "输入学号 (如 22341)"
            setPadding(48, 32, 48, 32)
            textSize = 18f
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }

        AlertDialog.Builder(this)
            .setTitle("绑定卡片")
            .setMessage("卡片 UID: $uid\n请输入该学生的学号:")
            .setView(input)
            .setPositiveButton("绑定并签到") { _, _ ->
                val studentId = input.text.toString().trim()
                if (studentId.isNotBlank()) {
                    binding.cardResult.setOnClickListener(null)
                    viewModel.bindCard(studentId)
                }
            }
            .setNegativeButton("取消") { _, _ ->
                binding.cardResult.setOnClickListener(null)
                viewModel.dismissUnknownCard()
            }
            .setCancelable(false)
            .show()
    }

    private fun showManualInputDialog() {
        val input = EditText(this).apply {
            hint = "输入学号 (如 22341)"
            setPadding(48, 32, 48, 32)
            textSize = 24f
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }

        AlertDialog.Builder(this)
            .setTitle("手动输入学号")
            .setView(input)
            .setPositiveButton("确认") { _, _ ->
                val studentId = input.text.toString().trim()
                if (studentId.isNotBlank()) {
                    viewModel.onStudentIdEntered(studentId)
                }
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun showQueued(result: CheckinResult.Queued) {
        FeedbackHelper.warning(this)
        binding.progressCheckin.visibility = View.GONE
        binding.cardResult.setCardBackgroundColor(getColor(R.color.warning_light))
        binding.textStatus.text = getString(R.string.checkin_network_error)
        binding.textStatus.setTextColor(getColor(R.color.warning))
        binding.textStudentName.text = getString(R.string.checkin_queued, result.pendingCount)
        binding.textStudentInfo.text = ""
        binding.iconStatus.setImageResource(R.drawable.ic_offline)
    }

    private fun buildStudentInfo(grade: Int?, studentId: String?): String {
        val parts = mutableListOf<String>()
        grade?.let { parts.add("${it}年级") }
        studentId?.let { parts.add(it) }
        return parts.joinToString(" · ")
    }

    private fun showSettingsDialog() {
        val items = arrayOf("重新配置设备", "关于")
        AlertDialog.Builder(this)
            .setTitle(R.string.settings)
            .setItems(items) { _, which ->
                when (which) {
                    0 -> {
                        DormCheckApp.instance.prefs.clear()
                        startActivity(Intent(this, SetupActivity::class.java))
                        finish()
                    }
                    1 -> {
                        AlertDialog.Builder(this)
                            .setTitle("宿舍签到 v1.0.0")
                            .setMessage("Urovo i6310 PDA\n晨检/晚检签到系统")
                            .setPositiveButton("确定", null)
                            .show()
                    }
                }
            }
            .show()
    }

    override fun onResume() {
        super.onResume()
        cardReader.enableForegroundDispatch()
        viewModel.syncPending()
    }

    override fun onPause() {
        super.onPause()
        cardReader.disableForegroundDispatch()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        cardReader.handleIntent(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        FeedbackHelper.release()
    }
}
