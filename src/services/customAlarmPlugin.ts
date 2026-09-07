import { registerPlugin } from '@capacitor/core';

export interface CustomAlarmPlugin {
  schedule(options: {
    id: number;
    fileName: string;
    atMillis: number;
    title?: string;
    body?: string;
  }): Promise<void>;
  cancel(options: { id: number }): Promise<void>;
  canScheduleExactAlarms(): Promise<{ value: boolean }>;
  openExactAlarmSettings(): Promise<void>;
}

const CustomAlarm = registerPlugin<CustomAlarmPlugin>('CustomAlarm');

export async function scheduleCustomBellAlarm(options: {
  id: number;
  fileName: string;
  atDate: Date;
  title?: string;
  body?: string;
}): Promise<void> {
  await CustomAlarm.schedule({
    id: options.id,
    fileName: options.fileName,
    atMillis: options.atDate.getTime(),
    title: options.title,
    body: options.body,
  });
}

export async function cancelCustomBellAlarm(id: number): Promise<void> {
  await CustomAlarm.cancel({ id });
}

export async function canScheduleExactAlarms(): Promise<boolean> {
  try {
    const result = await CustomAlarm.canScheduleExactAlarms();
    return result.value;
  } catch {
    return true;
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  await CustomAlarm.openExactAlarmSettings();
}

export default CustomAlarm;
