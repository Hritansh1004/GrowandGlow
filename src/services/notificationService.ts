import { LocalNotifications } from '@capacitor/local-notifications';
import { BUILTIN_ALARMS } from '../lib/alarmSounds';

export async function requestNotificationPermission(): Promise<boolean> {
  const result = await LocalNotifications.checkPermissions();
  if (result.display === 'granted') return true;
  const request = await LocalNotifications.requestPermissions();
  return request.display === 'granted';
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
  const result = await LocalNotifications.checkPermissions();
  return result.display as 'granted' | 'denied' | 'prompt';
}

// IMPORTANT: Android locks a notification channel's sound permanently once
// the channel is first created — it can never be changed for that channel
// again, even by us. So instead of one channel, we make ONE CHANNEL PER
// BELL, and pick the right channel at schedule-time based on which bell
// the user chose. Call this once when the app starts (see App.tsx).
export async function ensureAllBellChannels(): Promise<void> {
  for (const bell of BUILTIN_ALARMS) {
    await LocalNotifications.createChannel({
      id: `bell_${bell.id}`,
      name: bell.name,
      importance: 5,
      sound: bell.id, // matches the .wav filename in android/app/src/main/res/raw (no extension)
      vibration: true,
    });
  }
}

interface ScheduleTimerOptions {
  id: number;
  title: string;
  body: string;
  builtinBellId: string; // must be one of BUILTIN_ALARMS[].id
  atDate: Date;
}

export async function scheduleTimerNotification({
  id, title, body, builtinBellId, atDate,
}: ScheduleTimerOptions): Promise<void> {
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: { at: atDate, allowWhileIdle: true },
        channelId: `bell_${builtinBellId}`,
      },
    ],
  });
}

export async function cancelScheduledNotification(id: number): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

/* =======================================================
   ROUTINE ALARMS — a day's schedule can have many periods
   (unlike Timer, which only ever has one active session), so
   these use a reserved block of notification ids instead of
   one fixed id. Routine always re-schedules its WHOLE set
   whenever it reloads (see useRoutine.ts), so cancelling the
   entire reserved block first and rescheduling fresh each time
   is correct and keeps stale periods from ever lingering.
======================================================= */

const ROUTINE_ALARM_ID_BASE = 2000;
const ROUTINE_ALARM_ID_MAX_SLOTS = 100; // generous cap on periods/day

export async function cancelAllRoutineAlarms(): Promise<void> {
  const ids = Array.from({ length: ROUTINE_ALARM_ID_MAX_SLOTS }, (_, i) => ROUTINE_ALARM_ID_BASE + i);
  await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
}

interface RoutinePeriodToSchedule {
  title: string;
  body: string;
  builtinBellId: string;
  atDate: Date;
}

export async function scheduleRoutineAlarms(periods: RoutinePeriodToSchedule[]): Promise<void> {
  await cancelAllRoutineAlarms();

  const capped = periods.slice(0, ROUTINE_ALARM_ID_MAX_SLOTS);
  if (capped.length === 0) return;

  await LocalNotifications.schedule({
    notifications: capped.map((p, index) => ({
      id: ROUTINE_ALARM_ID_BASE + index,
      title: p.title,
      body: p.body,
      schedule: { at: p.atDate, allowWhileIdle: true },
      channelId: `bell_${p.builtinBellId}`,
    })),
  });
}
