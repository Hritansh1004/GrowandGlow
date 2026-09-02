import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateStringFromISO(iso?: string | null) {
  if (!iso) return "";
  return toDateString(new Date(iso));
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const jsDay = d.getDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
  d.setDate(d.getDate() - mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// For period_sessions, planned_start/planned_end are full timestamps, so a
// direct Date diff is correct here.
function periodMinutes(session: any) {
  if (!session.planned_start || !session.planned_end) return 0;
  const ms =
    new Date(session.planned_end).getTime() - new Date(session.planned_start).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

// room_period_sessions AND planner_tasks both store planned_start/planned_end
// (or start_time/end_time, normalized to the same field names below) as bare
// TIME values ("09:00:00", no date attached) — feeding those into
// new Date(...) directly is unreliable across browsers, so this computes the
// duration from minutes-since-midnight instead, same approach as
// routineEngine.ts.
function timeBasedMinutes(session: any) {
  if (!session.planned_start || !session.planned_end) return 0;
  const toMinutes = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":");
    return Number(h) * 60 + Number(m);
  };
  const diff = toMinutes(session.planned_end) - toMinutes(session.planned_start);
  return Math.max(0, diff);
}

function timerActualSeconds(timer: any) {
  if (timer.status === "completed") {
    return timer.duration_seconds || 0;
  }
  if (timer.start_timestamp && timer.end_timestamp) {
    const elapsed =
      (new Date(timer.end_timestamp).getTime() -
        new Date(timer.start_timestamp).getTime()) /
        1000 -
      (timer.accumulated_pause_seconds || 0);
    return Math.max(0, Math.round(elapsed));
  }
  return 0;
}

// Normalizes a planner_tasks row into the same shape period_sessions/
// room_period_sessions rows already use (period_name, planned_start,
// planned_end, status, rating, note, session_date), tagged with
// `is_planner: true` so grouping/rendering can tell it apart from the
// other two sources the same way `is_room` already does for Room sessions.
function normalizePlannerTaskForHistory(row: any) {
  return {
    id: row.id,
    user_id: row.user_id,
    session_date: row.task_date,
    period_name: row.title || "Task",
    category: row.subject || "General",
    is_break: false,
    planned_start: row.start_time,
    planned_end: row.end_time,
    status: row.completed ? "completed" : "upcoming",
    rating: row.rating ?? null,
    note: row.note ?? null,
    is_planner: true,
  };
}

const STREAK_LOOKBACK_DAYS = 400;

const RANGE_LABELS: Record<string, string> = {
  today: "Today",
  week: "This Week",
  last7: "Last 7 Days",
  month: "This Month",
  lastMonth: "Last Month",
  year: "This Year",
  custom: "Custom Range",
};

export default function useHistory(userId: string | undefined | null) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateString(today), [today]);

  const [rangeKey, setRangeKey] = useState("week");
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  const [periodSessions, setPeriodSessions] = useState<any[]>([]);
  const [roomPeriodSessions, setRoomPeriodSessions] = useState<any[]>([]);
  const [plannerSessions, setPlannerSessions] = useState<any[]>([]);
  const [customTimers, setCustomTimers] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyMessage, setHistoryMessage] = useState("");

  const [streakActiveDates, setStreakActiveDates] = useState(new Set<string>());
  const [streakLoading, setStreakLoading] = useState(true);

  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    let start: Date;
    let end: Date;

    if (rangeKey === "today") {
      start = today;
      end = today;
    } else if (rangeKey === "week") {
      start = startOfWeek(today);
      end = addDays(start, 6);
    } else if (rangeKey === "last7") {
      start = addDays(today, -6);
      end = today;
    } else if (rangeKey === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = endOfMonth(today);
    } else if (rangeKey === "lastMonth") {
      const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      start = lastMonthDate;
      end = endOfMonth(lastMonthDate);
    } else if (rangeKey === "year") {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
    } else {
      start = customStart ? new Date(`${customStart}T00:00:00`) : today;
      end = customEnd ? new Date(`${customEnd}T00:00:00`) : today;
      if (end < start) {
        const swap = start;
        start = end;
        end = swap;
      }
    }

    return {
      rangeStart: toDateString(start),
      rangeEnd: toDateString(end),
      rangeLabel: RANGE_LABELS[rangeKey] || "Selected Range",
    };
  }, [rangeKey, customStart, customEnd, today]);

  const loadHistory = useCallback(async () => {
    if (!userId) {
      setPeriodSessions([]);
      setRoomPeriodSessions([]);
      setPlannerSessions([]);
      setCustomTimers([]);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryMessage("");

    const rangeStartInclusive = `${rangeStart}T00:00:00`;
    const rangeEndExclusive = `${rangeEnd}T23:59:59`;

    try {
      const [periodsRes, roomPeriodsRes, plannerRes, timersRes] = await Promise.all([
        supabase
          .from("period_sessions")
          .select("*")
          .eq("user_id", userId)
          .gte("session_date", rangeStart)
          .lte("session_date", rangeEnd)
          .order("planned_start", { ascending: true }),

        // Room Routine sessions — kept in their own table (per the user's
        // explicit decision) but merged in here so they read as part of
        // "their own History" everywhere it's consumed below.
        supabase
          .from("room_period_sessions")
          .select("*")
          .eq("user_id", userId)
          .gte("session_date", rangeStart)
          .lte("session_date", rangeEnd)
          .order("planned_start", { ascending: true }),

        // Planner tasks — previously never queried by History at all, so a
        // day made entirely of ad-hoc Planner tasks (no School-Mode
        // timetable assigned) showed nothing here. Merged in the same way
        // room sessions are, tagged `is_planner: true`.
        supabase
          .from("planner_tasks")
          .select("*")
          .eq("user_id", userId)
          .gte("task_date", rangeStart)
          .lte("task_date", rangeEnd)
          .order("start_time", { ascending: true }),

        supabase
          .from("custom_timers")
          .select("*")
          .eq("user_id", userId)
          .in("status", ["completed", "stopped"])
          .gte("start_timestamp", rangeStartInclusive)
          .lte("start_timestamp", rangeEndExclusive)
          .order("start_timestamp", { ascending: true }),
      ]);

      if (roomPeriodsRes.error) {
        console.error("room_period_sessions load error:", roomPeriodsRes.error);
      }
      if (plannerRes.error) {
        console.error("planner_tasks load error (useHistory):", plannerRes.error);
      }

      const loadedPeriods = periodsRes.data || [];
      const loadedRoomPeriods = (roomPeriodsRes.data || []).map((r: any) => ({
        ...r,
        is_room: true, // tag so groupedHistory/UI can tell these apart from solo periods
      }));
      const loadedPlanner = (plannerRes.data || []).map(normalizePlannerTaskForHistory);
      let loadedTimers = timersRes.data || [];

      if (loadedTimers.length === 0) {
        const saved = localStorage.getItem(`benchmate_recent_timers_${userId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          loadedTimers = parsed.filter((t: any) => {
            const date = localDateStringFromISO(t.start_timestamp);
            return date >= rangeStart && date <= rangeEnd;
          });
        }
      }

      setPeriodSessions(loadedPeriods);
      setRoomPeriodSessions(loadedRoomPeriods);
      setPlannerSessions(loadedPlanner);
      setCustomTimers(loadedTimers);
    } catch {
      const saved = localStorage.getItem(`benchmate_recent_timers_${userId}`);
      const parsed = saved ? JSON.parse(saved) : [];
      setCustomTimers(parsed);
      setPeriodSessions([]);
      setRoomPeriodSessions([]);
      setPlannerSessions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [userId, rangeStart, rangeEnd]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadStreakData = useCallback(async () => {
    if (!userId) {
      setStreakActiveDates(new Set());
      setStreakLoading(false);
      return;
    }

    setStreakLoading(true);
    const streakStart = toDateString(addDays(today, -STREAK_LOOKBACK_DAYS));
    const dates = new Set<string>();

    try {
      const [periodsRes, roomPeriodsRes, plannerRes, timersRes] = await Promise.all([
        supabase
          .from("period_sessions")
          .select("session_date, status")
          .eq("user_id", userId)
          .eq("status", "completed")
          .gte("session_date", streakStart),

        supabase
          .from("room_period_sessions")
          .select("session_date, status")
          .eq("user_id", userId)
          .eq("status", "completed")
          .gte("session_date", streakStart),

        supabase
          .from("planner_tasks")
          .select("task_date, completed")
          .eq("user_id", userId)
          .eq("completed", true)
          .gte("task_date", streakStart),

        supabase
          .from("custom_timers")
          .select("start_timestamp")
          .eq("user_id", userId)
          .eq("status", "completed")
          .gte("start_timestamp", `${streakStart}T00:00:00`),
      ]);

      (periodsRes.data || []).forEach((p: any) => {
        if (p.session_date) dates.add(p.session_date);
      });

      (roomPeriodsRes.data || []).forEach((p: any) => {
        if (p.session_date) dates.add(p.session_date);
      });

      (plannerRes.data || []).forEach((p: any) => {
        if (p.task_date) dates.add(p.task_date);
      });

      (timersRes.data || []).forEach((t: any) => {
        const dateStr = localDateStringFromISO(t.start_timestamp);
        if (dateStr) dates.add(dateStr);
      });

      const saved = localStorage.getItem(`benchmate_recent_timers_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.forEach((t: any) => {
          const dateStr = localDateStringFromISO(t.start_timestamp);
          if (dateStr) dates.add(dateStr);
        });
      }

      setStreakActiveDates(dates);
    } catch {
      setStreakActiveDates(new Set());
    } finally {
      setStreakLoading(false);
    }
  }, [userId, today, todayStr]);

  useEffect(() => {
    loadStreakData();
  }, [loadStreakData]);

  const { currentStreak, longestStreak } = useMemo(() => {
    let current = 0;
    let cursor = new Date(today);

    while (streakActiveDates.has(toDateString(cursor))) {
      current += 1;
      cursor = addDays(cursor, -1);
    }

    let longest = 0;
    let running = 0;

    for (let i = STREAK_LOOKBACK_DAYS; i >= 0; i--) {
      const dateStr = toDateString(addDays(today, -i));
      if (streakActiveDates.has(dateStr)) {
        running += 1;
        longest = Math.max(longest, running);
      } else {
        running = 0;
      }
    }

    return { currentStreak: current, longestStreak: longest };
  }, [streakActiveDates, today]);

  // Merged view: solo period_sessions + room_period_sessions + planner_tasks,
  // combined into one list per day. Field names were deliberately kept
  // identical across all three (period_name, planned_start, planned_end,
  // rating, status, is_break, session_date) so everything downstream —
  // grouping, stats, rendering — treats them uniformly. Only the
  // `is_room`/`room_name` and `is_planner` tags distinguish them visually.
  const allPeriods = useMemo(
    () => [...periodSessions, ...roomPeriodSessions, ...plannerSessions],
    [periodSessions, roomPeriodSessions, plannerSessions]
  );

  function minutesFor(session: any) {
    return session.is_room || session.is_planner ? timeBasedMinutes(session) : periodMinutes(session);
  }

  const groupedHistory = useMemo(() => {
    const days: any[] = [];
    const start = new Date(`${rangeStart}T00:00:00`);
    const end = new Date(`${rangeEnd}T00:00:00`);
    const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const safeDayCount = Math.max(1, Math.min(dayCount, 400));

    for (let i = safeDayCount - 1; i >= 0; i--) {
      const dateObj = addDays(end, -i);
      const dateStr = toDateString(dateObj);

      const periods = allPeriods
        .filter((p) => p.session_date === dateStr)
        .slice()
        .sort((a, b) => (a.planned_start || "").localeCompare(b.planned_start || ""));

      const timers = customTimers
        .filter((t) => localDateStringFromISO(t.start_timestamp) === dateStr)
        .slice()
        .sort((a, b) => (a.start_timestamp || "").localeCompare(b.start_timestamp || ""));

      const studyPeriods = periods.filter((p) => !p.is_break);
      const completedPeriods = studyPeriods.filter((p) => p.status === "completed");
      const finalizedPeriods = studyPeriods.filter(
        (p) => p.status === "completed" || p.status === "missed"
      );
      const completedTimers = timers.filter((t) => t.status === "completed");

      const plannedMinutes = studyPeriods.reduce((sum, p) => sum + minutesFor(p), 0);
      const completedPeriodMinutes = completedPeriods.reduce((sum, p) => sum + minutesFor(p), 0);
      const timerMinutes = timers.reduce((sum, t) => sum + timerActualSeconds(t) / 60, 0);

      const totalFocusMinutes = completedPeriodMinutes + timerMinutes;

      const ratings = [
        ...periods.filter((p) => p.rating).map((p) => p.rating),
        ...timers.filter((t) => t.rating).map((t) => t.rating),
      ];

      const averageRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
          : null;

      const completedCount = completedPeriods.length + completedTimers.length;

      const completionPercent =
        finalizedPeriods.length > 0
          ? Math.round((completedPeriods.length / finalizedPeriods.length) * 100)
          : studyPeriods.length > 0
          ? 0
          : null;

      const hasActivity = completedCount > 0 || timers.length > 0;

      const dateLabel = dateObj.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      if (hasActivity || rangeKey === "today" || rangeKey === "yesterday") {
        days.push({
          date: dateStr,
          dateLabel,
          periods,
          timers,
          periodSessions: periods,
          customTimers: timers,
          totalMinutes: totalFocusMinutes,
          stats: {
            hasActivity,
            totalFocusMinutes,
            completedCount,
            averageRating,
            totalPlannedCount: studyPeriods.length,
            plannedMinutes,
            completedPeriodMinutes,
            completionPercent,
          },
        });
      }
    }

    return days;
  }, [allPeriods, customTimers, rangeStart, rangeEnd, rangeKey]);

  const overallStats = useMemo(() => {
    const studyPeriods = allPeriods.filter((p) => !p.is_break);
    const completedPeriods = studyPeriods.filter((p) => p.status === "completed");
    const finalizedPeriods = studyPeriods.filter(
      (p) => p.status === "completed" || p.status === "missed"
    );
    const completedTimers = customTimers.filter((t) => t.status === "completed");

    const completedPeriodMinutes = completedPeriods.reduce((sum, p) => sum + minutesFor(p), 0);
    const timerMinutes = customTimers.reduce((sum, t) => sum + timerActualSeconds(t) / 60, 0);
    const totalFocusMinutes = completedPeriodMinutes + timerMinutes;

    const ratings = [
      ...allPeriods.filter((p) => p.rating).map((p) => p.rating),
      ...customTimers.filter((t) => t.rating).map((t) => t.rating),
    ];

    const averageRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
        : null;

    const completionRate =
      finalizedPeriods.length > 0
        ? Math.round((completedPeriods.length / finalizedPeriods.length) * 100)
        : null;

    return {
      totalFocusMinutes,
      averageRating,
      completionRate,
      currentStreak,
      longestStreak,
      totalSessions: completedPeriods.length + completedTimers.length,
    };
  }, [allPeriods, customTimers, currentStreak, longestStreak]);

  // NEW — Core Vision 8.7/8.8: lets History edit the rating + written
  // review for ANY past Routine period session, on ANY date, not just a
  // live "today" completion. No time-window cutoff (unlike Timer's Recent
  // Focus Sessions 48h edit window) — Routine history is meant to be
  // permanently browsable and editable per the Master Vision. Works for
  // solo period_sessions, room_period_sessions, AND planner_tasks, since
  // all three were normalized to the same column names for exactly this
  // kind of shared-handling.
  async function submitPeriodSessionRating(
    session: any,
    rating: number,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    const table = session?.is_room
      ? "room_period_sessions"
      : session?.is_planner
      ? "planner_tasks"
      : "period_sessions";

    const { error } = await supabase
      .from(table)
      .update({ rating: rating || null, note: note?.trim() || null })
      .eq("id", session.id)
      .eq("user_id", userId);

    if (error) {
      console.error("submitPeriodSessionRating error:", error);
      setHistoryMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadHistory();
    return { success: true };
  }

  return {
    rangeKey,
    setRangeKey,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    rangeLabel,
    groupedHistory,
    overallStats,
    historyLoading: historyLoading || streakLoading,
    historyMessage,
    reloadHistory: loadHistory,
    submitPeriodSessionRating,
  };
}
