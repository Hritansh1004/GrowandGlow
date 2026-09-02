import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playBuiltinAlarm, DEFAULT_BUILTIN_ID, isBuiltinAlarmId } from "../lib/alarmSounds";
import {
  getEffectiveDayItems,
  editDayItem,
  deleteDayItem,
  setPlannerItemCompleted,
  submitPlannerItemRating,
  type DayItem,
} from "../lib/daySchedule";

const BUCKET = "custom-audio";

export interface RoutineItem {
  id: string; // = DayItem.key, stable per load
  rowId: string;
  source: "template" | "one_off" | "planner";
  overrideId?: string;
  time: string;
  end: string;
  subject: string;
  title: string;
  description: string;
  type: "Study" | "Break";
  alarmId: string | null;
  color?: string | null;
  sessionId?: string | null;
  sessionStatus?: "upcoming" | "active" | "completed" | "missed";
  completed?: boolean;
  rating?: number | null;
  note?: string | null;
}

export interface PeriodSessionRow {
  id: string;
  user_id: string;
  session_date: string;
  period_name: string;
  category: string;
  is_break: boolean;
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  status: "upcoming" | "active" | "completed" | "missed";
  rating?: number | null;
  note?: string | null;
}

function getTodayDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimestamp(dateString: string, hhmm: string) {
  if (!hhmm) return null;
  return new Date(`${dateString}T${hhmm}:00`).toISOString();
}

function dayItemToRoutineItem(item: DayItem): RoutineItem {
  return {
    id: item.key,
    rowId: item.rowId,
    source: item.source,
    overrideId: item.overrideId,
    time: item.time,
    end: item.end,
    subject: item.subject,
    title: item.title,
    description: item.description,
    type: item.isBreak ? "Break" : "Study",
    alarmId: item.alarmId,
    color: item.color ?? null,
    completed: item.completed,
    rating: item.rating,
    note: item.note,
  };
}

export default function useRoutine(userId: string | undefined | null) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [rawItems, setRawItems] = useState<RoutineItem[]>([]);
  const [routineSource, setRoutineSource] = useState<"template" | "one_off" | "holiday" | "no_routine" | "none">("none");
  const [routineLoading, setRoutineLoading] = useState(true);
  const [routineLabel, setRoutineLabel] = useState("");
  const [routineMessage, setRoutineMessage] = useState("");

  const [sessionsByStart, setSessionsByStart] = useState<Record<string, PeriodSessionRow>>({});
  const [pendingRatingSession, setPendingRatingSession] = useState<PeriodSessionRow | null>(null);

  const finalizingRef = useRef(new Set<string>());

  /* =========================
     LIVE CLOCK
  ========================= */

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function timeToMinutes(time: string) {
    if (!time) return 0;
    const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
    return hours * 60 + minutes;
  }

  function getSecondsFromTime(time: string) {
    if (!time) return 0;
    const [hours, minutes, seconds = 0] = time.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  function formatRemaining(totalSeconds: number) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  /* =========================
     ALARM PLAYBACK

     NOTE: this fires correctly whenever the app tab is open and the
     countdown reaches zero — the call already existed before this rewrite.
     If you're not hearing it, the most common cause is the browser tab
     being closed/backgrounded when the period actually ends (a web app
     genuinely cannot play audio while its tab isn't running — this is a
     browser limitation, not a bug in this code). Test it with the Routine
     tab open and in the foreground when a period ends.
  ========================= */

  const playPeriodAlarm = useCallback(async (alarmId: string | null) => {
    if (!alarmId || isBuiltinAlarmId(alarmId)) {
      playBuiltinAlarm(alarmId || DEFAULT_BUILTIN_ID);
      return;
    }

    try {
      const { data } = await supabase
        .from("alarms")
        .select("storage_path")
        .eq("id", alarmId)
        .maybeSingle();

      if (!data?.storage_path) {
        playBuiltinAlarm(DEFAULT_BUILTIN_ID);
        return;
      }

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(data.storage_path, 60);

      if (!signed?.signedUrl) {
        playBuiltinAlarm(DEFAULT_BUILTIN_ID);
        return;
      }

      const audio = new Audio(signed.signedUrl);
      audio.play().catch(() => playBuiltinAlarm(DEFAULT_BUILTIN_ID));
    } catch {
      playBuiltinAlarm(DEFAULT_BUILTIN_ID);
    }
  }, []);

  /* =========================
     LOAD TODAY'S EFFECTIVE SCHEDULE
     (via shared daySchedule.ts — now includes Planner tasks merged in)
  ========================= */

  const loadRoutine = useCallback(async () => {
    if (!userId) {
      setRawItems([]);
      setRoutineSource("none");
      setRoutineLoading(false);
      return;
    }

    setRoutineLoading(true);
    setRoutineMessage("");
    const dateString = getTodayDateString(new Date());

    try {
      const result = await getEffectiveDayItems(userId, dateString);
      const items = result.items.map(dayItemToRoutineItem);

      setRawItems(items);
      setRoutineSource(result.routineSource);
      setRoutineLabel(result.routineLabel);

      // Only template/one_off items need timestamp-based session tracking —
      // planner items already carry their own `completed` flag directly.
      const periodItems = items.filter((i) => i.source !== "planner");
      await syncTodaySessions(periodItems, dateString);
    } catch (e: any) {
      console.error("loadRoutine unexpected error:", e);
      setRawItems([]);
      setRoutineSource("none");
      setRoutineMessage(`Could not load today's schedule: ${e?.message || "Network error."}`);
    } finally {
      setRoutineLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);

  /* =========================
     SYNC TODAY'S PERIOD SESSIONS
     (template + one_off items only — creates/loads the period_sessions
     rows that drive the live countdown, alarm-on-completion, and rating)
  ========================= */

  async function syncTodaySessions(periodItems: RoutineItem[], dateString: string) {
    if (!userId) return;

    try {
      const { data: existing, error: existingError } = await supabase
        .from("period_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("session_date", dateString);

      if (existingError) console.error("period_sessions load error:", existingError);

      const existingByStart: Record<string, PeriodSessionRow> = {};
      (existing || []).forEach((row: any) => {
        existingByStart[row.planned_start] = row;
      });

      const now = new Date();
      const toInsert: any[] = [];

      periodItems.forEach((item) => {
        const plannedStart = toTimestamp(dateString, item.time);
        const plannedEnd = toTimestamp(dateString, item.end);
        if (!plannedStart || !plannedEnd) return;

        if (existingByStart[plannedStart]) return;

        let status: "upcoming" | "active" | "completed" | "missed" = "upcoming";
        let actual_start: string | null = null;
        let actual_end: string | null = null;

        if (now >= new Date(plannedEnd)) {
          status = item.type === "Break" ? "completed" : "missed";
          actual_end = plannedEnd;
        } else if (now >= new Date(plannedStart)) {
          status = "active";
          actual_start = new Date().toISOString();
        }

        toInsert.push({
          user_id: userId,
          session_date: dateString,
          period_name: item.title,
          category: item.subject,
          is_break: item.type === "Break",
          planned_start: plannedStart,
          planned_end: plannedEnd,
          actual_start,
          actual_end,
          status,
        });
      });

      if (toInsert.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("period_sessions")
          .insert(toInsert)
          .select();

        if (insertError) console.error("period_sessions insert error:", insertError);

        (inserted || toInsert).forEach((row: any) => {
          existingByStart[row.planned_start] = row;
        });
      }

      setSessionsByStart(existingByStart);
    } catch (e) {
      console.error("syncTodaySessions unexpected error:", e);
    }
  }

  /* =========================
     LIVE TRANSITION CHECK (template/one_off items only)
  ========================= */

  useEffect(() => {
    if (!userId || rawItems.length === 0) return;
    const now = currentTime;
    const dateString = getTodayDateString(now);

    rawItems
      .filter((item) => item.source !== "planner")
      .forEach((item) => {
        const plannedStart = item.time ? toTimestamp(dateString, item.time) : null;
        const plannedEnd = item.end ? toTimestamp(dateString, item.end) : null;
        if (!plannedStart || !plannedEnd) return;

        const session = sessionsByStart[plannedStart];
        if (!session) return;

        const key = session.id;

        if (session.status === "upcoming" && now >= new Date(plannedStart) && now < new Date(plannedEnd)) {
          markSessionActive(session);
          return;
        }

        if (session.status === "active" && now >= new Date(plannedEnd) && !finalizingRef.current.has(key)) {
          finalizingRef.current.add(key);
          finalizeSession(session, item);
        }
      });
  }, [currentTime, rawItems, sessionsByStart, userId]);

  async function markSessionActive(session: PeriodSessionRow) {
    try {
      const { data, error } = await supabase
        .from("period_sessions")
        .update({ status: "active", actual_start: new Date().toISOString() })
        .eq("id", session.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) console.error("markSessionActive error:", error);

      if (data) {
        setSessionsByStart((prev) => ({ ...prev, [data.planned_start]: data as PeriodSessionRow }));
      }
    } catch (e) {
      console.error("markSessionActive exception:", e);
    }
  }

  async function finalizeSession(session: PeriodSessionRow, routineItem: RoutineItem) {
    playPeriodAlarm(routineItem.alarmId);

    try {
      const { data, error } = await supabase
        .from("period_sessions")
        .update({ status: "completed", actual_end: new Date().toISOString() })
        .eq("id", session.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) console.error("finalizeSession error:", error);

      finalizingRef.current.delete(session.id);

      if (data) {
        setSessionsByStart((prev) => ({ ...prev, [data.planned_start]: data as PeriodSessionRow }));
        if (!session.is_break) {
          setPendingRatingSession(data as PeriodSessionRow);
        }
      }
    } catch (e) {
      console.error("finalizeSession exception:", e);
      finalizingRef.current.delete(session.id);
    }
  }

  async function submitPeriodRating(sessionId: string, rating: number, note?: string) {
    try {
      const { error } = await supabase
        .from("period_sessions")
        .update({ rating: rating || null, note: note?.trim() || null })
        .eq("id", sessionId)
        .eq("user_id", userId);

      if (error) {
        console.error("submitPeriodRating error:", error);
        setPendingRatingSession(null);
        return { success: false, error: error.message };
      }
    } catch (e) {
      console.error("submitPeriodRating exception:", e);
    }

    setPendingRatingSession(null);
    return { success: true };
  }

  function dismissPeriodRating() {
    setPendingRatingSession(null);
  }

  /* =========================
     PLANNER TASK AUTO-COMPLETION + ALARM

     Two ways a planner task can finish:
       1. Manually — the user taps the checkbox in Routine/Planner before
          the scheduled end time (togglePlannerItemInRoutine, below).
       2. Automatically — the scheduled end time passes without the user
          having marked it done. This effect handles that second case: it
          rings the chosen alarm once, marks the task completed, and
          surfaces a rating prompt (pendingPlannerRating) exactly like a
          template period does when its live session finalizes.

     Both paths write to the same `planner_tasks.completed` column, so
     whichever happens first "wins" — finishing early manually simply means
     this effect never has anything to do for that item (it only acts on
     items that are still NOT completed once their end time has passed).
  ========================= */

  const plannerAlarmFiredRef = useRef(new Set<string>());
  const plannerAutoCompletingRef = useRef(new Set<string>());
  const [pendingPlannerRating, setPendingPlannerRating] = useState<RoutineItem | null>(null);

  useEffect(() => {
    if (!userId || rawItems.length === 0) return;
    const now = currentTime;
    const dateString = getTodayDateString(now);

    rawItems
      .filter((item) => item.source === "planner")
      .forEach((item) => {
        const plannedEnd = item.end ? toTimestamp(dateString, item.end) : null;
        if (!plannedEnd) return;
        if (now < new Date(plannedEnd)) return;

        // Ring once, regardless of whether it was already completed
        // manually before the end time (the bell is a time cue, not a
        // completion cue).
        if (!plannerAlarmFiredRef.current.has(item.id)) {
          plannerAlarmFiredRef.current.add(item.id);
          playPeriodAlarm(item.alarmId);
        }

        // Auto-complete only if it isn't already completed (covers the
        // "finished early via manual toggle" case — nothing to do there)
        // and only once per item per load (guarded by the ref, since this
        // effect re-runs every clock tick).
        if (!item.completed && !plannerAutoCompletingRef.current.has(item.id)) {
          plannerAutoCompletingRef.current.add(item.id);

          (async () => {
            const res = await setPlannerItemCompleted(item.rowId, true);
            if (res.success) {
              setPendingPlannerRating(item);
              await loadRoutine();
            } else {
              // Allow retry on a future tick rather than leaving this item
              // permanently stuck un-completed after a transient failure.
              plannerAutoCompletingRef.current.delete(item.id);
            }
          })();
        }
      });
  }, [currentTime, rawItems, userId, playPeriodAlarm, loadRoutine]);

  function dismissPlannerRating() {
    setPendingPlannerRating(null);
  }

  /* =========================
     PLANNER-ITEM ACTIONS (available directly from Routine now)
  ========================= */

  async function togglePlannerItemInRoutine(item: RoutineItem) {
    if (item.source !== "planner") return { success: false, error: "Not a planner item." };
    const res = await setPlannerItemCompleted(item.rowId, !item.completed);
    if (res.success) await loadRoutine();
    return res;
  }

  async function submitPlannerRatingInRoutine(item: RoutineItem, rating: number, note?: string) {
    if (item.source !== "planner") return { success: false, error: "Not a planner item." };
    const res = await submitPlannerItemRating(item.rowId, rating, note);
    if (res.success) await loadRoutine();
    return res;
  }

  /* =========================
     UNIVERSAL EDIT / DELETE
     Works for any item regardless of source (planner task, one-off period,
     or template period) — writes to whichever table it actually came from.
  ========================= */

  async function editRoutineItem(
    item: RoutineItem,
    changes: {
      title?: string;
      subject?: string;
      time?: string;
      end?: string;
      alarmId?: string | null;
      color?: string | null;
    }
  ) {
    const dayItem: DayItem = {
      key: item.id,
      rowId: item.rowId,
      source: item.source,
      time: item.time,
      end: item.end,
      title: item.title,
      subject: item.subject,
      description: item.description,
      isBreak: item.type === "Break",
      alarmId: item.alarmId,
      completed: Boolean(item.completed),
      rating: item.rating ?? null,
      note: item.note ?? null,
      overrideId: item.overrideId,
    };
    const res = await editDayItem(dayItem, changes);
    if (res.success) await loadRoutine();
    return res;
  }

  async function deleteRoutineItem(item: RoutineItem) {
    const dayItem: DayItem = {
      key: item.id,
      rowId: item.rowId,
      source: item.source,
      time: item.time,
      end: item.end,
      title: item.title,
      subject: item.subject,
      description: item.description,
      isBreak: item.type === "Break",
      alarmId: item.alarmId,
      completed: Boolean(item.completed),
      rating: item.rating ?? null,
      note: item.note ?? null,
      overrideId: item.overrideId,
    };
    const res = await deleteDayItem(dayItem);
    if (res.success) await loadRoutine();
    return res;
  }

  /* =========================
     ENRICHED ROUTINE (session status merged in for template/one_off)
  ========================= */

  const enrichedRoutine: RoutineItem[] = useMemo(() => {
    const dateString = getTodayDateString(currentTime);

    return rawItems.map((item) => {
      if (item.source === "planner") {
        // Planner items already carry completed/rating directly.
        return item;
      }

      const plannedStart = toTimestamp(dateString, item.time);
      const session = plannedStart ? sessionsByStart[plannedStart] : undefined;

      return {
        ...item,
        sessionId: session?.id || null,
        sessionStatus: session?.status || "upcoming",
        completed: session?.status === "completed" || session?.status === "missed",
        rating: session?.rating ?? null,
        note: session?.note ?? null,
      };
    });
  }, [rawItems, sessionsByStart, currentTime]);

  function getCurrentRoutineItem(): RoutineItem | undefined {
    const nowSeconds =
      currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();

    return enrichedRoutine.find((item) => {
      if (item.completed) return false;
      const startSeconds = getSecondsFromTime(item.time);
      const endSeconds = getSecondsFromTime(item.end);
      return nowSeconds >= startSeconds && nowSeconds < endSeconds;
    });
  }

  function getNextRoutineItem(): RoutineItem | undefined {
    const nowSeconds =
      currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();

    return enrichedRoutine.find((item) => {
      if (item.completed) return false;
      return getSecondsFromTime(item.time) > nowSeconds;
    });
  }

  const currentRoutineItem = getCurrentRoutineItem();
  const nextRoutineItem = getNextRoutineItem();

  const currentRoutineSeconds = currentRoutineItem
    ? Math.max(
        0,
        getSecondsFromTime(currentRoutineItem.end) -
          (currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds())
      )
    : 0;

  const nextRoutineSeconds = nextRoutineItem
    ? Math.max(
        0,
        getSecondsFromTime(nextRoutineItem.time) -
          (currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds())
      )
    : 0;

  const completedRoutine = useMemo(
    () => enrichedRoutine.filter((item) => item.completed),
    [enrichedRoutine]
  );

  const remainingRoutine = useMemo(
    () => enrichedRoutine.filter((item) => !item.completed),
    [enrichedRoutine]
  );

  return {
    routine: enrichedRoutine,
    routineSource,
    routineLabel,
    routineLoading,
    routineMessage,
    reloadRoutine: loadRoutine,
    currentTime,
    currentRoutineItem,
    nextRoutineItem,
    currentRoutineSeconds,
    nextRoutineSeconds,
    completedRoutine,
    remainingRoutine,
    pendingRatingSession,
    submitPeriodRating,
    dismissPeriodRating,
    pendingPlannerRating,
    dismissPlannerRating,
    togglePlannerItemInRoutine,
    submitPlannerRatingInRoutine,
    editRoutineItem,
    deleteRoutineItem,
    timeToMinutes,
    formatRemaining,
  };
}