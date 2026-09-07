package com.growandglow.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "CustomAlarm")
class CustomAlarmPlugin : Plugin() {

    @PluginMethod
    fun schedule(call: PluginCall) {
        val id = call.getInt("id")
        val fileName = call.getString("fileName")
        val atMillis = call.getLong("atMillis")

        if (id == null || fileName == null || atMillis == null) {
            call.reject("Missing id, fileName, or atMillis")
            return
        }

        val title = call.getString("title") ?: "Time's up!"
        val body = call.getString("body") ?: ""

        val intent = Intent(context, CustomAlarmReceiver::class.java).apply {
            putExtra("id", id)
            putExtra("fileName", fileName)
            putExtra("title", title)
            putExtra("body", body)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                // No exact-alarm permission granted — still schedule an
                // inexact one rather than failing outright. It may land a
                // little late, but it will still fire.
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pendingIntent)
            } else {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pendingIntent)
            }
            call.resolve()
        } catch (e: SecurityException) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pendingIntent)
            call.resolve()
        }
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        val id = call.getInt("id")
        if (id == null) {
            call.reject("Missing id")
            return
        }

        val intent = Intent(context, CustomAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pendingIntent)
        call.resolve()
    }

    @PluginMethod
    fun canScheduleExactAlarms(call: PluginCall) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val can = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }
        val ret = JSObject()
        ret.put("value", can)
        call.resolve(ret)
    }

    @PluginMethod
    fun openExactAlarmSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            intent.data = Uri.parse("package:" + context.packageName)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
        }
        call.resolve()
    }
}
