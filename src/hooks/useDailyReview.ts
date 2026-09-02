import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function useDailyReview(
  userId: string | undefined | null,
  routine: any[] = [],
  routineLoading: boolean = false,
  routineSource: string = "none"
) {
  const [pendingReview, setPendingReview] = useState<{ date: string; stats: any } | null>(null);
  const [dismissedToday, setDismissedToday] = useState(false);
  const [checkedToday, setCheckedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const todayStr = useMemo(() => todayDateString(), []);

  const dayIsComplete = useMemo(() => {
    if (routineLoading) return false;
    if (!routine || routine.length === 0) return false;
    if (routineSource === "holiday" || routineSource === "no_routine") return false;

    const studyItems = routine.filter((item) => item.type !== "Break");
    if (studyItems.length === 0) return false;

    return studyItems.every((item) => item.completed);
  }, [routine, routineLoading, routineSource]);

  const checkForExistingReview = useCallback(async () => {
    if (!userId || !dayIsComplete || dismissedToday || checkedToday) return;

    setCheckedToday(true);

    try {
      const { data } = await supabase
        .from("daily_reviews")
        .select("id")
        .eq("user_id", userId)
        .eq("review_date", todayStr)
        .maybeSingle();

      if (data) {
        return;
      }

      const studyItems = routine.filter((item) => item.type !== "Break");
      const completedItems = studyItems.filter((item) => item.completed);

      setPendingReview({
        date: todayStr,
        stats: {
          completedPeriods: completedItems.length,
          totalPeriods: studyItems.length,
        },
      });
    } catch {}
  }, [userId, dayIsComplete, dismissedToday, checkedToday, todayStr, routine]);

  useEffect(() => {
    checkForExistingReview();
  }, [checkForExistingReview]);

  useEffect(() => {
    setCheckedToday(false);
    setDismissedToday(false);
    setPendingReview(null);
  }, [todayStr]);

  async function submitDailyReview(rating: number, notes?: string, extraStats: any = {}) {
    if (!userId || !pendingReview) return { success: false };

    setSaving(true);
    setReviewMessage("");

    try {
      await supabase.from("daily_reviews").upsert(
        {
          user_id: userId,
          review_date: pendingReview.date,
          rating: rating || null,
          notes: notes?.trim() || null,
          completed_periods: pendingReview.stats.completedPeriods,
          total_focus_minutes: extraStats.totalFocusMinutes || 0,
          completed_timers: extraStats.completedTimers || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,review_date" }
      );
    } catch {}

    setSaving(false);
    setPendingReview(null);
    return { success: true };
  }

  function dismissDailyReview() {
    setDismissedToday(true);
    setPendingReview(null);
  }

  return {
    pendingReview,
    submitDailyReview,
    dismissDailyReview,
    saving,
    reviewMessage,
  };
}
