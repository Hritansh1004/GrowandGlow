import { registerPlugin } from '@capacitor/core';

export interface LiveStatusButton {
  id: string;
  label: string;
}

export interface LiveStatusTheme {
  cardBgColor?: string;
  accentColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  onAccentColor?: string;
}

export interface LiveStatusPluginDef {
  show(options: {
    title: string;
    subtitle: string;
    endMillis?: number;
    progressPercent?: number;
    buttons?: LiveStatusButton[];
    data?: string;
    cardBgColor?: string;
    accentColor?: string;
    titleColor?: string;
    subtitleColor?: string;
    onAccentColor?: string;
  }): Promise<void>;
  hide(): Promise<void>;
  getPendingAction(): Promise<{ actionId: string | null; actionData: string }>;
}

const LiveStatus = registerPlugin<LiveStatusPluginDef>('LiveStatus');

export async function showLiveStatus(options: {
  title: string;
  subtitle: string;
  endDate?: Date | null;
  progressPercent?: number;
  buttons?: LiveStatusButton[];
  data?: Record<string, any>;
  theme?: LiveStatusTheme;
}): Promise<void> {
  try {
    await LiveStatus.show({
      title: options.title,
      subtitle: options.subtitle,
      endMillis: options.endDate ? options.endDate.getTime() : -1,
      progressPercent: options.progressPercent ?? -1,
      buttons: options.buttons || [],
      data: options.data ? JSON.stringify(options.data) : '',
      cardBgColor: options.theme?.cardBgColor,
      accentColor: options.theme?.accentColor,
      titleColor: options.theme?.titleColor,
      subtitleColor: options.theme?.subtitleColor,
      onAccentColor: options.theme?.onAccentColor,
    });
  } catch (err) {
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
