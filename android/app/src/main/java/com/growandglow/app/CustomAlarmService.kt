package com.growandglow.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import java.io.File

class CustomAlarmService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private val channelId = "custom_bell_alarms"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val id = intent?.getIntExtra("id", 0) ?: 0
        val fileName = intent?.getStringExtra("fileName")
        val title = intent?.getStringExtra("title") ?: "Time's up!"
        val body = intent?.getStringExtra("body") ?: ""

        ensureChannel()

        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPendingIntent = PendingIntent.getActivity(
            this, id, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(applicationInfo.icon)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(contentPendingIntent)
            .setAutoCancel(true)
            .build()

        startForeground(id, notification)
        playSound(fileName)

        // Safety cap — never let this hold the foreground service alive
        // for more than 60 seconds, regardless of the file's length.
        handler.postDelayed({ stopSelfCleanly() }, 60000)

        return START_NOT_STICKY
    }

    private fun playSound(fileName: String?) {
        if (fileName == null) {
            stopSelfCleanly()
            return
        }

        try {
            val file = File(filesDir, fileName)
            if (!file.exists()) {
                stopSelfCleanly()
                return
            }

            mediaPlayer = MediaPlayer().apply {
                setDataSource(file.absolutePath)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setOnCompletionListener { stopSelfCleanly() }
                setOnErrorListener { _, _, _ -> stopSelfCleanly(); true }
                prepare()
                start()
            }
        } catch (e: Exception) {
            stopSelfCleanly()
        }
    }

    private fun stopSelfCleanly() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        } catch (e: Exception) {
            // already stopped/released — safe to ignore
        }
        mediaPlayer = null
        stopForeground(true)
        stopSelf()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                channelId,
                "Custom Bell Alarms",
                NotificationManager.IMPORTANCE_HIGH
            )
            // Silent at the channel level on purpose — MediaPlayer above is
            // what actually plays the chosen custom bell. If the channel
            // ALSO had a sound, the user would hear two sounds at once.
            channel.setSound(null, null)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        try {
            mediaPlayer?.release()
        } catch (e: Exception) {
            // ignore
        }
    }
}
