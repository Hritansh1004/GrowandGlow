import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playBuiltinAlarm, DEFAULT_BUILTIN_ID, isBuiltinAlarmId } from "../lib/alarmSounds";
import {
  scheduleTimerNotification,
  cancelScheduledNotification,
} from "../services/notificationService";
import { scheduleCustomBellAlarm, cancelCustomBellAlarm } from "../services/customAlarmPlugin";
import { ensureCustomBellDownloaded } from "../services/customBellStorage";
import { showLiveStatus, hideLiveStatus } from "../services/liveStatusPlugin";

const BUCKET = "custom-audio";

// Your architecture only ever has ONE active (running/paused) timer per
// user at a time (see loadActiveTimer's `.limit(1)` below) — so we can use
// a single fixed native notification id instead of generating/tracking one
// per timer row. Scheduling always replaces whatever was there before.
const NATIVE_ALARM_ID = 1001;

export interface CustomTimerRow {
  id: string;
  user_id: string;
  task_name: string;
  duration_seconds: number;
  alarm_id?: string | null;
  break_alarm_id?: string | null;
  color?: string | null;
  session_type?: "focus" | "short_break" | "long_break" | null;
  round_number?: number | null;
  total_rounds?: number | null;
  work_seconds?: number | null;
  break_seconds?: number | null;
  long_break_seconds?: number | null;
  rounds_before_long_break?: number | null;
  pomodoro_group_id?: string | null;
  auto_advance?: boolean;
  start_timestamp: string;
  end_timestamp?: string | null;
  paused_at?: string | null;
  accumulated_pause_seconds: number;
  status: "running" | "paused" | "completed" | "stopped";
  rating?: number | null;
  note?: string | null;
  created_at?: string;
  isPomodoroFinale?: boolean;
}

export interface PomodoroPhaseInfo extends CustomTimerRow {
  nextType: "focus" | "short_break" | "long_break";
  nextDuration: number;
  nextRound: number;
}

export default function useTimer(userId: string | undefined | null) {
  const [activeTimer, setActiveTimer] = useState<CustomTimerRow | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerLoading, setTimerLoading] = useState(true);
  const [timerMessage, setTimerMessage] = useState("");

  const [pendingRatingTimer, setPendingRatingTimer] = useState<CustomTimerRow | null>(null);
  const [pendingNextPhase, setPendingNextPhase] = useState<PomodoroPhaseInfo | null>(null);

  const [recentTimers, setRecentTimers] = useState<CustomTimerRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const alarmFiredRef = useRef(false);

  /* =======================================================
     TIME MATH — authoritative timestamp calculations
  ======================================================= */

  const computeRemaining = useCallback((timer: CustomTimerRow | null): number => {
    if (!timer) return 0;

    const startMs = new Date(timer.start_timestamp).getTime();
    const nowMs =
      timer.status === "paused" && timer.paused_at
        ? new Date(timer.paused_at).getTime()
        : Date.now();

    const elapsedActive = (nowMs - startMs) / 1000 - (timer.accumulated_pause_seconds || 0);
    const remaining = timer.duration_seconds - elapsedActive;
    return Math.max(0, Math.round(remaining));
  }, []);

  // Same math as computeRemaining, but returns the absolute end Date —
  // this is what the native alarm system needs (it fires at a real
  // timestamp, not a "seconds remaining" countdown).
  const computeEndDate = useCallback((timer: CustomTimerRow): Date => {
    const startMs = new Date(timer.start_timestamp).getTime();
    const pauseMs = (timer.accumulated_pause_seconds || 0) * 1000;
    const endMs = startMs + timer.duration_seconds * 1000 + pauseMs;
    return new Date(endMs);
  }, []);

  // Mirrors the "which bell plays" logic already in finishTimer() below,
  // so the native alarm rings the same bell the in-app one would have.
  function resolveAlarmForTimer(timer: CustomTimerRow): string | null | undefined {
    return timer.session_type === "focus" || !timer.session_type
      ? timer.alarm_id
      : timer.break_alarm_id || timer.alarm_id;
  }

  // Schedules (or replaces) the one native alarm for whatever timer is
  // currently active. Safe to call every time a timer starts/resumes.
  const scheduleNativeAlarm = useCallback(
    async (timer: CustomTimerRow) => {
      const chosenAlarmId = resolveAlarmForTimer(timer);
      const title = timer.session_type && timer.session_type !== "focus" ? "Break's over!" : "Time's up!";
      const body = timer.task_name;
      const atDate = computeEndDate(timer);

      if (chosenAlarmId && !isBuiltinAlarmId(chosenAlarmId)) {
        const fileName = await ensureCustomBellDownloaded(chosenAlarmId);
        if (fileName) {
          try {
            await cancelScheduledNotification(NATIVE_ALARM_ID);
            await scheduleCustomBellAlarm({ id: NATIVE_ALARM_ID, fileName, atDate, title, body });
            return;
          } catch (err) {
            console.warn("Native custom-bell scheduling failed, falling back to builtin:", err);
          }
        }
      }

      const builtinBellId =
        chosenAlarmId && isBuiltinAlarmId(chosenAlarmId) ? chosenAlarmId : DEFAULT_BUILTIN_ID;

      try {
        await cancelCustomBellAlarm(NATIVE_ALARM_ID);
        await scheduleTimerNotification({ id: NATIVE_ALARM_ID, title, body, builtinBellId, atDate });
      } catch (err) {
        // Native scheduling failing (e.g. permission not granted, or
        // running in a plain browser tab without Capacitor) should never
        // break the in-app timer experience — it just means no closed-app
        // alarm this time. The in-app countdown/finish logic below is
        // completely unaffected either way.
        console.warn("Native alarm scheduling failed:", err);
      }
    },
    [computeEndDate]
  );

  const cancelNativeAlarm = useCallback(async () => {
    try {
      await cancelScheduledNotification(NATIVE_ALARM_ID);
    } catch (err) {
      console.warn("Native alarm cancel failed:", err);
    }
    try {
      await cancelCustomBellAlarm(NATIVE_ALARM_ID);
    } catch (err) {
      console.warn("Native custom-bell cancel failed:", err);
    }
  }, []);

  // LIVE STATUS BAR CARD — only reacts to genuine state changes
  // (start/pause/resume/finish), never the 500ms tick. The native side
  // ticks the visible countdown itself.
  useEffect(() => {
    if (!activeTimer) {
      hideLiveStatus();
      return;
    }

    const isBreak = activeTimer.session_type && activeTimer.session_type !== "focus";
    const title = isBreak ? "Break time" : activeTimer.task_name;
    const subtitle =
      activeTimer.pomodoro_group_id && activeTimer.total_rounds
        ? `Pomodoro ${activeTimer.round_number || 1} of ${activeTimer.total_rounds}${activeTimer.status === "paused" ? " · Paused" : ""}`
        : activeTimer.status === "paused"
        ? "Paused"
        : "Focus session";

    showLiveStatus({
      title,
      subtitle,
      endDate: activeTimer.status === "running" ? computeEndDate(activeTimer) : null,
      buttons: [
        {
          id: activeTimer.status === "running" ? "pause_timer" : "resume_timer",
          label: activeTimer.status === "running" ? "Pause" : "Resume",
        },
        { id: "stop_timer", label: "Stop" },
      ],
      data: { timerId: activeTimer.id },
    });
  }, [
    activeTimer?.id,
    activeTimer?.status,
    activeTimer?.task_name,
    activeTimer?.session_type,
    activeTimer?.round_number,
    activeTimer?.total_rounds,
    activeTimer?.pomodoro_group_id,
    activeTimer?.start_timestamp,
    activeTimer?.paused_at,
    activeTimer?.accumulated_pause_seconds,
    activeTimer?.duration_seconds,
    computeEndDate,
  ]);

  /* =======================================================
     LOAD ACTIVE TIMER ON MOUNT
  ======================================================= */

  const loadActiveTimer = useCallback(async () => {
    if (!userId) {
      setActiveTimer(null);
      setTimerLoading(false);
      return;
    }

    setTimerLoading(true);

    const { data, error } = await supabase
      .from("custom_timers")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["running", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Active timer load error:", error);
      setTimerMessage(error.message);
      setActiveTimer(null);
      setTimerLoading(false);
      return;
    }

    if (data) {
      const row = data as CustomTimerRow;
      setActiveTimer(row);
      setRemainingSeconds(computeRemaining(row));
      alarmFiredRef.current = false;

      if (row.status === "running") {
        const alreadyFinished = computeRemaining(row) <= 0;
        if (alreadyFinished) {
          // Time already ran out while the app was closed. The native
          // alarm already rang for this — don't play it again in-app,
          // but still do the normal "wrap up" bookkeeping (mark
          // completed, show rating modal / advance Pomodoro).
          alarmFiredRef.current = true;
          await finishTimer(row, { skipSound: true });
        } else {
          // Still genuinely running — make sure a native alarm is
          // scheduled for it (covers the case the app was killed by the
          // OS right after starting, before it had a chance to schedule).
          scheduleNativeAlarm(row);
        }
      } else {
        // Paused timers should never have a pending native alarm.
        cancelNativeAlarm();
      }
    } else {
      setActiveTimer(null);
    }

    setTimerLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, computeRemaining, scheduleNativeAlarm, cancelNativeAlarm]);

  useEffect(() => {
    loadActiveTimer();
  }, [loadActiveTimer]);

  /* =======================================================
     LOAD RECENT TIMERS (HISTORY)
  ======================================================= */

  const loadRecentTimers = useCallback(
    async (limit = 15) => {
      if (!userId) {
        setRecentTimers([]);
        setHistoryLoading(false);
        return [];
      }

      setHistoryLoading(true);

      const { data, error } = await supabase
        .from("custom_timers")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["completed", "stopped"])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Timer history load error:", error);
        setTimerMessage(error.message);
        setRecentTimers([]);
        setHistoryLoading(false);
        return [];
      }

      setRecentTimers((data as CustomTimerRow[]) || []);
      setHistoryLoading(false);
      return data || [];
    },
    [userId]
  );

  useEffect(() => {
    loadRecentTimers();
  }, [loadRecentTimers]);

  /* =======================================================
     PLAY ALARM (built-in or custom-uploaded)
     This is a UX fallback only — never used to fake data —
     so it's fine for it to quietly fall back to a default
     tone if the specific one can't be resolved.
  ======================================================= */

  const playTimerAlarm = useCallback(async (alarmId?: string | null) => {
    if (!alarmId || isBuiltinAlarmId(alarmId)) {
      playBuiltinAlarm(alarmId || DEFAULT_BUILTIN_ID);
      return;
    }

    const { data, error } = await supabase
      .from("alarms")
      .select("storage_path")
      .eq("id", alarmId)
      .maybeSingle();

    if (error || !data?.storage_path) {
      playBuiltinAlarm(DEFAULT_BUILTIN_ID);
      return;
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.storage_path, 60);

    if (signError || !signed?.signedUrl) {
      playBuiltinAlarm(DEFAULT_BUILTIN_ID);
      return;
    }

    const audio = new Audio(signed.signedUrl);
    audio.play().catch(() => playBuiltinAlarm(DEFAULT_BUILTIN_ID));
  }, []);

  /* =======================================================
     LIVE TICK — UI refresh only, NOT the source of truth.
     Also detects completion.
  ======================================================= */

  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "running") {
      if (activeTimer) {
        setRemainingSeconds(computeRemaining(activeTimer));
      }
      return;
    }

    const interval = setInterval(async () => {
      const remaining = computeRemaining(activeTimer);
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !alarmFiredRef.current) {
        alarmFiredRef.current = true;
        await finishTimer(activeTimer);
      }
    }, 500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimer, computeRemaining]);

  /* =======================================================
     FINISH (called automatically when remaining hits 0)
     Handles BOTH a plain custom timer AND one phase of a
     Pomodoro cycle.

     `skipSound` is set when we're just catching up on a
     completion that already happened (and already rang) while
     the app was closed — see loadActiveTimer above.
  ======================================================= */

  async function finishTimer(timer: CustomTimerRow, opts?: { skipSound?: boolean }) {
    // Whatever happens next, this timer is done — no native alarm should
    // still be pending for it.
    cancelNativeAlarm();

    if (!opts?.skipSound) {
      const alarmToPlay = resolveAlarmForTimer(timer);
      playTimerAlarm(alarmToPlay);
    }

    const end_timestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("custom_timers")
      .update({ status: "completed", end_timestamp })
      .eq("id", timer.id)
      .eq("user_id", userId)
      .select()
      .single();

    setActiveTimer(null);
    setRemainingSeconds(0);

    if (error) {
      console.error("Timer completion save error:", error);
      setTimerMessage(
        "Your session finished, but saving it failed: " + error.message
      );
      // Still let the person move on using the local shape so the
      // rating modal / next Pomodoro phase can proceed — but the
      // message above tells them the save didn't actually happen.
      const fallbackRow: CustomTimerRow = { ...timer, status: "completed", end_timestamp };
      if (fallbackRow.pomodoro_group_id) {
        handlePomodoroAdvance(fallbackRow);
      } else {
        setPendingRatingTimer(fallbackRow);
      }
      return;
    }

    loadRecentTimers();

    const updated = data as CustomTimerRow;
    if (updated.pomodoro_group_id) {
      handlePomodoroAdvance(updated);
    } else {
      setPendingRatingTimer(updated);
    }
  }

  /* =======================================================
     POMODORO CYCLE ADVANCEMENT
  ======================================================= */

  function handlePomodoroAdvance(row: CustomTimerRow) {
    const justFinishedFocus = row.session_type === "focus";
    const cycleFinished =
      justFinishedFocus && row.total_rounds && row.round_number && row.round_number >= row.total_rounds;

    if (cycleFinished) {
      setPendingRatingTimer({ ...row, isPomodoroFinale: true });
      return;
    }

    let nextType: "focus" | "short_break" | "long_break";
    let nextDuration: number;
    let nextRound: number;

    const currentRound = row.round_number || 1;

    if (justFinishedFocus) {
      const isLongBreak =
        row.rounds_before_long_break &&
        currentRound % row.rounds_before_long_break === 0;

      nextType = isLongBreak ? "long_break" : "short_break";
      nextDuration = (isLongBreak ? row.long_break_seconds : row.break_seconds) || 300;
      nextRound = currentRound;
    } else {
      nextType = "focus";
      nextDuration = row.work_seconds || 1500;
      nextRound = currentRound + 1;
    }

    // `...row` already carries `color` forward from whatever the cycle was
    // started with, so every phase (focus, short break, long break) of the
    // same Pomodoro cycle keeps the same color the user picked at the
    // start — no separate per-phase color concept needed.
    const nextPhase: PomodoroPhaseInfo = {
      ...row,
      nextType,
      nextDuration,
      nextRound,
    };

    if (row.auto_advance === false) {
      setPendingNextPhase(nextPhase);
    } else {
      launchPomodoroPhase(nextPhase);
    }
  }

  async function launchPomodoroPhase(nextPhase: PomodoroPhaseInfo) {
    setPendingNextPhase(null);
    setTimerMessage("");

    const { data, error } = await supabase
      .from("custom_timers")
      .insert({
        user_id: userId,
        task_name: nextPhase.task_name,
        duration_seconds: nextPhase.nextDuration,
        alarm_id: nextPhase.alarm_id,
        break_alarm_id: nextPhase.break_alarm_id,
        color: nextPhase.color || null,
        session_type: nextPhase.nextType,
        round_number: nextPhase.nextRound,
        total_rounds: nextPhase.total_rounds,
        work_seconds: nextPhase.work_seconds,
        break_seconds: nextPhase.break_seconds,
        long_break_seconds: nextPhase.long_break_seconds,
        rounds_before_long_break: nextPhase.rounds_before_long_break,
        pomodoro_group_id: nextPhase.pomodoro_group_id,
        auto_advance: nextPhase.auto_advance,
        start_timestamp: new Date().toISOString(),
        accumulated_pause_seconds: 0,
        status: "running",
      })
      .select()
      .single();

    if (error) {
      console.error("Pomodoro phase start error:", error);
      setTimerMessage("Couldn't start the next phase: " + error.message);
      return;
    }

    const active = data as CustomTimerRow;
    alarmFiredRef.current = false;
    setActiveTimer(active);
    setRemainingSeconds(computeRemaining(active));
    scheduleNativeAlarm(active);
  }

  async function startNextPomodoroPhase() {
    if (!pendingNextPhase) return;
    await launchPomodoroPhase(pendingNextPhase);
  }

  async function skipPomodoroPhase() {
    if (!activeTimer || !activeTimer.pomodoro_group_id) return;
    await finishTimer(activeTimer);
  }

  /* =======================================================
     START POMODORO CYCLE
  ======================================================= */

  async function startPomodoroCycle({
    taskName,
    workMinutes = 25,
    breakMinutes = 5,
    longBreakMinutes,
    roundsBeforeLongBreak = 4,
    totalRounds = 4,
    alarmId,
    breakAlarmId,
    color,
    autoAdvance = true,
  }: {
    taskName: string;
    workMinutes: number;
    breakMinutes: number;
    longBreakMinutes?: number;
    roundsBeforeLongBreak?: number;
    totalRounds?: number;
    alarmId?: string | null;
    breakAlarmId?: string | null;
    color?: string | null;
    autoAdvance?: boolean;
  }) {
    if (!userId) {
      setTimerMessage("You are not logged in.");
      return { success: false };
    }

    const cleanName = (taskName || "Pomodoro Focus").trim() || "Pomodoro Focus";
    const workSeconds = Math.max(60, Math.round(workMinutes * 60));
    const breakSeconds = Math.max(30, Math.round(breakMinutes * 60));
    const longBreakSeconds = Math.max(
      60,
      Math.round((longBreakMinutes || breakMinutes * 3) * 60)
    );
    const groupId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setTimerMessage("");

    const { data, error } = await supabase
      .from("custom_timers")
      .insert({
        user_id: userId,
        task_name: cleanName,
        duration_seconds: workSeconds,
        alarm_id: alarmId || null,
        break_alarm_id: breakAlarmId || alarmId || null,
        color: color || null,
        session_type: "focus",
        round_number: 1,
        total_rounds: totalRounds || null,
        work_seconds: workSeconds,
        break_seconds: breakSeconds,
        long_break_seconds: longBreakSeconds,
        rounds_before_long_break: roundsBeforeLongBreak || 4,
        pomodoro_group_id: groupId,
        auto_advance: autoAdvance !== false,
        start_timestamp: new Date().toISOString(),
        accumulated_pause_seconds: 0,
        status: "running",
      })
      .select()
      .single();

    if (error) {
      console.error("Pomodoro start error:", error);
      setTimerMessage(error.message);
      return { success: false, error: error.message };
    }

    const active = data as CustomTimerRow;
    alarmFiredRef.current = false;
    setActiveTimer(active);
    setRemainingSeconds(computeRemaining(active));
    scheduleNativeAlarm(active);

    return { success: true, data: active };
  }

  /* =======================================================
     STOP THE WHOLE POMODORO CYCLE
  ======================================================= */

  async function stopPomodoroCycle() {
    setPendingNextPhase(null);
    if (activeTimer) {
      await stopCustomTimer();
    }
  }

  /* =======================================================
     START PLAIN CUSTOM TIMER
     (also used for Sequence-mode blocks — pass the block's own
     `color` through so its session/ring reflects that color)
  ======================================================= */

  async function startCustomTimer({
    taskName,
    durationMinutes,
    alarmId,
    color,
  }: {
    taskName: string;
    durationMinutes: number;
    alarmId?: string | null;
    color?: string | null;
  }) {
    if (!userId) {
      setTimerMessage("You are not logged in.");
      return { success: false };
    }

    const cleanName = (taskName || "Focus Session").trim() || "Focus Session";
    const durationSeconds = Math.max(1, Math.round(durationMinutes * 60));

    setTimerMessage("");

    const { data, error } = await supabase
      .from("custom_timers")
      .insert({
        user_id: userId,
        task_name: cleanName,
        duration_seconds: durationSeconds,
        alarm_id: alarmId || null,
        color: color || null,
        start_timestamp: new Date().toISOString(),
        accumulated_pause_seconds: 0,
        status: "running",
      })
      .select()
      .single();

    if (error) {
      console.error("Timer start error:", error);
      setTimerMessage(error.message);
      return { success: false, error: error.message };
    }

    const active = data as CustomTimerRow;
    alarmFiredRef.current = false;
    setActiveTimer(active);
    setRemainingSeconds(computeRemaining(active));
    scheduleNativeAlarm(active);

    return { success: true, data: active };
  }

  /* =======================================================
     PAUSE (works for plain timers AND any Pomodoro phase)
  ======================================================= */

  async function pauseCustomTimer() {
    if (!activeTimer || activeTimer.status !== "running") return;

    const { data, error } = await supabase
      .from("custom_timers")
      .update({
        status: "paused",
        paused_at: new Date().toISOString(),
      })
      .eq("id", activeTimer.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Timer pause error:", error);
      setTimerMessage(error.message);
      return;
    }

    const updated = data as CustomTimerRow;
    setActiveTimer(updated);
    setRemainingSeconds(computeRemaining(updated));
    cancelNativeAlarm();
  }

  /* =======================================================
     RESUME
  ======================================================= */

  async function resumeCustomTimer() {
    if (!activeTimer || activeTimer.status !== "paused") return;

    const pausedDuration = activeTimer.paused_at
      ? Math.round((Date.now() - new Date(activeTimer.paused_at).getTime()) / 1000)
      : 0;

    const newAccumulated = Math.round((activeTimer.accumulated_pause_seconds || 0) + pausedDuration);

    const { data, error } = await supabase
      .from("custom_timers")
      .update({
        status: "running",
        paused_at: null,
        accumulated_pause_seconds: newAccumulated,
      })
      .eq("id", activeTimer.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Timer resume error:", error);
      setTimerMessage(error.message);
      return;
    }

    alarmFiredRef.current = false;
    const updated = data as CustomTimerRow;
    setActiveTimer(updated);
    setRemainingSeconds(computeRemaining(updated));
    scheduleNativeAlarm(updated);
  }

  /* =======================================================
     STOP (abandon before completion)
  ======================================================= */

  async function stopCustomTimer() {
    if (!activeTimer) return;

    const { error } = await supabase
      .from("custom_timers")
      .update({
        status: "stopped",
        end_timestamp: new Date().toISOString(),
      })
      .eq("id", activeTimer.id)
      .eq("user_id", userId);

    if (error) {
      console.error("Timer stop error:", error);
      setTimerMessage(error.message);
      return;
    }

    setActiveTimer(null);
    setRemainingSeconds(0);
    cancelNativeAlarm();
    loadRecentTimers();
  }

  /* =======================================================
     RATING (called from the rating modal after completion)
  ======================================================= */

  async function submitTimerRating(timerId: string, rating: number, note?: string) {
    const { error } = await supabase
      .from("custom_timers")
      .update({ rating: rating || null, note: note?.trim() || null })
      .eq("id", timerId)
      .eq("user_id", userId);

    if (error) {
      console.error("Timer rating save error:", error);
      setTimerMessage(error.message);
      return { success: false, error: error.message };
    }

    setPendingRatingTimer(null);
    loadRecentTimers();
    return { success: true };
  }

  function dismissRating() {
    setPendingRatingTimer(null);
  }

  /* =======================================================
     FORMAT HELPER
  ======================================================= */

  function formatTimer(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return {
    activeTimer,
    remainingSeconds,
    timerLoading,
    timerMessage,

    pendingRatingTimer,
    submitTimerRating,
    dismissRating,

    pendingNextPhase,
    startNextPomodoroPhase,
    skipPomodoroPhase,
    startPomodoroCycle,
    stopPomodoroCycle,

    recentTimers,
    historyLoading,
    loadRecentTimers,

    startCustomTimer,
    pauseCustomTimer,
    resumeCustomTimer,
    stopCustomTimer,

    formatTimer,
  };
}
