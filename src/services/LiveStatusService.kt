package com.growandglow.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONArray

class LiveStatusService : Service() {

    companion object {
        const val CHANNEL_ID = "live_status_channel"
        const val NOTIFICATION_ID = 5000
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") {
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        ensureChannel()

        val title = intent?.getStringExtra("title") ?: "Active session"
        val subtitle = intent?.getStringExtra("subtitle") ?: ""
        val endMillis = intent?.getLongExtra("endMillis", -1L) ?: -1L
        val buttonsJson = intent?.getStringExtra("buttons") ?: "[]"
        val data = intent?.getStringExtra("data") ?: ""

        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setContentIntent(contentPendingIntent)

        if (endMillis > 0) {
            // Android's own chronometer ticks this down live, using the
            // same end-timestamp math already used everywhere else in the
            // app — no repeating background loop needed just for display.
            builder.setUsesChronometer(true)
            builder.setChronometerCountDown(true)
            builder.setWhen(endMillis)
        } else {
            builder.setUsesChronometer(false)
        }

        try {
            val buttons = JSONArray(buttonsJson)
            for (i in 0 until buttons.length()) {
                val btn = buttons.getJSONObject(i)
                val actionId = btn.getString("id")
                val label = btn.getString("label")

                val actionIntent = Intent(this, LiveStatusActionReceiver::class.java).apply {
                    putExtra("actionId", actionId)
                    putExtra("actionData", data)
                }
                val actionPendingIntent = PendingIntent.getBroadcast(
                    this, actionId.hashCode(), actionIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, label, actionPendingIntent)
            }
        } catch (e: Exception) {
            // Malformed buttons payload — still show the status card, just
            // without action buttons, rather than failing entirely.
        }

        startForeground(NOTIFICATION_ID, builder.build())
        return START_STICKY
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Live Session Status",
                NotificationManager.IMPORTANCE_LOW
            )
            // Silent and low-importance on purpose — this is a persistent
            // status card, not an alert. The actual bells still come
            // through the separate alarm channels/plugin.
            channel.setSound(null, null)
            manager.createNotificationChannel(channel)
        }
    }
}
