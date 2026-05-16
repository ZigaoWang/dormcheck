package com.dormcheck.app.ui.checkin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import com.dormcheck.app.databinding.BottomSheetManualInputBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class ManualInputBottomSheet : BottomSheetDialogFragment() {

    private var _binding: BottomSheetManualInputBinding? = null
    private val binding get() = _binding!!

    var onStudentIdConfirmed: ((String) -> Unit)? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = BottomSheetManualInputBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnConfirm.setOnClickListener { submit() }
        binding.btnCancel.setOnClickListener { dismiss() }

        binding.editStudentId.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                submit()
                true
            } else false
        }

        binding.editStudentId.requestFocus()
        dialog?.window?.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE
        )
    }

    private fun submit() {
        val id = binding.editStudentId.text.toString().trim()
        if (id.isBlank()) {
            binding.inputLayout.error = "Please enter a student ID"
            return
        }
        binding.inputLayout.error = null
        onStudentIdConfirmed?.invoke(id)
        dismiss()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "ManualInputBottomSheet"
    }
}
