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

// For period_sessions, planned_start/planned_end are full timestamps.
function periodMinutes(session: any) {
  if (!session.planned_start || !session.planned_end) return 0;
  const ms =
    new Date(session.planned_end).getTime() - new Date(session.planned_start).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

// room_period_sessions stores planned_start/planned_end as bare TIME
// ("09:00:00", no date) — computed from minutes-since-midnight instead of
// new Date(...), same approach as routineEngine.ts / useHistory.ts.
function roomPeriodMinutes(session: any) {
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

const HEATMAP_DAYS = 182;
const CHART_WEEKS = 8;

export default function useAnalytics(userId: string | undefined | null) {
  const [periodSessions, setPeriodSessions] = useState<any[]>([]);
  const [roomPeriodSessions, setRoomPeriodSessions] = useState<any[]>([]);
  const [customTimers, setCustomTimers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const rangeStartDate = useMemo(() => addDays(new Date(), -HEATMAP_DAYS), []);
  const rangeStart = useMemo(() => toDateString(rangeStartDate), [rangeStartDate]);
  const rangeEnd = useMemo(() => toDateString(new Date()), []);

  const loadAnalytics = useCallback(async () => {
    if (!userId) {
      setPeriodSessions([]);
      setRoomPeriodSessions([]);
      setCustomTimers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const rangeStartInclusive = `${rangeStart}T00:00:00`;
    const rangeEndExclusive = `${rangeEnd}T23:59:59`;

    try {
      const [periodsRes, roomPeriodsRes, timersRes] = await Promise.all([
        supabase
          .from("period_sessions")
          .select("*")
          .eq("user_id", userId)
          .gte("session_date", rangeStart)
          .lte("session_date", rangeEnd),

        // Room Routine sessions — must count toward personal Analytics
        // (streaks, heatmap, weekly chart, category breakdown), per the
        // user's explicit confirmed requirement, not just show in History.
        supabase
          .from("room_period_sessions")
          .select("*")
          .eq("user_id", userId)
          .gte("session_date", rangeStart)
          .lte("session_date", rangeEnd),

        supabase
          .from("custom_timers")
          .select("*")
          .eq("user_id", userId)
          .in("status", ["completed", "stopped"])
          .gte("start_timestamp", rangeStartInclusive)
          .lte("start_timestamp", rangeEndExclusive),
      ]);

      if (roomPeriodsRes.error) {
        console.error("room_period_sessions load error:", roomPeriodsRes.error);
      }

      const periods = periodsRes.data || [];
      const roomPeriods = (roomPeriodsRes.data || []).map((r: any) => ({ ...r, is_room: true }));
      let timers = timersRes.data || [];

      if (timers.length === 0) {
        const saved = localStorage.getItem(`benchmate_recent_timers_${userId}`);
        if (saved) {
          timers = JSON.parse(saved);
        }
      }

      setPeriodSessions(periods);
      setRoomPeriodSessions(roomPeriods);
      setCustomTimers(timers);
    } catch {
      const saved = localStorage.getItem(`benchmate_recent_timers_${userId}`);
      setCustomTimers(saved ? JSON.parse(saved) : []);
      setPeriodSessions([]);
      setRoomPeriodSessions([]);
    } finally {
      setLoading(false);
    }
  }, [userId, rangeStart, rangeEnd]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Merged solo + room periods — same field names on both tables by design
  // (see useHistory.ts), so everything below treats them uniformly except
  // where minutesFor() branches on is_room for the TIME-vs-timestamp
  // duration calculation.
  const allPeriods = useMemo(
    () => [...periodSessions, ...roomPeriodSessions],
    [periodSessions, roomPeriodSessions]
  );

  function minutesFor(session: any) {
    return session.is_room ? roomPeriodMinutes(session) : periodMinutes(session);
  }

  const dailyTotals = useMemo(() => {
    const map: Record<string, number> = {};

    function addMinutes(dateStr: string | null | undefined, minutes: number) {
      if (!dateStr) return;
      map[dateStr] = (map[dateStr] || 0) + minutes;
    }

    allPeriods
      .filter((p) => p.status === "completed" && !p.is_break)
      .forEach((p) => addMinutes(p.session_date, minutesFor(p)));

    customTimers.forEach((t) => {
      const dateStr = localDateStringFromISO(t.start_timestamp);
      addMinutes(dateStr, Math.round(timerActualSeconds(t) / 60));
    });

    return map;
  }, [allPeriods, customTimers]);

  const heatmapDays = useMemo(() => {
    const days = [];
    for (let i = HEATMAP_DAYS; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const dateStr = toDateString(d);
      days.push({
        date: dateStr,
        minutes: dailyTotals[dateStr] || 0,
      });
    }
    return days;
  }, [dailyTotals]);

  const weeklyChart = useMemo(() => {
    const weeks = [];
    const currentWeekStart = startOfWeek(new Date());

    for (let i = CHART_WEEKS - 1; i >= 0; i--) {
      const weekStart = addDays(currentWeekStart, -7 * i);
      const weekEnd = addDays(weekStart, 6);

      let totalMinutes = 0;
      for (let d = 0; d < 7; d++) {
        const dateStr = toDateString(addDays(weekStart, d));
        totalMinutes += dailyTotals[dateStr] || 0;
      }

      weeks.push({
        weekStart: toDateString(weekStart),
        weekEnd: toDateString(weekEnd),
        totalMinutes,
        label: weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      });
    }

    return weeks;
  }, [dailyTotals]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { category: string; minutes: number; count: number }> = {};

    allPeriods
      .filter((p) => p.status === "completed" && !p.is_break)
      .forEach((p) => {
        const key = p.category?.trim() || "Uncategorized";
        if (!map[key]) map[key] = { category: key, minutes: 0, count: 0 };
        map[key].minutes += minutesFor(p);
        map[key].count += 1;
      });

    customTimers.forEach((t) => {
      const key = t.task_name?.trim() || "Custom Session";
      if (!map[key]) map[key] = { category: key, minutes: 0, count: 0 };
      map[key].minutes += Math.round(timerActualSeconds(t) / 60);
      map[key].count += 1;
    });

    return Object.values(map).sort((a, b) => b.minutes - a.minutes);
  }, [allPeriods, customTimers]);

  const summary = useMemo(() => {
    const totalsList = Object.values(dailyTotals) as number[];
    const totalFocusMinutes = totalsList.reduce((sum, m) => sum + m, 0);

    const allRatings = [
      ...allPeriods.filter((p) => p.rating).map((p) => p.rating),
      ...customTimers.filter((t) => t.rating).map((t) => t.rating),
    ];

    const averageRating =
      allRatings.length > 0
        ? Math.round((allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length) * 10) / 10
        : null;

    const studyPeriods = allPeriods.filter((p) => !p.is_break);
    const completedPeriods = studyPeriods.filter((p) => p.status === "completed");
    const completionRate =
      studyPeriods.length > 0
        ? Math.round((completedPeriods.length / studyPeriods.length) * 100)
        : null;

    const activeDayCount = totalsList.filter((m) => m > 0).length;

    let currentStreak = 0;
    let cursor = new Date();
    while (true) {
      const key = toDateString(cursor);
      if (dailyTotals[key] > 0) {
        currentStreak += 1;
        cursor = addDays(cursor, -1);
      } else {
        break;
      }
    }

    let longestStreak = 0;
    let running = 0;
    heatmapDays.forEach((day) => {
      if (day.minutes > 0) {
        running += 1;
        longestStreak = Math.max(longestStreak, running);
      } else {
        running = 0;
      }
    });

    return {
      totalFocusMinutes,
      averageRating,
      completionRate,
      activeDayCount,
      currentStreak,
      longestStreak,
      totalSessions: completedPeriods.length + customTimers.length,
    };
  }, [dailyTotals, allPeriods, customTimers, heatmapDays]);

  return {
    loading,
    message,
    reloadAnalytics: loadAnalytics,
    heatmapDays,
    weeklyChart,
    categoryBreakdown,
    summary,
  };
}
