package com.tally.app.ui.checkin

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tally.app.TallyApp
import com.tally.app.data.repository.CheckinRepository
import com.tally.app.domain.model.CheckType
import com.tally.app.domain.model.CheckinResult
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

class CheckinViewModel : ViewModel() {

    private val repository: CheckinRepository = TallyApp.instance.repository
    private val prefs = TallyApp.instance.prefs

    private val _state = MutableLiveData<CheckinResult>(CheckinResult.Idle)
    val state: LiveData<CheckinResult> = _state

    private val _checkType = MutableLiveData(CheckType.fromValue(prefs.checkType))
    val checkType: LiveData<CheckType> = _checkType

    private val _pendingCount = MutableLiveData(0)
    val pendingCount: LiveData<Int> = _pendingCount

    private val _todayCount = MutableLiveData(0)
    val todayCount: LiveData<Int> = _todayCount

    private val _lateCount = MutableLiveData(0)
    val lateCount: LiveData<Int> = _lateCount

    private val _feverCount = MutableLiveData(0)
    val feverCount: LiveData<Int> = _feverCount

    private var resetJob: Job? = null
    private var syncJob: Job? = null
    private var lastScanTime = 0L

    var lastUnknownUid: String? = null
        private set

    private var pendingUid: String? = null
    private var pendingStudentId: String? = null
    private var isBindFlow = false

    fun onCardScanned(uid: String) {
        val now = System.currentTimeMillis()
        if (now - lastScanTime < 1500) return
        lastScanTime = now

        isBindFlow = false
        pendingUid = uid
        pendingStudentId = null

        _state.value = CheckinResult.Processing

        viewModelScope.launch {
            val studentInfo = repository.lookupStudent(uid = uid)
            if (studentInfo != null) {
                handleStudentFound(studentInfo)
            } else {
                lastUnknownUid = uid
                _state.value = CheckinResult.UnknownCard(uid = uid)
            }
        }
    }

    fun onStudentIdEntered(studentId: String) {
        val now = System.currentTimeMillis()
        if (now - lastScanTime < 1500) return
        lastScanTime = now

        isBindFlow = false
        pendingUid = null
        pendingStudentId = studentId

        _state.value = CheckinResult.Processing

        viewModelScope.launch {
            val studentInfo = repository.lookupStudent(studentId = studentId)
            if (studentInfo != null) {
                handleStudentFound(studentInfo)
            } else {
                _state.value = CheckinResult.StudentNotFound(studentId = studentId)
            }
        }
    }

    private suspend fun handleStudentFound(studentInfo: CheckinResult.AwaitingTemperature) {
        if (_checkType.value == CheckType.TECH_HANDIN) {
            val sid = studentInfo.studentId ?: pendingStudentId ?: return
            val locker = repository.lookupLocker(sid)
            if (locker != null) {
                _state.postValue(CheckinResult.AwaitingTechHandin(
                    uid = studentInfo.uid,
                    studentId = sid,
                    name = studentInfo.name,
                    hasPhone = locker.hasPhone,
                    hasLaptop = locker.hasLaptop,
                    hasIpad = locker.hasIpad,
                    isFirstTime = false
                ))
            } else {
                _state.postValue(CheckinResult.AwaitingTechHandin(
                    uid = studentInfo.uid,
                    studentId = sid,
                    name = studentInfo.name,
                    isFirstTime = true
                ))
            }
        } else {
            _state.postValue(studentInfo)
        }
    }

    fun submitTemperature(temperature: Float?) {
        if (isBindFlow) {
            submitBindWithTemperature(temperature)
            return
        }

        val uid = pendingUid
        val studentId = pendingStudentId

        _state.value = CheckinResult.Processing

        viewModelScope.launch {
            val result = when {
                uid != null -> repository.checkin(uid, temperature)
                studentId != null -> repository.checkinByStudentId(studentId, temperature)
                else -> {
                    _state.value = CheckinResult.Error("Unable to identify student")
                    return@launch
                }
            }

            _state.value = result
            pendingUid = null
            pendingStudentId = null

            when (result) {
                is CheckinResult.Success -> {
                    _todayCount.value = (_todayCount.value ?: 0) + if (!result.response.is_update) 1 else 0
                    scheduleReset()
                }
                is CheckinResult.Late -> {
                    _todayCount.value = (_todayCount.value ?: 0) + if (!result.response.is_update) 1 else 0
                    _lateCount.value = (_lateCount.value ?: 0) + 1
                    scheduleReset()
                }
                is CheckinResult.Fever -> {
                    _todayCount.value = (_todayCount.value ?: 0) + if (!result.response.is_update) 1 else 0
                    _feverCount.value = (_feverCount.value ?: 0) + 1
                    scheduleReset()
                }
                is CheckinResult.Queued -> {
                    _pendingCount.value = result.pendingCount
                    scheduleReset()
                }
                is CheckinResult.UnknownCard -> {
                    lastUnknownUid = result.uid
                }
                else -> {
                    scheduleReset()
                }
            }
        }
    }

    fun submitTechHandin(photoFile: File, phoneHandedIn: Boolean, laptopHandedIn: Boolean, ipadHandedIn: Boolean) {
        val studentId = pendingStudentId ?: (state.value as? CheckinResult.AwaitingTechHandin)?.studentId ?: return

        _state.value = CheckinResult.Processing

        viewModelScope.launch {
            val photoUrl = repository.uploadPhoto(photoFile, studentId)
            if (photoUrl == null) {
                _state.value = CheckinResult.Error("Photo upload failed")
                scheduleReset()
                return@launch
            }

            val result = repository.checkinWithPhoto(studentId, photoUrl, phoneHandedIn, laptopHandedIn, ipadHandedIn)
            _state.value = result
            pendingUid = null
            pendingStudentId = null

            if (result is CheckinResult.Success) {
                _todayCount.value = (_todayCount.value ?: 0) + if (!result.response.is_update) 1 else 0
            }
            scheduleReset()
        }
    }

    fun setupLockerAndContinue(studentId: String, hasPhone: Boolean, hasLaptop: Boolean, hasIpad: Boolean) {
        _state.value = CheckinResult.Processing
        pendingStudentId = studentId

        viewModelScope.launch {
            val created = repository.createLocker(studentId, hasPhone, hasLaptop, hasIpad)
            if (created) {
                _state.value = CheckinResult.AwaitingTechHandin(
                    studentId = studentId,
                    name = (state.value as? CheckinResult.AwaitingTechHandin)?.name,
                    hasPhone = hasPhone,
                    hasLaptop = hasLaptop,
                    hasIpad = hasIpad,
                    isFirstTime = false
                )
            } else {
                _state.value = CheckinResult.Error("Failed to save locker info")
                scheduleReset()
            }
        }
    }

    fun cancelTechHandin() {
        pendingUid = null
        pendingStudentId = null
        _state.value = CheckinResult.Idle
    }

    fun cancelTemperatureInput() {
        pendingUid = null
        pendingStudentId = null
        isBindFlow = false
        _state.value = CheckinResult.Idle
    }

    fun bindCard(studentId: String) {
        val uid = lastUnknownUid ?: return
        isBindFlow = true
        pendingUid = uid
        pendingStudentId = studentId

        _state.value = CheckinResult.Processing

        viewModelScope.launch {
            val studentInfo = repository.lookupStudent(studentId = studentId)
            if (studentInfo != null) {
                _state.value = CheckinResult.AwaitingTemperature(uid = uid, studentId = studentId, name = studentInfo.name)
            } else {
                _state.value = CheckinResult.StudentNotFound(studentId = studentId, uid = uid)
            }
        }
    }

    fun createStudentAndProceed(studentId: String, name: String, grade: Int) {
        _state.value = CheckinResult.Processing

        viewModelScope.launch {
            val created = repository.createStudent(studentId, name, grade)
            if (created) {
                pendingStudentId = studentId
                val uid = pendingUid
                _state.value = CheckinResult.AwaitingTemperature(uid = uid, studentId = studentId, name = name)
            } else {
                _state.value = CheckinResult.Error("Failed to add student")
                scheduleReset()
            }
        }
    }

    fun dismissStudentNotFound() {
        pendingUid = null
        pendingStudentId = null
        isBindFlow = false
        _state.value = CheckinResult.Idle
    }

    private fun submitBindWithTemperature(temperature: Float?) {
        val uid = pendingUid ?: return
        val studentId = pendingStudentId ?: return

        _state.value = CheckinResult.Processing

        viewModelScope.launch {
            val result = repository.bindAndCheckin(uid, studentId, temperature)
            _state.value = result
            lastUnknownUid = null
            pendingUid = null
            pendingStudentId = null
            isBindFlow = false

            when (result) {
                is CheckinResult.Success -> {
                    _todayCount.value = (_todayCount.value ?: 0) + 1
                }
                is CheckinResult.Late -> {
                    _todayCount.value = (_todayCount.value ?: 0) + 1
                    _lateCount.value = (_lateCount.value ?: 0) + 1
                }
                is CheckinResult.Fever -> {
                    _todayCount.value = (_todayCount.value ?: 0) + 1
                    _feverCount.value = (_feverCount.value ?: 0) + 1
                }
                else -> {}
            }
            scheduleReset()
        }
    }

    fun dismissUnknownCard() {
        lastUnknownUid = null
        _state.value = CheckinResult.Idle
    }

    fun setCheckType(type: CheckType) {
        _checkType.value = type
        prefs.checkType = type.value
    }

    fun syncPending() {
        if (syncJob?.isActive == true) return
        syncJob = viewModelScope.launch {
            val synced = repository.syncPending()
            _pendingCount.value = repository.getPendingCount()
        }
    }

    fun refreshPendingCount() {
        viewModelScope.launch {
            _pendingCount.value = repository.getPendingCount()
        }
    }

    private fun scheduleReset() {
        resetJob?.cancel()
        resetJob = viewModelScope.launch {
            delay(3000)
            _state.value = CheckinResult.Idle
        }
    }
}
