import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  getEffectiveDayItems,
  editDayItem,
  deleteDayItem,
  setPlannerItemCompleted,
  submitPlannerItemRating,
  type DayItem,
  type DayItemSource,
} from "../lib/daySchedule";

export interface PlannerTask {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  task_date: string;
  start_time: string;
  end_time: string;
  completed: boolean;
  alarm_id?: string | null;
  color?: string | null;
  rating?: number | null;
  note?: string | null;
  created_at?: string;
}

// One row in the merged "Your Plan" list — can be a planner task, a
// one-off Calendar period, or a template/timetable period, for ANY date.
// This is what fixes "Calendar-added period doesn't show in Planner":
// Planner now reads through the same daySchedule.ts source of truth that
// Routine.tsx already reads through, instead of only querying
// planner_tasks directly.
export interface PlannerItem {
  id: string; // unique per date+source+row
  rowId: string;
  source: DayItemSource;
  overrideId?: string;
  dateString: string;
  time: string;
  end: string;
  title: string;
  subject: string;
  description: string;
  isBreak: boolean;
  alarmId: string | null;
  color?: string | null;
  completed: boolean;
  rating: number | null;
  note: string | null;
}

function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// How far back/forward Planner resolves template-driven periods for dates
// that have no explicit calendar_overrides row. Dates outside this window
// still show correctly if they have an override row OR an actual
// planner_tasks row — those are never dropped regardless of the window.
const PAST_WINDOW_DAYS = 3;
const FUTURE_WINDOW_DAYS = 13;

export default function usePlanner(userId: string | undefined | null) {
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);
  const [plannerTitle, setPlannerTitle] = useState("");
  const [plannerSubject, setPlannerSubject] = useState("");
  const [plannerDate, setPlannerDate] = useState("");
  const [plannerStartTime, setPlannerStartTime] = useState("");
  const [plannerEndTime, setPlannerEndTime] = useState("");
  const [plannerAlarmId, setPlannerAlarmId] = useState<string | null>(null);
  const [plannerColor, setPlannerColor] = useState<string | null>(null);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerMessage, setPlannerMessage] = useState("");

  // Merged multi-source, multi-date list — the new "Your Plan" data source
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [plannerItemsLoading, setPlannerItemsLoading] = useState(false);
  const [plannerItemsMessage, setPlannerItemsMessage] = useState("");

  const sortTasks = useCallback((tasks: PlannerTask[]) => {
    return [...tasks].sort((a, b) => {
      const dateCompare = (a.task_date || "").localeCompare(b.task_date || "");
      if (dateCompare !== 0) return dateCompare;
      return (a.start_time || "").localeCompare(b.start_time || "");
    });
  }, []);

  const loadPlannerTasks = useCallback(
    async (id = userId) => {
      if (!id) {
        setPlannerTasks([]);
        return [];
      }

      setPlannerLoading(true);
      setPlannerMessage("");

      try {
        const { data, error } = await supabase
          .from("planner_tasks")
          .select("*")
          .eq("user_id", id)
          .order("task_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (error) {
          console.error("planner_tasks load error:", error);
          setPlannerMessage(`Could not load your plan: ${error.message}`);
          const local = localStorage.getItem(`benchmate_planner_tasks_${id}`);
          const parsed = local ? JSON.parse(local) : [];
          setPlannerTasks(sortTasks(parsed));
          return parsed;
        }

        const sorted = sortTasks(data || []);
        setPlannerTasks(sorted);
        localStorage.setItem(`benchmate_planner_tasks_${id}`, JSON.stringify(sorted));
        return sorted;
      } catch (err: any) {
        console.error("planner_tasks load exception:", err);
        setPlannerMessage(`Could not load your plan: ${err?.message || "Network error."}`);
        const local = localStorage.getItem(`benchmate_planner_tasks_${id}`);
        const parsed = local ? JSON.parse(local) : [];
        setPlannerTasks(sortTasks(parsed));
        return parsed;
      } finally {
        setPlannerLoading(false);
      }
    },
    [userId, sortTasks]
  );

  /* =========================================================
     MERGED PLANNER ITEMS — fixes "Calendar-added periods don't
     show in Planner". Builds the set of dates to resolve via the
     shared getEffectiveDayItems() (same source Routine.tsx uses):

       - every distinct date already in planner_tasks (so a
         manually-added task is NEVER dropped, no matter how far
         in the past/future it is)
       - every date that has an explicit calendar_overrides row
         (one-off periods, holidays) — these can be any date
       - a rolling near-term window (today-3 .. today+13) so
         weekly-template-driven periods (which have no override
         row and apply indefinitely) still show for near-term days
  ========================================================= */

  const loadPlannerItems = useCallback(
    async (id = userId) => {
      if (!id) {
        setPlannerItems([]);
        return [];
      }

      setPlannerItemsLoading(true);
      setPlannerItemsMessage("");

      try {
        const { data: taskRows, error: taskErr } = await supabase
          .from("planner_tasks")
          .select("task_date")
          .eq("user_id", id);

        if (taskErr) console.error("planner_tasks date scan error:", taskErr);

        const { data: overrideRows, error: overrideErr } = await supabase
          .from("calendar_overrides")
          .select("override_date")
          .eq("user_id", id);

        if (overrideErr) console.error("calendar_overrides date scan error:", overrideErr);

        const today = todayDateString();
        const dateSet = new Set<string>();

        (taskRows || []).forEach((r: any) => r.task_date && dateSet.add(r.task_date));
        (overrideRows || []).forEach((r: any) => r.override_date && dateSet.add(r.override_date));

        for (let i = -PAST_WINDOW_DAYS; i <= FUTURE_WINDOW_DAYS; i++) {
          dateSet.add(addDays(today, i));
        }

        const dates = Array.from(dateSet);

        const results = await Promise.all(
          dates.map(async (dateString) => {
            try {
              const result = await getEffectiveDayItems(id, dateString);
              return result.items.map((item) => ({ ...item, dateString }));
            } catch (e) {
              console.error(`getEffectiveDayItems failed for ${dateString}:`, e);
              return [];
            }
          })
        );

        const merged: PlannerItem[] = results
          .flat()
          .map((item: DayItem & { dateString: string }) => ({
            id: `${item.dateString}:${item.key}`,
            rowId: item.rowId,
            source: item.source,
            overrideId: item.overrideId,
            dateString: item.dateString,
            time: item.time,
            end: item.end,
            title: item.title,
            subject: item.subject,
            description: item.description,
            isBreak: item.isBreak,
            alarmId: item.alarmId,
            color: item.color ?? null,
            completed: item.completed,
            rating: item.rating,
            note: item.note,
          }))
          .sort((a, b) => {
            const d = a.dateString.localeCompare(b.dateString);
            if (d !== 0) return d;
            return a.time.localeCompare(b.time);
          });

        setPlannerItems(merged);
        return merged;
      } catch (err: any) {
        console.error("loadPlannerItems exception:", err);
        setPlannerItemsMessage(`Could not load your full plan: ${err?.message || "Network error."}`);
        return [];
      } finally {
        setPlannerItemsLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) {
      setPlannerTasks([]);
      setPlannerItems([]);
      return;
    }
    loadPlannerTasks(userId);
    loadPlannerItems(userId);
  }, [userId, loadPlannerTasks, loadPlannerItems]);

  const clearPlannerForm = useCallback(() => {
    setPlannerTitle("");
    setPlannerSubject("");
    setPlannerDate("");
    setPlannerStartTime("");
    setPlannerEndTime("");
    setPlannerAlarmId(null);
    setPlannerColor(null);
    setEditingTaskId(null);
    setPlannerMessage("");
  }, []);

  const editPlannerTask = useCallback((task: PlannerTask | null) => {
    if (!task) return;
    setEditingTaskId(task.id);
    setPlannerTitle(task.title || "");
    setPlannerSubject(task.subject || "");
    setPlannerDate(task.task_date || "");
    setPlannerStartTime(task.start_time ? task.start_time.slice(0, 5) : "");
    setPlannerEndTime(task.end_time ? task.end_time.slice(0, 5) : "");
    setPlannerAlarmId(task.alarm_id || null);
    setPlannerColor(task.color || null);
    setPlannerMessage("");
  }, []);

  const addPlannerTask = useCallback(
    async (e?: FormEvent) => {
      if (e) e.preventDefault();
      if (!userId) {
        setPlannerMessage("You are not logged in.");
        return;
      }

      if (!plannerTitle.trim()) {
        setPlannerMessage("Enter a task title.");
        return;
      }
      if (!plannerSubject.trim()) {
        setPlannerMessage("Enter a subject.");
        return;
      }
      if (!plannerDate) {
        setPlannerMessage("Choose a date.");
        return;
      }
      if (!plannerStartTime || !plannerEndTime) {
        setPlannerMessage("Choose a start and end time.");
        return;
      }
      if (plannerEndTime <= plannerStartTime) {
        setPlannerMessage("End time must be later than start time.");
        return;
      }

      setPlannerLoading(true);
      setPlannerMessage("Adding task...");

      try {
        const { data, error } = await supabase
          .from("planner_tasks")
          .insert({
            user_id: userId,
            title: plannerTitle.trim(),
            subject: plannerSubject.trim(),
            task_date: plannerDate,
            start_time: plannerStartTime,
            end_time: plannerEndTime,
            alarm_id: plannerAlarmId || null,
            color: plannerColor || null,
            completed: false,
          })
          .select()
          .single();

        if (error) {
          console.error("planner_tasks insert error:", error);
          setPlannerMessage(`Could not save task: ${error.message}`);
          setPlannerLoading(false);
          return;
        }

        const taskToAdd = data as PlannerTask;
        setPlannerTasks((prev) => {
          const updated = sortTasks([...prev, taskToAdd]);
          localStorage.setItem(`benchmate_planner_tasks_${userId}`, JSON.stringify(updated));
          return updated;
        });

        clearPlannerForm();
        setPlannerMessage("Task added successfully.");
        await loadPlannerItems(userId);
      } catch (err: any) {
        console.error("planner_tasks insert exception:", err);
        setPlannerMessage(`Could not save task: ${err?.message || "Network error."}`);
      } finally {
        setPlannerLoading(false);
      }
    },
    [
      userId,
      plannerTitle,
      plannerSubject,
      plannerDate,
      plannerStartTime,
      plannerEndTime,
      plannerAlarmId,
      plannerColor,
      sortTasks,
      clearPlannerForm,
      loadPlannerItems,
    ]
  );

  const updatePlannerTask = useCallback(
    async (task: PlannerTask) => {
      if (!userId || !task?.id) return;

      if (!plannerTitle.trim() || !plannerSubject.trim() || !plannerDate || !plannerStartTime || !plannerEndTime) {
        setPlannerMessage("Please fill in all fields.");
        return;
      }

      if (plannerEndTime <= plannerStartTime) {
        setPlannerMessage("End time must be later than start time.");
        return;
      }

      setPlannerLoading(true);
      setPlannerMessage("Updating task...");

      const updatedFields = {
        title: plannerTitle.trim(),
        subject: plannerSubject.trim(),
        task_date: plannerDate,
        start_time: plannerStartTime,
        end_time: plannerEndTime,
        alarm_id: plannerAlarmId || null,
        color: plannerColor || null,
      };

      try {
        const { error } = await supabase
          .from("planner_tasks")
          .update(updatedFields)
          .eq("id", task.id)
          .eq("user_id", userId);

        if (error) {
          console.error("planner_tasks update error:", error);
          setPlannerMessage(`Could not update task: ${error.message}`);
          setPlannerLoading(false);
          return;
        }

        setPlannerTasks((prev) => {
          const updated = sortTasks(
            prev.map((item) => (item.id === task.id ? { ...item, ...updatedFields } : item))
          );
          localStorage.setItem(`benchmate_planner_tasks_${userId}`, JSON.stringify(updated));
          return updated;
        });

        clearPlannerForm();
        setPlannerMessage("Task updated successfully.");
        await loadPlannerItems(userId);
      } catch (err: any) {
        console.error("planner_tasks update exception:", err);
        setPlannerMessage(`Could not update task: ${err?.message || "Network error."}`);
      } finally {
        setPlannerLoading(false);
      }
    },
    [
      userId,
      plannerTitle,
      plannerSubject,
      plannerDate,
      plannerStartTime,
      plannerEndTime,
      plannerColor,
      sortTasks,
      clearPlannerForm,
      loadPlannerItems,
    ]
  );

  const togglePlannerTask = useCallback(
    async (task: PlannerTask) => {
      if (!userId || !task?.id) return;

      const newCompleted = !Boolean(task.completed);
      setPlannerLoading(true);
      setPlannerMessage("");

      try {
        const { error } = await supabase
          .from("planner_tasks")
          .update({ completed: newCompleted })
          .eq("id", task.id)
          .eq("user_id", userId);

        if (error) {
          console.error("planner_tasks toggle error:", error);
          setPlannerMessage(`Could not update task status: ${error.message}`);
          setPlannerLoading(false);
          return;
        }

        setPlannerTasks((prev) => {
          const updated = prev.map((item) => (item.id === task.id ? { ...item, completed: newCompleted } : item));
          localStorage.setItem(`benchmate_planner_tasks_${userId}`, JSON.stringify(updated));
          return updated;
        });
        await loadPlannerItems(userId);
      } catch (err: any) {
        console.error("planner_tasks toggle exception:", err);
        setPlannerMessage(`Could not update task status: ${err?.message || "Network error."}`);
      } finally {
        setPlannerLoading(false);
      }
    },
    [userId, loadPlannerItems]
  );

  const deletePlannerTask = useCallback(
    async (taskId: string) => {
      if (!userId || !taskId) return;

      setPlannerLoading(true);
      setPlannerMessage("");

      try {
        const { error } = await supabase.from("planner_tasks").delete().eq("id", taskId).eq("user_id", userId);

        if (error) {
          console.error("planner_tasks delete error:", error);
          setPlannerMessage(`Could not delete task: ${error.message}`);
          setPlannerLoading(false);
          return;
        }

        setPlannerTasks((prev) => {
          const updated = prev.filter((task) => task.id !== taskId);
          localStorage.setItem(`benchmate_planner_tasks_${userId}`, JSON.stringify(updated));
          return updated;
        });

        if (editingTaskId === taskId) {
          clearPlannerForm();
        }
        await loadPlannerItems(userId);
      } catch (err: any) {
        console.error("planner_tasks delete exception:", err);
        setPlannerMessage(`Could not delete task: ${err?.message || "Network error."}`);
      } finally {
        setPlannerLoading(false);
      }
    },
    [userId, editingTaskId, clearPlannerForm, loadPlannerItems]
  );

  /* =========================================================
     UNIVERSAL ACTIONS ON MERGED PLANNER ITEMS
     Work regardless of whether the item is a planner task, a
     one-off Calendar period, or a template period — write back
     to whichever table it actually came from via the same
     daySchedule.ts functions Routine.tsx uses. This is what
     keeps an edit made from Planner in sync with Routine/Calendar
     and vice versa.
  ========================================================= */

  const toDayItem = (item: PlannerItem): DayItem => ({
    key: item.id,
    rowId: item.rowId,
    source: item.source,
    time: item.time,
    end: item.end,
    title: item.title,
    subject: item.subject,
    description: item.description,
    isBreak: item.isBreak,
    alarmId: item.alarmId,
    completed: item.completed,
    rating: item.rating,
    note: item.note,
    overrideId: item.overrideId,
  });

  const editPlannerItem = useCallback(
    async (
      item: PlannerItem,
      changes: {
        title?: string;
        subject?: string;
        time?: string;
        end?: string;
        alarmId?: string | null;
        color?: string | null;
      }
    ) => {
      const res = await editDayItem(toDayItem(item), changes);
      if (res.success) {
        await loadPlannerItems(userId);
        if (item.source === "planner") await loadPlannerTasks(userId);
      }
      return res;
    },
    [userId, loadPlannerItems, loadPlannerTasks]
  );

  const deletePlannerItem = useCallback(
    async (item: PlannerItem) => {
      const res = await deleteDayItem(toDayItem(item));
      if (res.success) {
        await loadPlannerItems(userId);
        if (item.source === "planner") await loadPlannerTasks(userId);
      }
      return res;
    },
    [userId, loadPlannerItems, loadPlannerTasks]
  );

  const togglePlannerItemComplete = useCallback(
    async (item: PlannerItem) => {
      if (item.source !== "planner") {
        return { success: false, error: "Only planner tasks can be toggled complete here." };
      }
      const res = await setPlannerItemCompleted(item.rowId, !item.completed);
      if (res.success) {
        await loadPlannerItems(userId);
        await loadPlannerTasks(userId);
      }
      return res;
    },
    [userId, loadPlannerItems, loadPlannerTasks]
  );

  const submitPlannerItemRatingAction = useCallback(
    async (item: PlannerItem, rating: number, note?: string) => {
      if (item.source !== "planner") {
        return { success: false, error: "Only planner tasks can be rated here." };
      }
      const res = await submitPlannerItemRating(item.rowId, rating, note);
      if (res.success) {
        await loadPlannerItems(userId);
        await loadPlannerTasks(userId);
      }
      return res;
    },
    [userId, loadPlannerItems, loadPlannerTasks]
  );

  const editingTask = useMemo(() => {
    if (!editingTaskId) return null;
    return plannerTasks.find((task) => task.id === editingTaskId) || null;
  }, [plannerTasks, editingTaskId]);

  const today = useMemo(() => todayDateString(), []);

  const todayTasks = useMemo(() => plannerTasks.filter((t) => t.task_date === today), [plannerTasks, today]);
  const completedTodayTasks = useMemo(() => todayTasks.filter((t) => t.completed === true), [todayTasks]);
  const remainingTodayTasks = useMemo(() => todayTasks.filter((t) => t.completed !== true), [todayTasks]);

  const nextPlannerTask = useMemo(() => {
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return (
      plannerTasks.find((task) => {
        if (task.completed) return false;
        if (task.task_date > currentDate) return true;
        if (task.task_date === currentDate) {
          return task.start_time?.slice(0, 5) > currentTime;
        }
        return false;
      }) || null
    );
  }, [plannerTasks]);

  const totalTasks = plannerTasks.length;
  const completedTasks = plannerTasks.filter((t) => t.completed === true).length;
  const remainingTasks = totalTasks - completedTasks;
  const todayProgress = todayTasks.length > 0 ? Math.round((completedTodayTasks.length / todayTasks.length) * 100) : 0;

  return {
    plannerTasks,
    plannerTitle,
    plannerSubject,
    plannerDate,
    plannerStartTime,
    plannerEndTime,
    setPlannerTitle,
    setPlannerSubject,
    setPlannerDate,
    setPlannerStartTime,
    setPlannerEndTime,
    plannerAlarmId,
    setPlannerAlarmId,
    plannerColor,
    setPlannerColor,
    editingTask,
    editingTaskId,
    plannerLoading,
    plannerMessage,
    setPlannerMessage,
    loadPlannerTasks,
    addPlannerTask,
    editPlannerTask,
    updatePlannerTask,
    togglePlannerTask,
    deletePlannerTask,
    clearPlannerForm,
    todayTasks,
    completedTodayTasks,
    remainingTodayTasks,
    nextPlannerTask,
    totalTasks,
    completedTasks,
    remainingTasks,
    todayProgress,

    // Merged multi-source list (periods + tasks, across dates)
    plannerItems,
    plannerItemsLoading,
    plannerItemsMessage,
    reloadPlannerItems: () => loadPlannerItems(userId),
    editPlannerItem,
    deletePlannerItem,
    togglePlannerItemComplete,
    submitPlannerItemRatingAction,
  };
}
