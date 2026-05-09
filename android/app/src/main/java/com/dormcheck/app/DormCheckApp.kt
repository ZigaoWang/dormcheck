package com.dormcheck.app

import android.app.Application
import com.dormcheck.app.data.api.ApiClient
import com.dormcheck.app.data.local.AppDatabase
import com.dormcheck.app.data.local.PrefsManager
import com.dormcheck.app.data.repository.CheckinRepository

class DormCheckApp : Application() {

    lateinit var prefs: PrefsManager
        private set
    lateinit var database: AppDatabase
        private set
    lateinit var repository: CheckinRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = PrefsManager(this)
        database = AppDatabase.create(this)
        repository = CheckinRepository(
            api = ApiClient.create(prefs),
            dao = database.pendingCheckinDao(),
            prefs = prefs
        )
    }

    companion object {
        lateinit var instance: DormCheckApp
            private set
    }
}
