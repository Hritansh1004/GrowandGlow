package com.growandglow.app

import android.content.Context
import android.content.Intent
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "LiveStatus")
class LiveStatusPlugin : Plugin() {

    @PluginMethod
    fun show(call: PluginCall) {
        val title = call.getString("title") ?: "Active session"
        val subtitle = call.getString("subtitle") ?: ""
        val endMillis = call.getLong("endMillis") ?: -1L
        val buttonsArray = call.getArray("buttons")
        val data = call.getString("data") ?: ""

        val intent = Intent(context, LiveStatusService::class.java).apply {
            putExtra("title", title)
            putExtra("subtitle", subtitle)
            putExtra("endMillis", endMillis)
            putExtra("buttons", buttonsArray?.toString() ?: "[]")
            putExtra("data", data)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun hide(call: PluginCall) {
        val intent = Intent(context, LiveStatusService::class.java).apply {
            action = "STOP"
        }
        context.startService(intent)
        call.resolve()
    }

    @PluginMethod
    fun getPendingAction(call: PluginCall) {
        val prefs = context.getSharedPreferences("live_status_prefs", Context.MODE_PRIVATE)
        val actionId = prefs.getString("pending_action_id", null)
        val actionData = prefs.getString("pending_action_data", "")

        if (actionId != null) {
            prefs.edit().remove("pending_action_id").remove("pending_action_data").apply()
        }

        val ret = JSObject()
        ret.put("actionId", actionId)
        ret.put("actionData", actionData)
        call.resolve(ret)
    }
}
