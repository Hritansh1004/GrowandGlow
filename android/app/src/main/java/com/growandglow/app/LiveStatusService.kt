package com.growandglow.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.widget.RemoteViews
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
        val progressPercent = intent?.getIntExtra("progressPercent", -1) ?: -1
        val buttonsJson = intent?.getStringExtra("buttons") ?: "[]"
        val data = intent?.getStringExtra("data") ?: ""

        fun parseColorSafe(hex: String?, fallback: String): Int {
            return try {
                Color.parseColor(if (hex.isNullOrBlank()) fallback else hex)
            } catch (e: Exception) {
                Color.parseColor(fallback)
            }
        }

        val cardBgColor = parseColorSafe(intent?.getStringExtra("cardBgColor"), "#1A1F1F")
        val accentColor = parseColorSafe(intent?.getStringExtra("accentColor"), "#58D8C4")
        val titleColor = parseColorSafe(intent?.getStringExtra("titleColor"), "#FFFFFF")
        val subtitleColor = parseColorSafe(intent?.getStringExtra("subtitleColor"), "#B3FFFFFF")
        val onAccentColor = parseColorSafe(intent?.getStringExtra("onAccentColor"), "#0A0A0A")

        val views = RemoteViews(packageName, R.layout.live_status_notification)

        views.setInt(R.id.live_status_root, "setBackgroundColor", cardBgColor)
        views.setTextViewText(R.id.live_status_title, title)
        views.setTextColor(R.id.live_status_title, titleColor)
        views.setTextViewText(R.id.live_status_subtitle, subtitle)
        views.setTextColor(R.id.live_status_subtitle, subtitleColor)

        views.setInt(R.id.live_status_icon_bg, "setColorFilter", accentColor)
        views.setImageViewResource(R.id.live_status_mode_icon, applicationInfo.icon)

        views.setTextColor(R.id.live_status_chronometer, titleColor)
        if (endMillis > 0) {
            val remainingMs = endMillis - System.currentTimeMillis()
            val base = SystemClock.elapsedRealtime() + remainingMs
            views.setChronometer(R.id.live_status_chronometer, base, null, true)
            views.setBoolean(R.id.live_status_chronometer, "setCountDown", true)
        } else {
            views.setChronometer(R.id.live_status_chronometer, SystemClock.elapsedRealtime(), null, false)
        }

        if (progressPercent in 0..100) {
            views.setTextViewText(R.id.live_status_progress_text, "$progressPercent% done")
        } else {
            views.setTextViewText(R.id.live_status_progress_text, "")
        }
        views.setTextColor(R.id.live_status_progress_text, subtitleColor)

        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setViewVisibility(R.id.live_status_action1_wrap, android.view.View.GONE)
        views.setViewVisibility(R.id.live_status_action2_wrap, android.view.View.GONE)

        try {
            val buttons = JSONArray(buttonsJson)
            val wrapIds = intArrayOf(R.id.live_status_action1_wrap, R.id.live_status_action2_wrap)
            val bgIds = intArrayOf(R.id.live_status_action1_bg, R.id.live_status_action2_bg)
            val labelIds = intArrayOf(R.id.live_status_action1_label, R.id.live_status_action2_label)

            for (i in 0 until minOf(buttons.length(), 2)) {
                val btn = buttons.getJSONObject(i)
                val actionId = btn.getString("id")
                val label = btn.getString("label")

                views.setViewVisibility(wrapIds[i], android.view.View.VISIBLE)
                views.setTextViewText(labelIds[i], label)
                views.setTextColor(labelIds[i], onAccentColor)
                views.setInt(bgIds[i], "setColorFilter", accentColor)

                val actionIntent = Intent(this, LiveStatusActionReceiver::class.java).apply {
                    putExtra("actionId", actionId)
                    putExtra("actionData", data)
                }
                val actionPendingIntent = PendingIntent.getBroadcast(
                    this, actionId.hashCode(), actionIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(wrapIds[i], actionPendingIntent)
            }
        } catch (e: Exception) {
            // Malformed buttons payload — still show the status card, just
            // without action buttons, rather than failing entirely.
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setColor(accentColor)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setContentIntent(contentPendingIntent)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(views)
            .setCustomBigContentView(views)
            .build()

        startForeground(NOTIFICATION_ID, notification)
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
            channel.setSound(null, null)
            manager.createNotificationChannel(channel)
        }
    }
}
