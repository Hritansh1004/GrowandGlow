import { registerPlugin } from '@capacitor/core';

export interface LiveStatusButton {
  id: string;
  label: string;
}

export interface LiveStatusPluginDef {
  show(options: {
    title: string;
    subtitle: string;
    endMillis?: number;
    buttons?: LiveStatusButton[];
    data?: string;
  }): Promise<void>;
  hide(): Promise<void>;
  getPendingAction(): Promise<{ actionId: string | null; actionData: string }>;
}

const LiveStatus = registerPlugin<LiveStatusPluginDef>('LiveStatus');

export async function showLiveStatus(options: {
  title: string;
  subtitle: string;
  endDate?: Date | null;
  buttons?: LiveStatusButton[];
  data?: Record<string, any>;
}): Promise<void> {
  try {
    await LiveStatus.show({
      title: options.title,
      subtitle: options.subtitle,
      endMillis: options.endDate ? options.endDate.getTime() : -1,
      buttons: options.buttons || [],
      data: options.data ? JSON.stringify(options.data) : '',
    });
  } catch (err) {
    // Never let the status card fail to break the actual session it's
    // describing — same principle as every other native call in this app.
    console.warn('showLiveStatus failed:', err);
  }
}

export async function hideLiveStatus(): Promise<void> {
  try {
    await LiveStatus.hide();
  } catch (err) {
    console.warn('hideLiveStatus failed:', err);
  }
}

export async function consumePendingLiveStatusAction(): Promise<{ actionId: string; data: any } | null> {
  try {
    const result = await LiveStatus.getPendingAction();
    if (!result.actionId) return null;
    let data: any = {};
    try {
      data = result.actionData ? JSON.parse(result.actionData) : {};
    } catch {
      data = {};
    }
    return { actionId: result.actionId, data };
  } catch (err) {
    console.warn('consumePendingLiveStatusAction failed:', err);
    return null;
  }
}

export default LiveStatus;
