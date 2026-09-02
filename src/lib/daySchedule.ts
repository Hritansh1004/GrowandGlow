// src/lib/daySchedule.ts
//
// SHARED SOURCE OF TRUTH for "what is scheduled on date X".
//
// Before this file existed, useRoutine.ts and Planner.tsx each had their own
// separate idea of what a day looks like — Routine only knew about
// template_periods/one_off_periods, Planner only knew about planner_tasks.
// That's why a task added in Planner never showed in Routine, and a period
// added via Calendar never showed in Planner.
//
// Every screen that needs "what's happening on date X" should call
// getEffectiveDayItems() below instead of writing its own query. Every screen
// that edits/deletes/completes one of those items should call editDayItem() /
// deleteDayItem() / setDayItemCompleted() below instead of writing directly
// to a table. That keeps the priority logic and the write-back logic in
// exactly one place.

import { supabase } from "./supabaseClient";

export type DayItemSource = "template" | "one_off" | "planner";

export interface DayItem {
  // Unique across the whole merged list (prefixed by source so ids never collide)
  key: string;
  // The raw row id in whichever table this came from
  rowId: string;
  source: DayItemSource;
  time: string; // "HH:MM"
  end: string; // "HH:MM"
  title: string;
  subject: string;
  description: string;
  isBreak: boolean;
  alarmId: string | null;
  // Optional hex color the user picked for this period (Core Vision 8.5,
  // color-coded Routine). Optional so nothing that predates this field
  // needs to change — falls back to null (caller decides the default color).
  color?: string | null;
  completed: boolean;
  rating: number | null;
  note: string | null;
  // Only present for one_off items — needed to write back to one_off_periods
  overrideId?: string;
}

export interface EffectiveDayResult {
  items: DayItem[];
  routineSource: "template" | "one_off" | "holiday" | "no_routine" | "none";
  routineLabel: string;
}

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function getDayKeyForDate(dateString: string): string {
  // dateString is "YYYY-MM-DD" in the user's local calendar day.
  const d = new Date(`${dateString}T00:00:00`);
  const jsDay = d.getDay(); // 0 = Sunday
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0 = Monday
  return DAY_KEYS[dayOfWeek];
}

function normalizeTemplatePeriod(row: any, source: DayItemSource, overrideId?: string): DayItem {
  return {
    key: `${source}:${row.id}`,
    rowId: row.id,
    source,
    time: row.start_time?.slice(0, 5) || "",
    end: row.end_time?.slice(0, 5) || "",
    title: row.name || (row.is_break ? "Break" : "Study Session"),
    subject: row.category || (row.is_break ? "Break" : "Study"),
    description: row.description || "",
    isBreak: Boolean(row.is_break),
    alarmId: row.alarm_id || null,
    color: row.color || null,
    completed: false,
    rating: null,
    note: null,
    overrideId,
  };
}

function normalizePlannerTask(row: any): DayItem {
  return {
    key: `planner:${row.id}`,
    rowId: row.id,
    source: "planner",
    time: row.start_time?.slice(0, 5) || "",
    end: row.end_time?.slice(0, 5) || "",
    title: row.title || "Task",
    subject: row.subject || "General",
    description: "",
    isBreak: false,
    alarmId: row.alarm_id || null,
    color: row.color || null,
    completed: Boolean(row.completed),
    rating: row.rating ?? null,
    note: row.note ?? null,
  };
}

/**
 * Submits a rating + optional note for a planner-sourced day item.
 * (Template/one_off item ratings still go through period_sessions via
 * useRoutine.ts's submitPeriodRating — those are tracked separately because
 * they're tied to a specific completed session instance, not the task row.)
 */
export async function submitPlannerItemRating(
  itemRowId: string,
  rating: number,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("planner_tasks")
    .update({ rating: rating || null, note: note?.trim() || null })
    .eq("id", itemRowId);

  if (error) {
    console.error("submitPlannerItemRating error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Resolves everything scheduled on a given local date ("YYYY-MM-DD"):
 * date-specific override (holiday / one-off / assigned template) OR the
 * weekly-assigned template if no override exists, PLUS any planner_tasks
 * for that date — merged and sorted by start time.
 */
export async function getEffectiveDayItems(
  userId: string,
  dateString: string
): Promise<EffectiveDayResult> {
  let periodItems: DayItem[] = [];
  let routineSource: EffectiveDayResult["routineSource"] = "none";
  let routineLabel = "";
  let isHoliday = false;

  // 1. Date-specific override
  const { data: overrideRow, error: overrideError } = await supabase
    .from("calendar_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("override_date", dateString)
    .maybeSingle();

  if (overrideError) console.error("calendar_overrides load error:", overrideError);

  if (overrideRow?.override_type === "holiday") {
    isHoliday = true;
    routineSource = "holiday";
    routineLabel = "Holiday / Rest Day";
  } else if (overrideRow?.override_type === "one_off") {
    const { data: oneOffPeriods, error: oneOffError } = await supabase
      .from("one_off_periods")
      .select("*")
      .eq("override_id", overrideRow.id)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true });

    if (oneOffError) console.error("one_off_periods load error:", oneOffError);

    periodItems = (oneOffPeriods || []).map((row: any) =>
      normalizeTemplatePeriod(row, "one_off", overrideRow.id)
    );
    routineSource = "one_off";
    routineLabel = "Custom schedule for this day";
  } else if (overrideRow?.override_type === "template" && overrideRow.template_id) {
    const { data: allPeriods, error: periodsError } = await supabase
      .from("template_periods")
      .select("*")
      .eq("template_id", overrideRow.template_id)
      .order("start_time", { ascending: true });

    if (periodsError) console.error("template_periods load error:", periodsError);

    periodItems = (allPeriods || []).map((row: any) => normalizeTemplatePeriod(row, "template"));
    routineSource = "template";
    routineLabel = "Assigned timetable for this day";
  } else {
    // 2. No override — fall back to the weekly assigned template
    const dayKey = getDayKeyForDate(dateString);

    const { data: weekly, error: weeklyError } = await supabase
      .from("weekly_schedules")
      .select("*")
      .eq("user_id", userId)
      .eq("day_of_week", dayKey)
      .maybeSingle();

    if (weeklyError) console.error("weekly_schedules load error:", weeklyError);

    if (weekly?.is_holiday) {
      isHoliday = true;
      routineSource = "holiday";
      routineLabel = "Holiday / Rest Day";
    } else if (weekly?.template_id) {
      const { data: allPeriods, error: periodsError } = await supabase
        .from("template_periods")
        .select("*")
        .eq("template_id", weekly.template_id)
        .order("start_time", { ascending: true });

      if (periodsError) console.error("template_periods load error:", periodsError);

      periodItems = (allPeriods || []).map((row: any) => normalizeTemplatePeriod(row, "template"));
      routineSource = "template";
      routineLabel = "This week's assigned timetable";
    } else {
      routineSource = "none";
      routineLabel = "No timetable assigned to this day";
    }
  }

  // 3. Planner tasks for this date ALWAYS merge in, even on a holiday —
  // a manually-added task is an explicit user intent and should still show.
  const { data: plannerRows, error: plannerError } = await supabase
    .from("planner_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("task_date", dateString)
    .order("start_time", { ascending: true });

  if (plannerError) console.error("planner_tasks load error (daySchedule):", plannerError);

  const plannerItems: DayItem[] = (plannerRows || []).map(normalizePlannerTask);

  const merged = [...periodItems, ...plannerItems].sort((a, b) => a.time.localeCompare(b.time));

  if (isHoliday && plannerItems.length > 0) {
    routineLabel = "Holiday / Rest Day (with some tasks scheduled)";
  }

  return {
    items: merged,
    routineSource: isHoliday ? "holiday" : routineSource,
    routineLabel,
  };
}

/**
 * Marks a day item complete/incomplete. Only meaningful for planner-sourced
 * items directly (template/one_off items are tracked via period_sessions,
 * which useRoutine.ts still owns for the live-timer/rating flow on today).
 */
export async function setPlannerItemCompleted(itemRowId: string, completed: boolean) {
  const { error } = await supabase
    .from("planner_tasks")
    .update({ completed })
    .eq("id", itemRowId);

  if (error) {
    console.error("setPlannerItemCompleted error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Edits a day item's title/subject/time/color, writing back to whichever
 * table it actually came from. This is the single function every screen
 * (Routine, Planner, Calendar) should call so an edit from any of them is
 * visible in all of them on next load.
 */
export async function editDayItem(
  item: DayItem,
  changes: {
    title?: string;
    subject?: string;
    time?: string;
    end?: string;
    alarmId?: string | null;
    color?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (item.source === "planner") {
      const { error } = await supabase
        .from("planner_tasks")
        .update({
          ...(changes.title !== undefined ? { title: changes.title } : {}),
          ...(changes.subject !== undefined ? { subject: changes.subject } : {}),
          ...(changes.time !== undefined ? { start_time: changes.time } : {}),
          ...(changes.end !== undefined ? { end_time: changes.end } : {}),
          ...(changes.alarmId !== undefined ? { alarm_id: changes.alarmId } : {}),
          ...(changes.color !== undefined ? { color: changes.color } : {}),
        })
        .eq("id", item.rowId);

      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    if (item.source === "one_off") {
      const { error } = await supabase
        .from("one_off_periods")
        .update({
          ...(changes.title !== undefined ? { name: changes.title } : {}),
          ...(changes.subject !== undefined ? { category: changes.subject } : {}),
          ...(changes.time !== undefined ? { start_time: changes.time } : {}),
          ...(changes.end !== undefined ? { end_time: changes.end } : {}),
          ...(changes.alarmId !== undefined ? { alarm_id: changes.alarmId } : {}),
          ...(changes.color !== undefined ? { color: changes.color } : {}),
        })
        .eq("id", item.rowId);

      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    // source === "template" — editing here edits the TEMPLATE itself, which
    // affects every day that template is assigned to. That's correct behavior
    // (it's the same "timetable"), but screens should make this clear in UI
    // (e.g. "This changes your saved timetable, not just today").
    const { error } = await supabase
      .from("template_periods")
      .update({
        ...(changes.title !== undefined ? { name: changes.title } : {}),
        ...(changes.subject !== undefined ? { category: changes.subject } : {}),
        ...(changes.time !== undefined ? { start_time: changes.time } : {}),
        ...(changes.end !== undefined ? { end_time: changes.end } : {}),
        ...(changes.alarmId !== undefined ? { alarm_id: changes.alarmId } : {}),
        ...(changes.color !== undefined ? { color: changes.color } : {}),
      })
      .eq("id", item.rowId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    console.error("editDayItem exception:", e);
    return { success: false, error: e?.message || "Network error." };
  }
}

/**
 * Deletes a day item from whichever table it actually came from.
 */
export async function deleteDayItem(item: DayItem): Promise<{ success: boolean; error?: string }> {
  try {
    const table =
      item.source === "planner"
        ? "planner_tasks"
        : item.source === "one_off"
        ? "one_off_periods"
        : "template_periods";

    const { error } = await supabase.from(table).delete().eq("id", item.rowId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    console.error("deleteDayItem exception:", e);
    return { success: false, error: e?.message || "Network error." };
  }
}