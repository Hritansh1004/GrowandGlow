import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabaseClient';

export async function requestPushPermission(): Promise<boolean> {
  const result = await PushNotifications.checkPermissions();
  if (result.receive === 'granted') return true;
  const request = await PushNotifications.requestPermissions();
  return request.receive === 'granted';
}

// Call once per app session, after the user is known (logged in). Asks for
// permission, then registers this device with FCM and saves the resulting
// token against this user so the server knows where to send pushes.
export async function registerForPush(userId: string): Promise<void> {
  const granted = await requestPushPermission();
  if (!granted) return;

  PushNotifications.addListener('registration', async (token) => {
    try {
      await supabase
        .from('device_push_tokens')
        .upsert(
          { user_id: userId, token: token.value, platform: 'android', updated_at: new Date().toISOString() },
          { onConflict: 'token' }
        );
    } catch (err) {
      console.warn('Saving push token failed:', err);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('Push registration error:', err);
  });

  // App is already open (foreground) when this fires — no action needed.
  // The in-app Notification Inbox (Stage 3) already shows this the moment
  // it lands in the database, via its own realtime subscription.
  PushNotifications.addListener('pushNotificationReceived', () => {});

  // User tapped the system notification banner itself. Nothing to do yet —
  // a future step could deep-link straight to the relevant room or
  // friend-request screen using the notification's data payload.
  PushNotifications.addListener('pushNotificationActionPerformed', () => {});

  await PushNotifications.register();
}

export async function removePushListeners(): Promise<void> {
  await PushNotifications.removeAllListeners();
}
