// Built-in alarm/bell sounds, synthesized live with the Web Audio API.
// No external audio files needed for these — real distinct tones, generated on demand.

export interface BuiltinAlarm {
  id: string;
  name: string;
  freq: number;
  type: OscillatorType;
  pattern: "single" | "double" | "triple";
  decay: number;
}

export const BUILTIN_ALARMS: BuiltinAlarm[] = [
  { id: "builtin_classic_bell", name: "Classic School Bell", freq: 880, type: "triangle", pattern: "double", decay: 0.8 },
  { id: "builtin_soft_bell", name: "Soft Bell", freq: 660, type: "sine", pattern: "single", decay: 1.2 },
  { id: "builtin_double_bell", name: "Double Bell", freq: 740, type: "triangle", pattern: "double", decay: 0.6 },
  { id: "builtin_short_bell", name: "Short Bell", freq: 900, type: "square", pattern: "single", decay: 0.3 },
  { id: "builtin_long_bell", name: "Long Bell", freq: 520, type: "sine", pattern: "single", decay: 2.4 },
  { id: "builtin_digital_chime", name: "Digital Chime", freq: 1046, type: "sine", pattern: "triple", decay: 0.4 },
  { id: "builtin_soft_chime", name: "Soft Chime", freq: 784, type: "sine", pattern: "double", decay: 1.0 },
  { id: "builtin_study_bell", name: "Study Bell", freq: 698, type: "triangle", pattern: "single", decay: 1.0 },
  { id: "builtin_break_bell", name: "Break Bell", freq: 587, type: "sine", pattern: "double", decay: 0.9 },
  { id: "builtin_traditional_bell", name: "Traditional Bell", freq: 494, type: "triangle", pattern: "single", decay: 1.6 },
  { id: "builtin_notification_tone", name: "Notification Tone", freq: 988, type: "triangle", pattern: "single", decay: 0.5 },
  { id: "builtin_gentle_alarm", name: "Gentle Alarm", freq: 440, type: "sine", pattern: "single", decay: 1.8 },
  { id: "builtin_sharp_alarm", name: "Sharp Alarm", freq: 1200, type: "square", pattern: "triple", decay: 0.22 },
];

export const DEFAULT_BUILTIN_ID = "builtin_classic_bell";

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!sharedContext) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedContext = new AudioCtx();
  }

  return sharedContext;
}

function scheduleTone(
  ctx: AudioContext,
  startTime: number,
  freq: number,
  type: OscillatorType,
  decay: number,
  volume: number
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + decay);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + decay + 0.05);
  } catch (err) {
    console.warn("Error scheduling tone:", err);
  }
}

export function playBuiltinAlarm(id: string = DEFAULT_BUILTIN_ID, volume = 0.35) {
  const preset = BUILTIN_ALARMS.find((a) => a.id === id) || BUILTIN_ALARMS[0];
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    // This resume() call is the actual root cause of "no bell ever plays
    // automatically": browsers only honor ctx.resume() when it's called
    // directly inside a user-gesture handler (a real tap/click). When a
    // period completes from a clock-tick timer (no gesture involved),
    // this silently does nothing and the context stays suspended forever
    // — so every scheduled tone plays into a muted context. The real fix
    // is unlockAudioPlayback() below, called once on the app's first
    // genuine tap, so the context is already running by the time a timer
    // needs it later. This resume() call is kept as a harmless attempt
    // for the rare case a gesture-triggered play still hits a suspended
    // context (e.g. right after unlock but before the promise settles).
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const gap = 0.28;
  const count = preset.pattern === "triple" ? 3 : preset.pattern === "double" ? 2 : 1;

  for (let i = 0; i < count; i++) {
    scheduleTone(ctx, now + i * gap, preset.freq, preset.type, preset.decay, volume);
  }
}

export function isBuiltinAlarmId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("builtin_");
}

// Call this exactly once, from the very first genuine user interaction
// anywhere in the app (see hooks/useAudioUnlock.ts). This is what actually
// fixes automatic bell playback: it resumes the shared AudioContext (used
// by every built-in tone) and plays a near-silent HTMLAudioElement (which
// helps satisfy Chromium's separate autoplay-permission tracking for
// <audio>/new Audio(...) elements, used for custom uploaded bell sounds)
// — both while a real user gesture is on the call stack, which is the one
// thing browsers actually check. Once granted, the browser keeps both
// permissions active for the rest of the page session, so later calls
// triggered purely by a clock tick (no gesture) succeed normally.
export function unlockAudioPlayback() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  } catch {}

  try {
    // 1 sample of silence, base64 WAV — long enough for browsers to count
    // as a real playback attempt, short/quiet enough to be inaudible.
    const silentAudio = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
    );
    silentAudio.volume = 0;
    silentAudio.play().catch(() => {});
  } catch {}
}
