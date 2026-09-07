package com.growandglow.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class CustomAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val serviceIntent = Intent(context, CustomAlarmService::class.java).apply {
            putExtra("id", intent.getIntExtra("id", 0))
            putExtra("fileName", intent.getStringExtra("fileName"))
            putExtra("title", intent.getStringExtra("title"))
            putExtra("body", intent.getStringExtra("body"))
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
