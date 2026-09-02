import { useState } from "react";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors, getColorGradient } from "../styles/theme";
import useAlarms from "../hooks/useAlarms";
import AlarmSelector from "../components/AlarmSelector";
import {
  ArrowLeftIcon,
  ClockIcon,
  CoffeeIcon,
  CheckIcon,
  CalendarIcon,
  TrashIcon,
  SaveIcon,
  XIcon,
  SparkleIcon,
} from "../components/Icons";
import { ManniAmbientBackground, ManniCornerDecor } from "../components/ManniEffects";
import RatingModal from "../components/RatingModal";
import type { RoutineItem } from "../hooks/useRoutine";

function formatTime(time: string) {
  if (!time) return "";
  const [hours, minutes] = time.slice(0, 5).split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

interface RoutineProps {
  user?: any;
  routine?: RoutineItem[];
  routineSource?: string;
  routineLabel?: string;
  routineLoading?: boolean;
  routineMessage?: string;
  currentTime: Date;
  currentRoutineItem?: RoutineItem;
  nextRoutineItem?: RoutineItem;
  currentRoutineSeconds?: number;
  nextRoutineSeconds?: number;
  completedRoutine?: RoutineItem[];
  remainingRoutine?: RoutineItem[];
  formatRemaining?: (sec: number) => string;
  pendingRatingSession?: any;
  submitPeriodRating: (id: string, rating: number, note?: string) => Promise<any>;
  dismissPeriodRating: () => void;
  // NEW — fires when a Planner task's scheduled end time passes without
  // being manually marked complete first. useRoutine.ts auto-completes it
  // and surfaces it here, same as a template period's live-session
  // completion does via pendingRatingSession above.
  pendingPlannerRating?: RoutineItem | null;
  dismissPlannerRating?: () => void;
  togglePlannerItemInRoutine?: (item: RoutineItem) => Promise<any>;
  submitPlannerRatingInRoutine?: (item: RoutineItem, rating: number, note?: string) => Promise<any>;
  editRoutineItem?: (item: RoutineItem, changes: any) => Promise<any>;
  deleteRoutineItem?: (item: RoutineItem) => Promise<any>;
  setPage: (page: string) => void;
  styles: AppStyles;
}

export default function Routine({
  user,
  routine = [],
  routineSource = "none",
  routineLabel = "",
  routineLoading = false,
  routineMessage = "",
  currentTime,
  currentRoutineItem,
  nextRoutineItem,
  currentRoutineSeconds = 0,
  nextRoutineSeconds = 0,
  completedRoutine = [],
  remainingRoutine = [],
  formatRemaining,
  pendingRatingSession,
  submitPeriodRating,
  dismissPeriodRating,
  pendingPlannerRating,
  dismissPlannerRating,
  togglePlannerItemInRoutine,
  submitPlannerRatingInRoutine,
  editRoutineItem,
  deleteRoutineItem,
  setPage,
  styles,
}: RoutineProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { allAlarms, playAlarm } = useAlarms(user?.id);

  // MANNI MODE ONLY: everything gated behind this flag is purely additive.
  // Light/Dark render exactly the JSX/styles they always have — this flag
  // is false for both, so none of the Manni-only branches below ever run
  // for them. Same pattern as Dashboard.tsx / Timer.tsx / BottomNav.tsx.
  const isManni = theme === "manni";

  const [editingItem, setEditingItem] = useState<RoutineItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editAlarmId, setEditAlarmId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [ratingTargetItem, setRatingTargetItem] = useState<RoutineItem | null>(null);

  const todayLabel = currentTime
    ? currentTime.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  const isComplete = routine.length > 0 && remainingRoutine.length === 0;
  const isHoliday = routineSource === "holiday";
  const isEmpty = routine.length === 0 && !isHoliday && !routineLoading;

  // Which rating request is currently active, in priority order:
  // a just-finished template/one_off live session, then a just-auto-
  // completed Planner task, then a manually-tapped "Rate this" on
  // something already completed earlier.
  const activeRatingSource = pendingRatingSession
    ? "session"
    : pendingPlannerRating
    ? "planner-auto"
    : ratingTargetItem
    ? "planner-manual"
    : null;

  async function handleRatingSubmit(rating: number, note?: string) {
    if (activeRatingSource === "session" && pendingRatingSession) {
      await submitPeriodRating(pendingRatingSession.id, rating, note);
      return;
    }
    if (activeRatingSource === "planner-auto" && pendingPlannerRating && submitPlannerRatingInRoutine) {
      await submitPlannerRatingInRoutine(pendingPlannerRating, rating, note);
      if (dismissPlannerRating) dismissPlannerRating();
      return;
    }
    if (activeRatingSource === "planner-manual" && ratingTargetItem && submitPlannerRatingInRoutine) {
      await submitPlannerRatingInRoutine(ratingTargetItem, rating, note);
      setRatingTargetItem(null);
    }
  }

  function handleDismissRating() {
    if (activeRatingSource === "session") {
      dismissPeriodRating();
    } else if (activeRatingSource === "planner-auto") {
      if (dismissPlannerRating) dismissPlannerRating();
    } else {
      setRatingTargetItem(null);
    }
  }

  function openEdit(item: RoutineItem) {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditSubject(item.subject);
    setEditStart(item.time);
    setEditEnd(item.end);
    setEditAlarmId(item.alarmId || null);
    setEditError("");
  }

  function closeEdit() {
    setEditingItem(null);
    setEditError("");
  }

  async function handleSaveEdit() {
    if (!editingItem || !editRoutineItem) return;

    if (!editTitle.trim()) {
      setEditError("Title cannot be blank.");
      return;
    }
    if (!editStart || !editEnd) {
      setEditError("Start and end time cannot be blank.");
      return;
    }
    if (editEnd <= editStart) {
      setEditError("End time must be later than start time.");
      return;
    }

    setEditSaving(true);
    setEditError("");

    const changes: any = {
      title: editTitle.trim(),
      subject: editSubject.trim(),
      time: editStart,
      end: editEnd,
    };
    changes.alarmId = editAlarmId;

    const res = await editRoutineItem(editingItem, changes);
    setEditSaving(false);

    if (!res?.success) {
      setEditError(res?.error || "Could not save changes.");
      return;
    }

    closeEdit();
  }

  async function handleDelete(item: RoutineItem) {
    if (!deleteRoutineItem) return;
    const confirmed = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
    if (!confirmed) return;
    await deleteRoutineItem(item);
  }

  async function handleTogglePlannerComplete(item: RoutineItem) {
    if (!togglePlannerItemInRoutine) return;
    await togglePlannerItemInRoutine(item);
  }

  return (
    <div
      style={{
        ...styles.page,
        // MANNI MODE ONLY: soft blush gradient instead of the flat bg.
        // Light/Dark keep the exact same solid colors.bg they always had.
        background: isManni && colors.bgGradient ? colors.bgGradient : colors.bg,
        color: colors.text,
        minHeight: "100vh",
        position: "relative",
      }}
    >
      {/* MANNI MODE ONLY: slow-drifting hearts/sparkles/stars behind all
          page content. Renders nothing for Light/Dark. */}
      {isManni && <ManniAmbientBackground />}

      <main style={{ ...styles.dashboard, maxWidth: "680px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <button
          type="button"
          style={{
            ...styles.backButton,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: colors.card,
            border: `1px solid ${colors.border}`,
            color: colors.text,
          }}
          onClick={() => setPage("dashboard")}
        >
          <ArrowLeftIcon />
          Back to Dashboard
        </button>

        <div style={{ marginBottom: "24px" }}>
          <p style={{ ...styles.eyebrow, color: colors.accent }}>TODAY'S ROUTINE</p>
          <h1
            style={{
              ...styles.routineTitle,
              color: colors.text,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {todayLabel}
            {/* MANNI MODE ONLY: small sparkle accent next to the title. */}
            {isManni && (
              <span style={{ color: colors.accent, display: "inline-flex" }} aria-hidden="true">
                <SparkleIcon width={16} height={16} />
              </span>
            )}
          </h1>
          <p style={{ ...styles.cardText, color: colors.textDim }}>
            {routineLoading ? "Loading your routine..." : routineLabel || "Your timetable for today."}
          </p>
        </div>

        {routineMessage && (
          <div
            style={{
              padding: "10px 16px",
              marginBottom: "14px",
              borderRadius: "12px",
              background: "rgba(255, 143, 143, 0.1)",
              border: "1px solid rgba(255, 143, 143, 0.3)",
              color: colors.danger,
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            {routineMessage}
          </div>
        )}

        {routineLoading ? (
          <div style={{ ...styles.timerInfoCard, background: colors.card, border: `1px solid ${colors.border}` }}>
            <p style={{ ...styles.cardText, color: colors.text }}>Loading...</p>
          </div>
        ) : isHoliday && routine.length === 0 ? (
          <div
            style={{
              position: "relative",
              padding: "32px 24px",
              marginBottom: "18px",
              borderRadius: "22px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              textAlign: "center",
            }}
          >
            {/* MANNI MODE ONLY: twinkling cloud in the corner. */}
            {isManni && <ManniCornerDecor kind="cloud" corner="top-right" color={colors.accent} />}

            <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px", color: colors.accent }}>
              <CoffeeIcon width={32} height={32} />
            </div>
            <h2 style={{ margin: "0 0 8px", color: colors.text }}>Holiday today</h2>
            <p style={{ ...styles.cardText, marginBottom: 0, color: colors.textDim }}>
              You've marked today as a rest day. No routine is scheduled.
            </p>
          </div>
        ) : (
          <>
            {/* CURRENT SESSION — background/border/glow follow the
                period's own chosen color when it has one, otherwise the
                existing teal default (see getColorGradient in theme.ts) */}
            <div
              style={{
                position: "relative",
                marginBottom: "16px",
                padding: "24px",
                borderRadius: "24px",
                background: currentRoutineItem
                  ? getColorGradient(currentRoutineItem.color, theme, 145).background
                  : colors.card,
                border: currentRoutineItem
                  ? `1px solid ${getColorGradient(currentRoutineItem.color, theme, 145).border}`
                  : `1px solid ${colors.border}`,
                boxShadow: currentRoutineItem
                  ? `0 15px 45px ${getColorGradient(currentRoutineItem.color, theme, 145).shadowColor}`
                  : "none",
              }}
            >
              {/* MANNI MODE ONLY: twinkling bow tucked in the corner. */}
              {isManni && <ManniCornerDecor kind="bow" corner="top-right" color={colors.accent} />}

              <p style={{ ...styles.cardLabel, color: colors.textDim }}>
                {currentRoutineItem ? "CURRENTLY" : "CURRENT STATUS"}
              </p>

              {currentRoutineItem ? (
                <>
                  <h2 style={{ margin: "8px 0 5px", fontSize: "26px", color: colors.text }}>
                    {currentRoutineItem.title}
                  </h2>

                  <p
                    style={{
                      color: colors.accent,
                      fontSize: "12px",
                      fontWeight: "800",
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      margin: "0 0 10px",
                    }}
                  >
                    {currentRoutineItem.subject}
                  </p>

                  <p style={{ color: colors.textDim, margin: "0 0 18px" }}>
                    {formatTime(currentRoutineItem.time)} – {formatTime(currentRoutineItem.end)}
                  </p>

                  <div
                    style={{
                      padding: "16px 18px",
                      borderRadius: "16px",
                      background: colors.cardAlt,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                        color: colors.textDim,
                        fontSize: "11px",
                        fontWeight: "800",
                        letterSpacing: "1.5px",
                      }}
                    >
                      TIME REMAINING
                    </p>
                    <strong style={{ fontSize: "26px", color: colors.text }}>
                      {formatRemaining ? formatRemaining(currentRoutineSeconds) : "--"}
                    </strong>
                  </div>
                </>
              ) : isComplete ? (
                <>
                  <h2 style={{ margin: "8px 0", fontSize: "24px", color: colors.text }}>
                    Routine complete
                  </h2>
                  <p style={{ ...styles.cardText, marginBottom: 0, color: colors.textDim }}>
                    You've completed every session for today.
                  </p>
                </>
              ) : (
                <>
                  <h2 style={{ margin: "8px 0", fontSize: "24px", color: colors.text }}>
                    No active session
                  </h2>
                  <p style={{ ...styles.cardText, marginBottom: 0, color: colors.textDim }}>
                    You're currently between study sessions.
                  </p>
                </>
              )}
            </div>

            {/* NEXT SESSION */}
            {nextRoutineItem && !isComplete && (
              <div
                style={{
                  position: "relative",
                  marginBottom: "18px",
                  padding: "22px",
                  borderRadius: "22px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {/* MANNI MODE ONLY: twinkling sparkle in the corner. */}
                {isManni && <ManniCornerDecor kind="sparkle" corner="top-right" color={colors.accent} />}

                <p style={{ ...styles.cardLabel, color: colors.textDim }}>UP NEXT</p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "18px",
                  }}
                >
                  <div>
                    <h2 style={{ margin: "7px 0 5px", fontSize: "20px", color: colors.text }}>
                      {nextRoutineItem.title}
                    </h2>
                    <p
                      style={{
                        color: colors.accent,
                        fontSize: "12px",
                        fontWeight: "800",
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                        margin: "0 0 7px",
                      }}
                    >
                      {nextRoutineItem.subject}
                    </p>
                    <p style={{ color: colors.textDim, margin: 0 }}>
                      {formatTime(nextRoutineItem.time)} – {formatTime(nextRoutineItem.end)}
                    </p>
                  </div>

                  <div style={{ textAlign: "right", minWidth: "80px" }}>
                    <p
                      style={{
                        margin: "0 0 5px",
                        color: colors.textDim,
                        fontSize: "10px",
                        fontWeight: "800",
                        letterSpacing: "1px",
                      }}
                    >
                      STARTS IN
                    </p>
                    <strong style={{ fontSize: "16px", color: colors.text }}>
                      {formatRemaining ? formatRemaining(nextRoutineSeconds) : "--"}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* EMPTY */}
            {isEmpty && (
              <div
                style={{
                  position: "relative",
                  padding: "32px 22px",
                  marginBottom: "18px",
                  borderRadius: "22px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  textAlign: "center",
                }}
              >
                {/* MANNI MODE ONLY: twinkling cloud in the corner. */}
                {isManni && <ManniCornerDecor kind="cloud" corner="top-right" color={colors.accent} />}

                <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px", color: colors.accent }}>
                  <CalendarIcon width={30} height={30} />
                </div>
                <h2 style={{ margin: "0 0 8px", color: colors.text }}>No timetable for today</h2>
                <p style={{ ...styles.cardText, marginBottom: "18px", color: colors.textDim }}>
                  Assign a saved timetable to today in your weekly schedule, or create one in the Planner.
                </p>
                <button
                  type="button"
                  style={{ ...styles.primary, background: colors.accent, color: colors.accentText }}
                  onClick={() => setPage("planner")}
                >
                  Open Planner
                </button>
              </div>
            )}

            {/* ALL SESSIONS (periods + planner tasks merged) */}
            {routine.length > 0 && (
              <div
                style={{
                  position: "relative",
                  marginBottom: "18px",
                  padding: "22px",
                  borderRadius: "22px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {/* MANNI MODE ONLY: twinkling ribbon in the corner. */}
                {isManni && <ManniCornerDecor kind="ribbon" corner="top-right" color={colors.accent} />}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <p style={{ ...styles.cardLabel, color: colors.textDim }}>TODAY</p>
                    <h2 style={{ margin: "6px 0 0", fontSize: "20px", color: colors.text }}>
                      Your sessions
                    </h2>
                  </div>
                  <span style={{ color: colors.textDim, fontSize: "13px" }}>
                    {completedRoutine.length}/{routine.length}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {routine.map((item) => {
                    const isCurrent = currentRoutineItem?.id === item.id;
                    const isCompleted = Boolean(item.completed);
                    const isPlanner = item.source === "planner";
                    // Color-coded left border: custom color if the user
                    // picked one for this period (via TemplateBuilder,
                    // Calendar, or the Room Routine builder), otherwise
                    // the existing default (amber for breaks, teal for
                    // study), same fallback expression used elsewhere.
                    const accentColor = item.color || (item.type === "Break" ? colors.warning : colors.accent);

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: "15px 16px",
                          borderRadius: "16px",
                          background: isCurrent ? colors.accentDim : colors.cardAlt,
                          border: isCurrent ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                          borderLeft: `4px solid ${accentColor}`,
                          opacity: isCompleted ? 0.65 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <button
                            type="button"
                            disabled={!isPlanner}
                            onClick={() => isPlanner && handleTogglePlannerComplete(item)}
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              border: "none",
                              cursor: isPlanner ? "pointer" : "default",
                              background: isCompleted
                                ? colors.accentDim
                                : isCurrent
                                ? colors.accent
                                : colors.card,
                              color: isCurrent && !isCompleted ? colors.accentText : colors.accent,
                            }}
                            aria-label={isPlanner ? "Toggle complete" : undefined}
                          >
                            {isCompleted ? (
                              <CheckIcon width={15} height={15} />
                            ) : item.type === "Break" ? (
                              <CoffeeIcon width={15} height={15} />
                            ) : (
                              <ClockIcon width={15} height={15} />
                            )}
                          </button>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                margin: "0 0 4px",
                                fontWeight: "800",
                                color: colors.text,
                                textDecoration: isCompleted ? "line-through" : "none",
                              }}
                            >
                              {item.title}
                              {isPlanner && (
                                <span
                                  style={{
                                    marginLeft: "8px",
                                    fontSize: "10px",
                                    fontWeight: 800,
                                    color: colors.textDim,
                                    letterSpacing: "0.5px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Planner
                                </span>
                              )}
                            </p>
                            <p style={{ margin: 0, color: colors.textDim, fontSize: "12px" }}>
                              {item.subject} · {formatTime(item.time)} – {formatTime(item.end)}
                            </p>
                            {item.note && (
                              <p style={{ margin: "4px 0 0", color: colors.textDim, fontSize: "12px", fontStyle: "italic" }}>
                                "{item.note}"
                              </p>
                            )}
                          </div>

                          {isCurrent && (
                            <span
                              style={{
                                color: colors.accent,
                                fontSize: "10px",
                                fontWeight: "900",
                                letterSpacing: "1px",
                                flexShrink: 0,
                              }}
                            >
                              NOW
                            </span>
                          )}

                          {item.rating != null && (
                            <span
                              style={{
                                color: colors.accent,
                                fontSize: "12px",
                                fontWeight: "800",
                                flexShrink: 0,
                              }}
                            >
                              {item.rating}/10
                            </span>
                          )}
                        </div>

                        {/* ACTION ROW */}
                        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                          {isPlanner && isCompleted && item.rating == null && (
                            <button
                              type="button"
                              onClick={() => setRatingTargetItem(item)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.accent}`,
                                background: colors.accentDim,
                                color: colors.accent,
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Rate this
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              border: `1px solid ${colors.border}`,
                              background: "transparent",
                              color: colors.text,
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "8px",
                              border: `1px solid ${colors.border}`,
                              background: "transparent",
                              color: colors.danger,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                            }}
                            aria-label="Delete item"
                          >
                            <TrashIcon width={13} height={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUMMARY */}
            {routine.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                <div style={{ padding: "18px", borderRadius: "18px", background: colors.card, border: `1px solid ${colors.border}` }}>
                  <p style={{ ...styles.cardLabel, marginBottom: "7px", color: colors.textDim }}>COMPLETED</p>
                  <strong style={{ fontSize: "24px", color: colors.text }}>{completedRoutine.length}</strong>
                </div>
                <div style={{ padding: "18px", borderRadius: "18px", background: colors.card, border: `1px solid ${colors.border}` }}>
                  <p style={{ ...styles.cardLabel, marginBottom: "7px", color: colors.textDim }}>REMAINING</p>
                  <strong style={{ fontSize: "24px", color: colors.text }}>{remainingRoutine.length}</strong>
                </div>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          style={{ ...styles.secondary, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
          onClick={() => setPage("planner")}
        >
          Edit Planner
        </button>
      </main>

      {/* RATING MODAL — handles a just-finished template/one_off live
          session, a just-auto-completed Planner task, and a manually-tapped
          "Rate this" on something already completed */}
      {activeRatingSource && (
        <RatingModal
          title="How was your focus?"
          subtitle={
            activeRatingSource === "session"
              ? pendingRatingSession?.period_name
              : activeRatingSource === "planner-auto"
              ? pendingPlannerRating?.title
              : ratingTargetItem?.title
          }
          onSubmit={handleRatingSubmit}
          onSkip={handleDismissRating}
          styles={styles}
        />
      )}

      {/* EDIT MODAL — works for any item regardless of source */}
      {editingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4, 7, 8, 0.75)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 400,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              background: colors.card,
              borderTop: `1px solid ${colors.border}`,
              borderTopLeftRadius: "26px",
              borderTopRightRadius: "26px",
              padding: "26px 20px calc(30px + env(safe-area-inset-bottom))",
              boxSizing: "border-box",
              maxHeight: "88vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", color: colors.text }}>Edit Session</h2>
              <button
                type="button"
                onClick={closeEdit}
                style={{ background: "transparent", border: "none", color: colors.textDim, cursor: "pointer" }}
                aria-label="Close"
              >
                <XIcon width={20} height={20} />
              </button>
            </div>

            {editingItem.source === "template" && (
              <p
                style={{
                  fontSize: "12px",
                  color: colors.warning,
                  background: "rgba(232, 196, 104, 0.12)",
                  border: "1px solid rgba(232, 196, 104, 0.3)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  margin: "0 0 14px",
                }}
              >
                This session comes from a saved timetable template. Editing it changes the template
                itself, so every day it's assigned to will also change.
              </p>
            )}

            <label style={{ ...styles.label, color: colors.textDim }}>Title</label>
            <input
              type="text"
              style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />

            <label style={{ ...styles.label, color: colors.textDim }}>Subject</label>
            <input
              type="text"
              style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
            />

            <div style={styles.plannerTwoColumn}>
              <div>
                <label style={{ ...styles.label, color: colors.textDim }}>Start Time</label>
                <input
                  type="time"
                  style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>
              <div>
                <label style={{ ...styles.label, color: colors.textDim }}>End Time</label>
                <input
                  type="time"
                  style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <AlarmSelector
                allAlarms={allAlarms}
                value={editAlarmId}
                onChange={setEditAlarmId}
                onPreview={playAlarm}
                styles={styles}
                label="ALARM FOR THIS SESSION"
              />
            </div>

            {editError && (
              <p style={{ color: colors.danger, fontSize: "13px", fontWeight: 700, margin: "0 0 12px" }}>
                {editError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={editSaving}
              style={{
                ...styles.primary,
                background: colors.accent,
                color: colors.accentText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <SaveIcon width={16} height={16} />
              {editSaving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={closeEdit}
              disabled={editSaving}
              style={{ ...styles.secondary, marginTop: "10px", background: colors.cardAlt, color: colors.textDim, border: `1px solid ${colors.border}` }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
