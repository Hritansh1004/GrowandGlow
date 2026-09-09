package com.growandglow.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class LiveStatusActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val actionId = intent.getStringExtra("actionId") ?: return
        val actionData = intent.getStringExtra("actionData") ?: ""

        // Stashed in plain SharedPreferences rather than passed via the
        // launch Intent — this survives even a fully cold start (app was
        // completely killed, not just backgrounded), and the JS side reads
        // and clears it once, right after the app opens.
        val prefs = context.getSharedPreferences("live_status_prefs", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("pending_action_id", actionId)
            .putString("pending_action_data", actionData)
            .apply()

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        launchIntent?.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        )
        if (launchIntent != null) {
            context.startActivity(launchIntent)
        }
    }
}
