package com.tally.app.ui.checkin

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModelProvider
import com.tally.app.TallyApp
import com.tally.app.R
import com.tally.app.databinding.ActivityCheckinBinding
import com.tally.app.device.nfc.CardReader
import com.tally.app.device.thermometer.ThermometerManager
import com.tally.app.domain.model.CheckType
import com.tally.app.domain.model.CheckinResult
import com.tally.app.ui.setup.SetupActivity
import com.tally.app.util.FeedbackHelper
import com.tally.app.util.NetworkMonitor
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CheckinActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCheckinBinding
    private lateinit var viewModel: CheckinViewModel
    private lateinit var cardReader: CardReader
    private lateinit var thermometer: ThermometerManager
    private lateinit var networkMonitor: NetworkMonitor

    private var barcodeBuffer = StringBuilder()
    private val tempBuffer = StringBuilder()
    private val idBuffer = StringBuilder()
    private var thermometerAvailable = false
    private var isBindMode = false

    private var photoFile: File? = null
    private var techPhoneHandedIn = true
    private var techLaptopHandedIn = true
    private var techIpadHandedIn = false

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success && photoFile != null) {
            viewModel.submitTechHandin(photoFile!!, techPhoneHandedIn, techLaptopHandedIn, techIpadHandedIn)
        } else {
            Toast.makeText(this, "Photo cancelled", Toast.LENGTH_SHORT).show()
        }
        hideTechHandinOverlay()
    }

    private val cameraPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            launchCamera()
        } else {
            Toast.makeText(this, "Camera permission required", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCheckinBinding.inflate(layoutInflater)
        setContentView(binding.root)

        viewModel = ViewModelProvider(this).get(CheckinViewModel::class.java)

        FeedbackHelper.init()
        setupCardReader()
        setupThermometer()
        setupBarcodeInput()
        setupUI()
        setupNetworkMonitor()
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
                .setPositiveButton("Settings") { _, _ ->
                    startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        cardReader.setOnCardReadListener { uid ->
            runOnUiThread {
                viewModel.onCardScanned(uid)
            }
        }
    }

    private fun setupThermometer() {
        thermometer = ThermometerManager()
        thermometerAvailable = thermometer.open()
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
            if (event.action == KeyEvent.ACTION_DOWN && isScanKey(event.keyCode)) {
                triggerThermometerRead()
                return true
            }
            return super.dispatchKeyEvent(event)
        }

        if (binding.overlayManualId.visibility == View.VISIBLE) {
            return super.dispatchKeyEvent(event)
        }

        if (binding.overlayTechHandin.visibility == View.VISIBLE) {
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

    private fun isScanKey(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_F1 ||
                keyCode == KeyEvent.KEYCODE_F2 ||
                keyCode == KeyEvent.KEYCODE_F3 ||
                keyCode == KEYCODE_SCAN_LEFT ||
                keyCode == KEYCODE_SCAN_RIGHT
    }

    private fun triggerThermometerRead() {
        if (!thermometerAvailable) return
        binding.textTempStatus.text = "Measuring…"
        binding.textTempStatus.setTextColor(getColor(R.color.text_primary))
        binding.textTempHint.text = "Reading…"

        val temp = thermometer.readOnce()
        if (temp != null) {
            tempBuffer.clear()
            tempBuffer.append(String.format("%.1f", temp))
            refreshTempDisplay()
            FeedbackHelper.success(this)
        } else {
            binding.textTempHint.text = "No reading, try again"
            binding.textTempStatus.text = "Read failed"
            binding.textTempStatus.setTextColor(getColor(R.color.error))
            FeedbackHelper.warning(this)
        }
    }

    private fun setupUI() {
        val prefs = TallyApp.instance.prefs
        val house = if (prefs.house.isNotBlank()) " · ${prefs.house}" else ""
        binding.textDeviceName.text = "${prefs.deviceName}${house}"

        updateModeDisplay()
        binding.textMode.setOnClickListener { showModeSelector() }
        binding.btnManualInput.setOnClickListener { showManualIdOverlay() }
        binding.btnBindCard.setOnClickListener { showBindCardOverlay() }
        binding.btnSettings.setOnClickListener { showSettingsDialog() }

        setupTemperatureKeypad()
        setupIdKeypad()
    }

    private fun updateModeDisplay() {
        val label = when (viewModel.checkType.value) {
            CheckType.STUDYHALL -> "Study Hall ▾"
            CheckType.TECH_HANDIN -> "Tech Hand-in ▾"
            else -> "Morning ▾"
        }
        binding.textMode.text = label
    }

    private fun showModeSelector() {
        val modes = arrayOf("Morning", "Study Hall", "Tech Hand-in")
        val current = when (viewModel.checkType.value) {
            CheckType.STUDYHALL -> 1
            CheckType.TECH_HANDIN -> 2
            else -> 0
        }
        AlertDialog.Builder(this)
            .setTitle("Check Mode")
            .setSingleChoiceItems(modes, current) { dialog, which ->
                val type = when (which) {
                    1 -> CheckType.STUDYHALL
                    2 -> CheckType.TECH_HANDIN
                    else -> CheckType.MORNING
                }
                viewModel.setCheckType(type)
                updateModeDisplay()
                dialog.dismiss()
            }
            .show()
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
                Toast.makeText(this, "Enter a valid temperature (34.0-42.0)", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnTempCancel.setOnClickListener {
            hideTemperatureOverlay()
            viewModel.cancelTemperatureInput()
        }

        binding.btnTempManual.setOnClickListener {
            thermometer.stopPolling()
            tempBuffer.clear()
            binding.gridNumpad.visibility = View.VISIBLE
            binding.btnTempManual.visibility = View.GONE
            binding.textTempHint.text = "Enter manually"
            binding.textTempStatus.text = "Enter temperature"
            binding.textTempStatus.setTextColor(getColor(R.color.text_secondary))
            refreshTempDisplay()
        }
    }

    private fun refreshTempDisplay() {
        val tempStr = tempBuffer.toString()
        val temp = tempStr.toFloatOrNull()

        binding.textTempDisplay.text = if (tempBuffer.isEmpty()) "--.-" else tempStr

        if (temp != null && temp in 34.0f..42.0f) {
            when {
                temp >= 37.3f -> {
                    binding.textTempDisplay.setTextColor(getColor(R.color.error))
                    binding.textTempStatus.text = "FEVER"
                    binding.textTempStatus.setTextColor(getColor(R.color.error))
                    binding.layoutTempReading.setBackgroundColor(getColor(R.color.background))
                }
                temp >= 37.0f -> {
                    binding.textTempDisplay.setTextColor(getColor(R.color.warning))
                    binding.textTempStatus.text = "ELEVATED"
                    binding.textTempStatus.setTextColor(getColor(R.color.warning))
                    binding.layoutTempReading.setBackgroundColor(getColor(R.color.background))
                }
                else -> {
                    binding.textTempDisplay.setTextColor(getColor(R.color.success))
                    binding.textTempStatus.text = "NORMAL"
                    binding.textTempStatus.setTextColor(getColor(R.color.success))
                    binding.layoutTempReading.setBackgroundColor(getColor(R.color.background))
                }
            }
        } else {
            binding.textTempDisplay.setTextColor(getColor(R.color.text_primary))
            binding.textTempStatus.text = if (thermometerAvailable) "Measuring…" else "Enter temperature"
            binding.textTempStatus.setTextColor(getColor(R.color.text_secondary))
            binding.layoutTempReading.setBackgroundColor(getColor(R.color.background))
        }
    }

    private fun observeState() {
        viewModel.state.observe(this) { result ->
            if (result !is CheckinResult.AwaitingTemperature && binding.overlayTemperature.visibility == View.VISIBLE) {
                hideTemperatureOverlay()
            }
            if (result !is CheckinResult.AwaitingTechHandin && binding.overlayTechHandin.visibility == View.VISIBLE) {
                hideTechHandinOverlay()
            }
            when (result) {
                is CheckinResult.Idle -> showIdle()
                is CheckinResult.Processing -> showProcessing()
                is CheckinResult.AwaitingTemperature -> showTemperatureInput(result)
                is CheckinResult.AwaitingTechHandin -> showTechHandinPrompt(result)
                is CheckinResult.StudentNotFound -> showStudentNotFound(result)
                is CheckinResult.Success -> showSuccess(result)
                is CheckinResult.Late -> showLate(result)
                is CheckinResult.Fever -> showFever(result)
                is CheckinResult.Error -> showError(result)
                is CheckinResult.UnknownCard -> showUnknownCard(result)
                is CheckinResult.Queued -> showQueued(result)
            }
        }

        viewModel.pendingCount.observe(this) { }
        viewModel.todayCount.observe(this) { }
        viewModel.lateCount.observe(this) { }
        viewModel.feverCount.observe(this) { }
    }

    // --- State display methods ---

    private fun showIdle() {
        binding.mainContent.setBackgroundColor(getColor(R.color.background))
        binding.areaResult.setBackgroundColor(getColor(R.color.background))
        binding.textStudentName.text = "READY"
        binding.textStudentName.setTextColor(getColor(R.color.text_secondary))
        binding.textStatus.text = "Scan or enter ID"
        binding.textStatus.setTextColor(getColor(R.color.text_secondary))
        binding.textStudentInfo.text = ""
        binding.progressCheckin.visibility = View.GONE
        binding.areaResult.setOnClickListener(null)
        binding.textFooter.setTextColor(getColor(R.color.text_secondary))
        binding.dividerManual.visibility = View.VISIBLE
        binding.btnManualInput.visibility = View.VISIBLE
        binding.btnBindCard.visibility = View.GONE
    }

    private fun showProcessing() {
        binding.textStudentName.text = ""
        binding.textStatus.text = ""
        binding.textStudentInfo.text = ""
        binding.progressCheckin.visibility = View.VISIBLE
        binding.areaResult.setOnClickListener(null)
        binding.dividerManual.visibility = View.GONE
        binding.btnManualInput.visibility = View.GONE
    }

    private fun showTemperatureInput(result: CheckinResult.AwaitingTemperature) {
        binding.progressCheckin.visibility = View.GONE
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
        binding.layoutTempReading.setBackgroundColor(getColor(R.color.background))
        refreshTempDisplay()

        if (thermometerAvailable) {
            binding.gridNumpad.visibility = View.GONE
            binding.btnTempManual.visibility = View.VISIBLE
            binding.textTempHint.text = "Press scan key to measure"
        } else {
            binding.gridNumpad.visibility = View.VISIBLE
            binding.btnTempManual.visibility = View.GONE
            binding.textTempHint.text = "Enter manually"
        }

        binding.overlayTemperature.visibility = View.VISIBLE
    }

    private fun hideTemperatureOverlay() {
        tempBuffer.clear()
        binding.overlayTemperature.visibility = View.GONE
        refreshTempDisplay()
    }

    private fun showSuccess(result: CheckinResult.Success) {
        FeedbackHelper.success(this)
        setResultState(R.color.success)
        binding.textStudentName.text = result.response.name ?: ""
        binding.textStatus.text = "ON TIME"
        binding.textStudentInfo.text = buildStudentInfo(result.response.grade, result.response.student_id)
    }

    private fun showLate(result: CheckinResult.Late) {
        FeedbackHelper.warning(this)
        setResultState(R.color.warning)
        binding.textStudentName.text = result.response.name ?: ""
        binding.textStatus.text = "LATE"
        binding.textStudentInfo.text = buildStudentInfo(result.response.grade, result.response.student_id)
    }

    private fun showFever(result: CheckinResult.Fever) {
        FeedbackHelper.error(this)
        setResultState(R.color.error)
        binding.textStudentName.text = result.response.name ?: ""
        binding.textStatus.text = "FEVER"
        binding.textStudentInfo.text = buildStudentInfo(result.response.grade, result.response.student_id)
    }

    private fun showError(result: CheckinResult.Error) {
        FeedbackHelper.error(this)
        setResultState(R.color.neutral_dark)
        binding.textStudentName.text = result.message
        binding.textStatus.text = "ERROR"
        binding.textStudentInfo.text = ""
    }

    private fun showStudentNotFound(result: CheckinResult.StudentNotFound) {
        FeedbackHelper.warning(this)
        setResultState(R.color.warning)
        binding.textStudentName.text = result.studentId
        binding.textStatus.text = "NOT FOUND"
        binding.textStudentInfo.text = ""
    }

    private fun showUnknownCard(result: CheckinResult.UnknownCard) {
        FeedbackHelper.warning(this)
        setResultState(R.color.neutral_dark)
        binding.textStudentName.text = "UID: ${result.uid}"
        binding.textStatus.text = "UNBOUND CARD"
        binding.textStudentInfo.text = ""
        binding.dividerManual.visibility = View.VISIBLE
        binding.btnBindCard.visibility = View.VISIBLE
        binding.btnManualInput.visibility = View.GONE
    }

    private fun showQueued(result: CheckinResult.Queued) {
        FeedbackHelper.warning(this)
        setResultState(R.color.neutral_dark)
        binding.textStudentName.text = getString(R.string.checkin_queued, result.pendingCount)
        binding.textStatus.text = "OFFLINE"
        binding.textStudentInfo.text = ""
    }

    private fun setResultState(colorRes: Int) {
        binding.progressCheckin.visibility = View.GONE
        binding.mainContent.setBackgroundColor(getColor(colorRes))
        binding.areaResult.setBackgroundColor(getColor(colorRes))
        binding.textStudentName.setTextColor(getColor(R.color.white))
        binding.textStatus.setTextColor(getColor(R.color.white))
        binding.textStudentInfo.setTextColor(0xB3FFFFFF.toInt())
        binding.textFooter.setTextColor(0x66FFFFFF)
        binding.areaResult.setOnClickListener(null)
        binding.dividerManual.visibility = View.GONE
        binding.btnManualInput.visibility = View.GONE
        binding.btnBindCard.visibility = View.GONE
    }

    // --- Dialogs ---

    private fun showManualIdOverlay() {
        isBindMode = false
        idBuffer.clear()
        refreshIdDisplay()
        binding.overlayManualId.visibility = View.VISIBLE
    }

    private fun showBindCardOverlay() {
        isBindMode = true
        idBuffer.clear()
        refreshIdDisplay()
        binding.overlayManualId.visibility = View.VISIBLE
    }

    private fun hideManualIdOverlay() {
        idBuffer.clear()
        binding.overlayManualId.visibility = View.GONE
    }

    private fun refreshIdDisplay() {
        binding.textIdDisplay.text = if (idBuffer.isEmpty()) "—" else idBuffer.toString()
    }

    private fun setupIdKeypad() {
        val digitClick = { digit: String ->
            if (idBuffer.length < 5) {
                idBuffer.append(digit)
                refreshIdDisplay()
            }
        }

        binding.btnId0.setOnClickListener { digitClick("0") }
        binding.btnId1.setOnClickListener { digitClick("1") }
        binding.btnId2.setOnClickListener { digitClick("2") }
        binding.btnId3.setOnClickListener { digitClick("3") }
        binding.btnId4.setOnClickListener { digitClick("4") }
        binding.btnId5.setOnClickListener { digitClick("5") }
        binding.btnId6.setOnClickListener { digitClick("6") }
        binding.btnId7.setOnClickListener { digitClick("7") }
        binding.btnId8.setOnClickListener { digitClick("8") }
        binding.btnId9.setOnClickListener { digitClick("9") }

        binding.btnIdBack.setOnClickListener {
            if (idBuffer.isNotEmpty()) {
                idBuffer.deleteCharAt(idBuffer.length - 1)
                refreshIdDisplay()
            }
        }

        binding.btnIdClear.setOnClickListener {
            idBuffer.clear()
            refreshIdDisplay()
        }

        binding.btnIdConfirm.setOnClickListener {
            val id = idBuffer.toString().trim()
            if (id.length == 5) {
                hideManualIdOverlay()
                if (isBindMode) {
                    isBindMode = false
                    viewModel.bindCard(id)
                } else {
                    viewModel.onStudentIdEntered(id)
                }
            } else {
                Toast.makeText(this, "Enter 5-digit student ID", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnIdCancel.setOnClickListener {
            hideManualIdOverlay()
        }
    }

    private fun buildStudentInfo(grade: Int?, studentId: String?): String {
        val parts = mutableListOf<String>()
        grade?.let { parts.add("Grade $it") }
        studentId?.let { parts.add(it) }
        return parts.joinToString(" · ")
    }

    private fun showSettingsDialog() {
        val items = arrayOf("Reconfigure Device", "About")
        AlertDialog.Builder(this)
            .setTitle(R.string.settings)
            .setItems(items) { _, which ->
                when (which) {
                    0 -> {
                        TallyApp.instance.prefs.clear()
                        startActivity(Intent(this, SetupActivity::class.java))
                        finish()
                    }
                    1 -> {
                        AlertDialog.Builder(this)
                            .setTitle("tally · Version 0.1.0-beta")
                            .setMessage(
                                "Engineered by Zigao Wang.\n\n" +
                                "Copyright © 2026 Zigao Wang. All rights reserved. Developed for YK Pao School. " +
                                "This software is provided \"as is\", without warranty of any kind, express or implied, " +
                                "including but not limited to the warranties of merchantability, fitness for a particular " +
                                "purpose, and noninfringement. In no event shall the author be liable for any claim, " +
                                "damages, or other liability arising from the use of this software.\n\n" +
                                "The source code is publicly available on GitHub. For technical inquiries, please contact a@zigao.wang.\n\n" +
                                "zigao.wang\ngithub.com/ZigaoWang/tally"
                            )
                            .setPositiveButton("OK", null)
                            .show()
                    }
                }
            }
            .show()
    }

    private fun showTechHandinPrompt(result: CheckinResult.AwaitingTechHandin) {
        binding.progressCheckin.visibility = View.GONE

        if (result.isFirstTime) {
            showFirstTimeLockerSetup(result)
            return
        }

        binding.textTechStudentName.text = result.name ?: result.studentId ?: ""
        binding.textTechStudentId.text = result.studentId ?: ""

        binding.cbTechPhone.isChecked = result.hasPhone
        binding.cbTechPhone.visibility = if (result.hasPhone) View.VISIBLE else View.GONE
        binding.cbTechLaptop.isChecked = result.hasLaptop
        binding.cbTechLaptop.visibility = if (result.hasLaptop) View.VISIBLE else View.GONE
        binding.cbTechIpad.isChecked = result.hasIpad
        binding.cbTechIpad.visibility = if (result.hasIpad) View.VISIBLE else View.GONE

        binding.btnTechPhoto.setOnClickListener {
            techPhoneHandedIn = binding.cbTechPhone.isChecked
            techLaptopHandedIn = binding.cbTechLaptop.isChecked
            techIpadHandedIn = binding.cbTechIpad.isChecked
            requestCameraAndShoot()
        }

        binding.btnTechCancel.setOnClickListener {
            hideTechHandinOverlay()
            viewModel.cancelTechHandin()
        }

        binding.overlayTechHandin.visibility = View.VISIBLE
    }

    private fun hideTechHandinOverlay() {
        binding.overlayTechHandin.visibility = View.GONE
    }

    private fun showFirstTimeLockerSetup(result: CheckinResult.AwaitingTechHandin) {
        val studentId = result.studentId ?: return
        val view = layoutInflater.inflate(R.layout.dialog_locker_setup, null)
        val cbPhone = view.findViewById<android.widget.CheckBox>(R.id.cb_phone)
        val cbLaptop = view.findViewById<android.widget.CheckBox>(R.id.cb_laptop)
        val cbIpad = view.findViewById<android.widget.CheckBox>(R.id.cb_ipad)

        cbPhone.isChecked = true
        cbLaptop.isChecked = true
        cbIpad.isChecked = false

        AlertDialog.Builder(this)
            .setTitle("First-time Setup: ${result.name ?: studentId}")
            .setView(view)
            .setPositiveButton("Save & Continue") { _, _ ->
                viewModel.setupLockerAndContinue(
                    studentId,
                    cbPhone.isChecked, cbLaptop.isChecked, cbIpad.isChecked
                )
            }
            .setNegativeButton("Cancel") { _, _ ->
                viewModel.cancelTechHandin()
            }
            .setCancelable(false)
            .show()
    }

    private fun requestCameraAndShoot() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            launchCamera()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchCamera() {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val imageFile = File(cacheDir, "tech_handin_${timestamp}.jpg")
        photoFile = imageFile

        val uri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", imageFile)
        cameraLauncher.launch(uri)
    }

    private fun setupNetworkMonitor() {
        val prefs = TallyApp.instance.prefs
        networkMonitor = NetworkMonitor(prefs.serverUrl)
        networkMonitor.start()
        networkMonitor.isConnected.observe(this) { connected ->
            binding.indicatorOnline.setBackgroundResource(
                if (connected) R.drawable.bg_status_dot_online else R.drawable.bg_status_dot_offline
            )
        }
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
        networkMonitor.stop()
        thermometer.release()
        FeedbackHelper.release()
    }

    companion object {
        private const val KEYCODE_SCAN_LEFT = 520
        private const val KEYCODE_SCAN_RIGHT = 521
    }
}
