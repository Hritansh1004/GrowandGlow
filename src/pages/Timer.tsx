import React, { useEffect, useState } from "react";
import { AppStyles } from "../hooks/useStyles";
import useAlarms from "../hooks/useAlarms";
import { useSequences, SequenceBlock, SequenceTemplate } from "../hooks/useSequences";
import { useDragReorder } from "../hooks/useDragReorder";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors, getColorGradient } from "../styles/theme";
import AlarmSelector from "../components/AlarmSelector";
import ColorSelector from "../components/ColorSelector";
import RatingModal from "../components/RatingModal";
import { ManniAmbientBackground, ManniCornerDecor } from "../components/ManniEffects";
import {
  ArrowLeftIcon,
  PlayIcon,
  PauseIcon,
  SkipForwardIcon,
  TimerCircleIcon,
  CoffeeIcon,
  FlameIcon,
  PlusIcon,
  TrashIcon,
  BookIcon,
  DragHandleIcon,
  SparkleIcon,
} from "../components/Icons";

const QUICK_PRESETS = [5, 15, 25, 45, 60, 90];

// A "loose" numeric field: while the user is typing we allow "" (empty)
// so they can clear the box and retype without it snapping back to a
// forced minimum on every keystroke. Only clamp to a real number when
// the field loses focus or the timer is actually started.
type LooseNumber = number | "";

function clampMin(value: LooseNumber, min: number): number {
  if (value === "" || Number.isNaN(Number(value))) return min;
  return Math.max(min, Number(value));
}

// Recent Focus Sessions are only editable within this many hours of when
// they started — after that the edit button disappears entirely.
const EDIT_WINDOW_HOURS = 48;

function isWithinEditWindow(timestamp?: string | null): boolean {
  if (!timestamp) return false;
  const startedAt = new Date(timestamp).getTime();
  if (Number.isNaN(startedAt)) return false;
  const hoursSince = (Date.now() - startedAt) / (1000 * 60 * 60);
  return hoursSince <= EDIT_WINDOW_HOURS;
}

interface TimerProps {
  user: any;
  activeTimer: any;
  remainingSeconds: number;
  timerLoading: boolean;
  timerMessage: string;
  pendingRatingTimer: any;
  submitTimerRating: (id: string, rating: number, note?: string) => Promise<any>;
  dismissRating: () => void;
  pendingNextPhase: any;
  startNextPomodoroPhase: () => Promise<void>;
  skipPomodoroPhase: () => Promise<void>;
  startPomodoroCycle: (params: any) => Promise<any>;
  stopPomodoroCycle: () => Promise<void>;
  recentTimers?: any[];
  startCustomTimer: (params: any) => Promise<any>;
  pauseCustomTimer: () => Promise<void>;
  resumeCustomTimer: () => Promise<void>;
  stopCustomTimer: () => Promise<void>;
  formatTimer: (seconds: number) => string;
  setPage: (page: string) => void;
  openSequenceBuilder: (templateId: string) => void;
  styles: AppStyles;
}

export default function Timer({
  user,
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
  recentTimers = [],
  startCustomTimer,
  pauseCustomTimer,
  resumeCustomTimer,
  stopCustomTimer,
  formatTimer,
  setPage,
  openSequenceBuilder,
  styles,
}: TimerProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { allAlarms, playAlarm } = useAlarms(user?.id);

  // MANNI MODE ONLY: everything gated behind this flag is purely additive.
  // Light/Dark render exactly the JSX/styles they always have — this flag
  // is false for both, so none of the Manni-only branches below ever run
  // for them. Same pattern as Dashboard.tsx / BottomNav.tsx.
  const isManni = theme === "manni";

  // Mode: "custom" | "pomodoro" | "sequence"
  const [timerMode, setTimerMode] = useState<"custom" | "pomodoro" | "sequence">("custom");

  // Custom Timer Form State — Hours + Minutes instead of one raw minutes field
  const [taskName, setTaskName] = useState("");
  const [customHours, setCustomHours] = useState<LooseNumber>(0);
  const [customMinutes, setCustomMinutes] = useState<LooseNumber>(25);
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);

  // Shared color for Quick Timer + Pomodoro — same sharing pattern already
  // used by `selectedAlarmId` (Pomodoro's "work completion" alarm reuses
  // the same picker/state as Quick Timer's alarm), so a single session
  // color concept for both single-session modes, consistent with how the
  // rest of the app treats "one color per item."
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Pomodoro Form State
  const [pomoTaskName, setPomoTaskName] = useState("Pomodoro Focus");
  const [workMinutes, setWorkMinutes] = useState<LooseNumber>(25);
  const [breakMinutes, setBreakMinutes] = useState<LooseNumber>(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState<LooseNumber>(15);
  const [roundsBeforeLongBreak, setRoundsBeforeLongBreak] = useState<LooseNumber>(4);
  const [totalRounds, setTotalRounds] = useState<LooseNumber>(4);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [breakAlarmId, setBreakAlarmId] = useState<string | null>(null);

  // Sequence — real, persisted data (replaces the old hardcoded dummy
  // playlist). `blocks` here always reflects whichever template was most
  // recently loaded via loadBlocks — either today's weekly_schedules
  // assignment (on mount) or a template the user explicitly opened from
  // the library below.
  const {
    templates: sequenceTemplates,
    loadingTemplates: loadingSequenceTemplates,
    templatesError: sequenceTemplatesError,
    createSequenceTemplate,
    renameSequenceTemplate,
    duplicateSequenceTemplate,
    deleteSequenceTemplate,
    blocks: sequenceBlocks,
    loadingBlocks: loadingSequenceBlocks,
    blocksError: sequenceBlocksError,
    loadBlocks: loadSequenceBlocks,
    reorderBlocks: reorderSequenceBlocks,
  } = useSequences();

  const [todaysSequenceTemplateId, setTodaysSequenceTemplateId] = useState<string | null>(null);
  const [loadingTodaysSequence, setLoadingTodaysSequence] = useState(true);
  const [viewedSequenceTemplateId, setViewedSequenceTemplateId] = useState<string | null>(null);

  const [newSequenceTemplateName, setNewSequenceTemplateName] = useState("");
  const [creatingSequenceTemplate, setCreatingSequenceTemplate] = useState(false);
  const [renamingSequenceTemplateId, setRenamingSequenceTemplateId] = useState<string | null>(null);
  const [renameSequenceValue, setRenameSequenceValue] = useState("");

  // Recent Focus Sessions — edit modal state. Reuses the same RatingModal
  // component (it already has a rating scale + optional note field), just
  // pointed at an existing completed/stopped custom_timers row instead of
  // a freshly-finished one.
  const [editingRecentTimer, setEditingRecentTimer] = useState<any>(null);
  const [recentEditSaving, setRecentEditSaving] = useState(false);

  const isRunning = activeTimer?.status === "running";
  const isPaused = activeTimer?.status === "paused";
  const hasActiveSession = Boolean(activeTimer);

  // Effective total minutes for the custom timer, computed from
  // hours+minutes, clamped so 0h/0m never produces a 0-length timer.
  const customTotalMinutes = Math.max(
    1,
    clampMin(customHours, 0) * 60 + clampMin(customMinutes, 0)
  );

  const totalDuration = activeTimer ? activeTimer.duration_seconds : customTotalMinutes * 60;
  const progressPercent =
    totalDuration > 0
      ? Math.max(0, Math.min(100, Math.round(((totalDuration - remainingSeconds) / totalDuration) * 100)))
      : 0;

  function handleBack() {
    setPage("dashboard");
  }

  function applyPresetToHoursMinutes(totalMins: number) {
    setCustomHours(Math.floor(totalMins / 60));
    setCustomMinutes(totalMins % 60);
  }

  async function handleStartCustom() {
    const finalMinutes = customTotalMinutes;
    if (finalMinutes <= 0) return;

    // Clamp the visible fields too, in case the user left one empty
    setCustomHours((h) => clampMin(h, 0));
    setCustomMinutes((m) => clampMin(m, 0));

    await startCustomTimer({
      taskName: taskName.trim() || "Focus Session",
      durationMinutes: finalMinutes,
      alarmId: selectedAlarmId,
      color: selectedColor,
    });
  }

  async function handleStartPomodoro() {
    const finalWork = clampMin(workMinutes, 1);
    const finalBreak = clampMin(breakMinutes, 1);
    const finalLongBreak = clampMin(longBreakMinutes, 1);
    const finalRoundsBeforeLong = clampMin(roundsBeforeLongBreak, 1);
    const finalTotalRounds = clampMin(totalRounds, 1);

    setWorkMinutes(finalWork);
    setBreakMinutes(finalBreak);
    setLongBreakMinutes(finalLongBreak);
    setRoundsBeforeLongBreak(finalRoundsBeforeLong);
    setTotalRounds(finalTotalRounds);

    await startPomodoroCycle({
      taskName: pomoTaskName.trim() || "Pomodoro Focus",
      workMinutes: finalWork,
      breakMinutes: finalBreak,
      longBreakMinutes: finalLongBreak,
      roundsBeforeLongBreak: finalRoundsBeforeLong,
      totalRounds: finalTotalRounds,
      alarmId: selectedAlarmId,
      breakAlarmId,
      color: selectedColor,
      autoAdvance,
    });
  }

  async function handleStartSequenceBlock(block: SequenceBlock) {
    await startCustomTimer({
      taskName: block.name,
      durationMinutes: block.duration_minutes,
      alarmId: block.alarm_id,
      color: block.color,
    });
  }

  async function handleViewSequenceTemplate(templateId: string) {
    setViewedSequenceTemplateId(templateId);
    await loadSequenceBlocks(templateId);
  }

  async function handleCreateSequenceTemplate() {
    const name = newSequenceTemplateName.trim();
    if (!name) return;
    setCreatingSequenceTemplate(true);
    const created = await createSequenceTemplate(name);
    setCreatingSequenceTemplate(false);
    if (created) {
      setNewSequenceTemplateName("");
      // Brand-new Sequences start completely empty (per spec — no default
      // blocks), so send the user straight into the builder to add the
      // first period rather than showing them an empty list here.
      openSequenceBuilder(created.id);
    }
  }

  function handleStartRenameSequenceTemplate(t: SequenceTemplate) {
    setRenamingSequenceTemplateId(t.id);
    setRenameSequenceValue(t.name);
  }

  async function handleConfirmRenameSequenceTemplate() {
    if (!renamingSequenceTemplateId) return;
    const trimmed = renameSequenceValue.trim();
    if (trimmed) {
      await renameSequenceTemplate(renamingSequenceTemplateId, trimmed);
    }
    setRenamingSequenceTemplateId(null);
    setRenameSequenceValue("");
  }

  async function handleDuplicateSequenceTemplate(templateId: string) {
    await duplicateSequenceTemplate(templateId);
  }

  async function handleDeleteSequenceTemplate(templateId: string) {
    await deleteSequenceTemplate(templateId);
    if (viewedSequenceTemplateId === templateId) {
      setViewedSequenceTemplateId(null);
    }
    if (todaysSequenceTemplateId === templateId) {
      setTodaysSequenceTemplateId(null);
    }
  }

  // On mount, find whatever Sequence template today's weekly_schedules
  // row points at (see WeeklySchedule.tsx's second dropdown) and load it
  // straight into the Active Sequence panel — but it never auto-starts;
  // the user still has to press Start on a block themselves.
  useEffect(() => {
    async function loadTodaysSequenceAssignment() {
      if (!user?.id) {
        setLoadingTodaysSequence(false);
        return;
      }
      setLoadingTodaysSequence(true);

      const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const todayKey = dayKeys[new Date().getDay()];

      const { data } = await supabase
        .from("weekly_schedules")
        .select("sequence_template_id")
        .eq("user_id", user.id)
        .eq("day_of_week", todayKey)
        .maybeSingle();

      const assignedId = data?.sequence_template_id || null;
      setTodaysSequenceTemplateId(assignedId);

      if (assignedId) {
        setViewedSequenceTemplateId(assignedId);
        await loadSequenceBlocks(assignedId);
      }

      setLoadingTodaysSequence(false);
    }

    loadTodaysSequenceAssignment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Drag-to-reorder for whichever template's blocks are currently shown
  // in the Active Sequence panel. Dropping a block immediately persists
  // its new sort_order via reorderSequenceBlocks (see useSequences.ts).
  const {
    draggingIndex: sequenceDraggingIndex,
    getHandleProps: getSequenceHandleProps,
    getRowStyle: getSequenceRowStyle,
  } = useDragReorder<SequenceBlock>({
    items: sequenceBlocks,
    onReorder: async (newItems) => {
      await reorderSequenceBlocks(newItems);
    },
  });

  async function handleStop() {
    if (activeTimer?.pomodoro_group_id) {
      await stopPomodoroCycle();
    } else {
      await stopCustomTimer();
    }
  }

  async function handleSaveRecentEdit(rating: number, note?: string) {
    if (!editingRecentTimer) return;
    setRecentEditSaving(true);
    await submitTimerRating(editingRecentTimer.id, rating, note);
    setRecentEditSaving(false);
    setEditingRecentTimer(null);
  }

  // SVG Circular progress math
  const circleSize = 220;
  const strokeWidth = 10;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const sessionType = activeTimer?.session_type;
  const isBreak = sessionType === "short_break" || sessionType === "long_break";
  const roundNum = activeTimer?.round_number || 1;
  const totalRoundsCount = activeTimer?.total_rounds || 4;

  // Color-following active-session treatment. Falls back to the existing
  // amber-for-break / teal-for-focus default when the session has no
  // custom color, so nothing changes visually for a session nobody
  // colored — only sessions with a real color (from any of the three
  // pickers above, or a colored Sequence block) get a matching glow.
  // getColorGradient already branches internally on `theme`, so the
  // Manni pastel treatment here is automatic and required no changes.
  const activeFallbackColor = isBreak ? colors.warning : colors.accent;
  const activeColorTreatment = getColorGradient(
    activeTimer?.color || activeFallbackColor,
    theme,
    150
  );

  return (
    <div
      style={{
        ...styles.page,
        // MANNI MODE ONLY: soft blush gradient instead of the flat bg.
        // Light/Dark keep the exact same solid colors.bg they always had.
        background: isManni && colors.bgGradient ? colors.bgGradient : colors.bg,
        position: "relative",
      }}
    >
      {/* MANNI MODE ONLY: slow-drifting hearts/sparkles/stars behind all
          page content. Renders nothing for Light/Dark. */}
      {isManni && <ManniAmbientBackground />}

      <main style={{ ...styles.dashboard, position: "relative", zIndex: 1 }}>
        {/* BACK BUTTON */}
        <button
          type="button"
          style={{
            ...styles.backButton,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
          onClick={handleBack}
        >
          <ArrowLeftIcon />
          Back to Dashboard
        </button>

        {/* HEADER */}
        <div style={styles.timerHeader}>
          <p style={styles.eyebrow}>FOCUS TIMER</p>
          <h1
            style={{
              ...styles.routineTitle,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Focus & Multi-Period Timer
            {/* MANNI MODE ONLY: small sparkle accent next to the title. */}
            {isManni && (
              <span style={{ color: colors.accent, display: "inline-flex" }} aria-hidden="true">
                <SparkleIcon width={16} height={16} />
              </span>
            )}
          </h1>
          <p style={styles.cardText}>
            Run single focus sessions, standard Pomodoros, or multi-period routine sequences.
          </p>
        </div>

        {timerMessage && <p style={styles.message}>{timerMessage}</p>}

        {/* ========================================================
            ACTIVE SESSION VIEW (CIRCULAR PROGRESS & CONTROLS)
        ======================================================== */}
        {hasActiveSession ? (
          <section
            style={{
              ...styles.timerCard,
              textAlign: "center",
              position: "relative",
              padding: "32px 20px",
              background: activeColorTreatment.background,
              border: `1px solid ${activeColorTreatment.border}`,
              boxShadow: `0 20px 55px ${activeColorTreatment.shadowColor}`,
            }}
          >
            {/* MANNI MODE ONLY: twinkling accent tucked in the corner —
                a cloud during breaks, a heart during focus. */}
            {isManni && (
              <ManniCornerDecor
                kind={isBreak ? "cloud" : "heart"}
                corner="top-right"
                color={colors.accent}
              />
            )}

            {/* SESSION BADGE */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "999px",
                background: isBreak
                  ? theme === "manni"
                    ? "rgba(246, 178, 107, 0.18)"
                    : "rgba(232, 196, 104, 0.12)"
                  : theme === "manni"
                  ? colors.accentDim
                  : "rgba(88, 216, 196, 0.12)",
                border: isBreak
                  ? theme === "manni"
                    ? `1px solid ${colors.warning}`
                    : "1px solid rgba(232, 196, 104, 0.3)"
                  : `1px solid ${colors.accent}`,
                color: isBreak ? colors.warning : colors.accent,
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              {isBreak ? <CoffeeIcon width={14} height={14} /> : <FlameIcon width={14} height={14} />}
              {isBreak
                ? sessionType === "long_break"
                  ? "Long Break"
                  : "Short Break"
                : activeTimer?.pomodoro_group_id
                ? `Round ${roundNum} of ${totalRoundsCount}`
                : "Deep Focus"}
            </div>

            <h2 style={{ fontSize: "24px", margin: "0 0 6px", color: colors.text }}>{activeTimer?.task_name}</h2>
            <p style={{ ...styles.cardText, margin: "0 0 24px", color: isPaused ? colors.warning : colors.textDim }}>
              {isPaused ? "Paused" : isBreak ? "Rest and recharge." : "Stay immersed in your task."}
            </p>

            {/* CIRCULAR TIMER DISPLAY */}
            <div
              style={{
                position: "relative",
                width: `${circleSize}px`,
                height: `${circleSize}px`,
                margin: "0 auto 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={circleSize} height={circleSize} style={{ transform: "rotate(-90deg)" }}>
                {/* Background track */}
                <circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  stroke={colors.border}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                {/* Animated progress ring — matches the session's own
                    color when set, otherwise the existing amber/teal
                    break-vs-focus default (see activeColorTreatment above) */}
                <circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  stroke={activeColorTreatment.solid}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "44px",
                    fontWeight: 900,
                    letterSpacing: "-1.5px",
                    fontVariantNumeric: "tabular-nums",
                    color: colors.text,
                  }}
                >
                  {formatTimer(remainingSeconds)}
                </span>
                <span style={{ fontSize: "12px", color: colors.textDim, fontWeight: 700, marginTop: "4px" }}>
                  {progressPercent}% done
                </span>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
              {isRunning ? (
                <button
                  type="button"
                  style={{
                    ...styles.primary,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                  onClick={pauseCustomTimer}
                >
                  <PauseIcon width={16} height={16} />
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  style={{
                    ...styles.primary,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                  onClick={resumeCustomTimer}
                >
                  <PlayIcon width={16} height={16} />
                  Resume
                </button>
              )}

              {activeTimer?.pomodoro_group_id ? (
                <button
                  type="button"
                  style={{
                    ...styles.secondary,
                    marginTop: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                  onClick={skipPomodoroPhase}
                >
                  <SkipForwardIcon width={16} height={16} />
                  Skip Phase
                </button>
              ) : (
                <button
                  type="button"
                  style={{
                    ...styles.secondary,
                    marginTop: 0,
                    color: colors.danger,
                    borderColor: theme === "light" ? "#fcdada" : colors.border,
                  }}
                  onClick={handleStop}
                >
                  Stop Timer
                </button>
              )}
            </div>

            {activeTimer?.pomodoro_group_id && (
              <button
                type="button"
                style={{
                  ...styles.secondary,
                  marginTop: "10px",
                  color: colors.danger,
                }}
                onClick={handleStop}
              >
                End Full Pomodoro Cycle
              </button>
            )}
          </section>
        ) : pendingNextPhase ? (
          /* ========================================================
              POMODORO MANUAL TRANSITION PROMPT (Auto-advance is OFF)
          ======================================================== */
          <section style={{ ...styles.timerCard, textAlign: "center", padding: "32px 20px", position: "relative" }}>
            {/* MANNI MODE ONLY: twinkling star in the corner. */}
            {isManni && <ManniCornerDecor kind="star" corner="top-right" color={colors.accent} />}

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "999px",
                background: theme === "manni" ? colors.accentDim : "rgba(88, 216, 196, 0.12)",
                color: colors.accent,
                fontSize: "12px",
                fontWeight: 800,
                marginBottom: "16px",
              }}
            >
              PHASE COMPLETE
            </div>
            <h2 style={{ fontSize: "24px", margin: "0 0 8px", color: colors.text }}>Ready for the next phase?</h2>
            <p style={styles.cardText}>
              Next up:{" "}
              <strong>
                {pendingNextPhase.nextType === "focus"
                  ? `Focus Round ${pendingNextPhase.nextRound}`
                  : pendingNextPhase.nextType === "long_break"
                  ? "Long Break"
                  : "Short Break"}{" "}
                ({Math.round(pendingNextPhase.nextDuration / 60)} min)
              </strong>
            </p>

            <button
              type="button"
              style={{
                ...styles.primary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onClick={startNextPomodoroPhase}
            >
              <PlayIcon width={16} height={16} />
              Start Next Phase
            </button>

            <button
              type="button"
              style={{ ...styles.secondary, marginTop: "10px", color: colors.danger }}
              onClick={stopPomodoroCycle}
            >
              End Cycle
            </button>
          </section>
        ) : (
          /* ========================================================
              TIMER SETUP (CUSTOM, POMODORO, or MULTI-PERIOD SEQUENCE)
          ======================================================== */
          <>
            {/* MODE SWITCHER TABS */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setTimerMode("custom")}
                style={{
                  flex: 1,
                  padding: "10px 6px",
                  borderRadius: "12px",
                  border: timerMode === "custom" ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                  background:
                    timerMode === "custom"
                      ? theme === "light"
                        ? "#e3f5f0"
                        : theme === "manni"
                        ? colors.accentDim
                        : "#19322f"
                      : colors.card,
                  color: timerMode === "custom" ? colors.accentSoft : colors.textDim,
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                }}
              >
                <TimerCircleIcon width={14} height={14} />
                Quick Timer
              </button>

              <button
                type="button"
                onClick={() => setTimerMode("pomodoro")}
                style={{
                  flex: 1,
                  padding: "10px 6px",
                  borderRadius: "12px",
                  border: timerMode === "pomodoro" ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                  background:
                    timerMode === "pomodoro"
                      ? theme === "light"
                        ? "#e3f5f0"
                        : theme === "manni"
                        ? colors.accentDim
                        : "#19322f"
                      : colors.card,
                  color: timerMode === "pomodoro" ? colors.accentSoft : colors.textDim,
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                }}
              >
                <FlameIcon width={14} height={14} />
                Pomodoro
              </button>

              <button
                type="button"
                onClick={() => setTimerMode("sequence")}
                style={{
                  flex: 1,
                  padding: "10px 6px",
                  borderRadius: "12px",
                  border: timerMode === "sequence" ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                  background:
                    timerMode === "sequence"
                      ? theme === "light"
                        ? "#e3f5f0"
                        : theme === "manni"
                        ? colors.accentDim
                        : "#19322f"
                      : colors.card,
                  color: timerMode === "sequence" ? colors.accentSoft : colors.textDim,
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                }}
              >
                <BookIcon width={14} height={14} />
                Sequence
              </button>
            </div>

            {/* =====================
                MODE A: QUICK CUSTOM TIMER
            ===================== */}
            {timerMode === "custom" && (
              <section style={{ ...styles.timerCard, position: "relative" }}>
                {/* MANNI MODE ONLY: twinkling bow in the corner. */}
                {isManni && <ManniCornerDecor kind="bow" corner="top-right" color={colors.accent} />}

                <p style={styles.cardLabel}>TASK DETAILS</p>
                <input
                  type="text"
                  style={{ ...styles.input, marginTop: "8px" }}
                  placeholder="What are you working on? (e.g. Mathematics, Coding)"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                />

                <p style={{ ...styles.cardLabel, marginTop: "14px", marginBottom: "8px" }}>
                  QUICK PRESETS
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "14px" }}>
                  {QUICK_PRESETS.map((mins) => {
                    const active = customTotalMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => applyPresetToHoursMinutes(mins)}
                        style={{
                          padding: "12px 6px",
                          borderRadius: "12px",
                          border: active ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                          background: active
                            ? theme === "light"
                              ? "#e3f5f0"
                              : theme === "manni"
                              ? colors.accentDim
                              : "#19322f"
                            : colors.cardAlt,
                          color: active ? colors.accent : colors.text,
                          fontWeight: 700,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        {mins < 60 ? `${mins} min` : `${mins / 60}h${mins % 60 ? ` ${mins % 60}m` : ""}`}
                      </button>
                    );
                  })}
                </div>

                <p style={{ ...styles.cardLabel, marginTop: "12px", marginBottom: "6px" }}>
                  OR SET EXACT DURATION
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      inputMode="numeric"
                      style={{ ...styles.input, marginBottom: "4px" }}
                      value={customHours}
                      placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCustomHours(raw === "" ? "" : Math.max(0, Number(raw)));
                      }}
                      onBlur={() => setCustomHours((h) => clampMin(h, 0))}
                    />
                    <span style={{ fontSize: "11px", color: colors.textDim, fontWeight: 700 }}>hours</span>
                  </div>

                  <span style={{ fontSize: "20px", color: colors.textDim, marginTop: "-12px" }}>:</span>

                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      inputMode="numeric"
                      style={{ ...styles.input, marginBottom: "4px" }}
                      value={customMinutes}
                      placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCustomMinutes(raw === "" ? "" : Math.max(0, Math.min(59, Number(raw))));
                      }}
                      onBlur={() => setCustomMinutes((m) => clampMin(m, 0))}
                    />
                    <span style={{ fontSize: "11px", color: colors.textDim, fontWeight: 700 }}>minutes</span>
                  </div>
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <AlarmSelector
                    allAlarms={allAlarms}
                    value={selectedAlarmId}
                    onChange={setSelectedAlarmId}
                    onPreview={playAlarm}
                    styles={styles}
                    label="ALARM SOUND"
                  />
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <ColorSelector
                    value={selectedColor}
                    onChange={setSelectedColor}
                    styles={styles}
                    label="TIMER COLOR"
                  />
                </div>

                <button
                  type="button"
                  style={{
                    ...styles.primary,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                  onClick={handleStartCustom}
                  disabled={timerLoading}
                >
                  <PlayIcon width={16} height={16} />
                  Start Focus ({Math.floor(customTotalMinutes / 60) > 0 ? `${Math.floor(customTotalMinutes / 60)}h ` : ""}
                  {customTotalMinutes % 60}m)
                </button>
              </section>
            )}

            {/* =====================
                MODE B: POMODORO CYCLES
            ===================== */}
            {timerMode === "pomodoro" && (
              <section style={{ ...styles.timerCard, position: "relative" }}>
                {/* MANNI MODE ONLY: twinkling star in the corner. */}
                {isManni && <ManniCornerDecor kind="star" corner="top-right" color={colors.accent} />}

                <p style={styles.cardLabel}>SESSION NAME</p>
                <input
                  type="text"
                  style={{ ...styles.input, marginTop: "8px" }}
                  placeholder="Task or subject name"
                  value={pomoTaskName}
                  onChange={(e) => setPomoTaskName(e.target.value)}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
                  <div>
                    <p style={{ ...styles.cardLabel, marginBottom: "6px" }}>WORK (MIN)</p>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      style={styles.input}
                      value={workMinutes}
                      placeholder="25"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setWorkMinutes(raw === "" ? "" : Math.max(0, Number(raw)));
                      }}
                      onBlur={() => setWorkMinutes((v) => clampMin(v, 1))}
                    />
                  </div>
                  <div>
                    <p style={{ ...styles.cardLabel, marginBottom: "6px" }}>SHORT BREAK (MIN)</p>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      style={styles.input}
                      value={breakMinutes}
                      placeholder="5"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setBreakMinutes(raw === "" ? "" : Math.max(0, Number(raw)));
                      }}
                      onBlur={() => setBreakMinutes((v) => clampMin(v, 1))}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <p style={{ ...styles.cardLabel, marginBottom: "6px" }}>LONG BREAK (MIN)</p>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      style={styles.input}
                      value={longBreakMinutes}
                      placeholder="15"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setLongBreakMinutes(raw === "" ? "" : Math.max(0, Number(raw)));
                      }}
                      onBlur={() => setLongBreakMinutes((v) => clampMin(v, 1))}
                    />
                  </div>
                  <div>
                    <p style={{ ...styles.cardLabel, marginBottom: "6px" }}>TOTAL ROUNDS</p>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      inputMode="numeric"
                      style={styles.input}
                      value={totalRounds}
                      placeholder="4"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setTotalRounds(raw === "" ? "" : Math.max(0, Math.min(20, Number(raw))));
                      }}
                      onBlur={() => setTotalRounds((v) => clampMin(v, 1))}
                    />
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    margin: "12px 0 16px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    color: colors.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: colors.accent }}
                  />
                  <span>Auto-advance into breaks & next rounds</span>
                </label>

                <div style={{ marginBottom: "16px" }}>
                  <AlarmSelector
                    allAlarms={allAlarms}
                    value={selectedAlarmId}
                    onChange={setSelectedAlarmId}
                    onPreview={playAlarm}
                    styles={styles}
                    label="WORK COMPLETION ALARM"
                  />
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <AlarmSelector
                    allAlarms={allAlarms}
                    value={breakAlarmId}
                    onChange={setBreakAlarmId}
                    onPreview={playAlarm}
                    styles={styles}
                    label="BREAK COMPLETION ALARM"
                  />
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <ColorSelector
                    value={selectedColor}
                    onChange={setSelectedColor}
                    styles={styles}
                    label="TIMER COLOR"
                  />
                </div>

                <button
                  type="button"
                  style={{
                    ...styles.primary,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                  onClick={handleStartPomodoro}
                  disabled={timerLoading}
                >
                  <FlameIcon width={16} height={16} />
                  Start Pomodoro ({clampMin(totalRounds, 1)} Rounds)
                </button>
              </section>
            )}

            {/* =====================
                MODE C: SEQUENCE (persisted, template-backed)
            ===================== */}
            {timerMode === "sequence" && (
              <>
                {/* TODAY'S ACTIVE SEQUENCE */}
                <section style={{ ...styles.timerCard, marginBottom: "16px", position: "relative" }}>
                  {/* MANNI MODE ONLY: twinkling sparkle in the corner. */}
                  {isManni && <ManniCornerDecor kind="sparkle" corner="top-right" color={colors.accent} />}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <p style={{ ...styles.cardLabel, margin: 0 }}>
                      {viewedSequenceTemplateId && viewedSequenceTemplateId === todaysSequenceTemplateId
                        ? "TODAY'S ACTIVE SEQUENCE"
                        : viewedSequenceTemplateId
                        ? "VIEWING SEQUENCE"
                        : "TODAY'S ACTIVE SEQUENCE"}
                    </p>
                    {sequenceBlocks.length > 0 && (
                      <span style={{ fontSize: "12px", color: colors.accent, fontWeight: 700 }}>
                        {sequenceBlocks.reduce((sum, b) => sum + b.duration_minutes, 0)} min total
                      </span>
                    )}
                  </div>

                  {viewedSequenceTemplateId && (
                    <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: colors.text }}>
                      {sequenceTemplates.find((t) => t.id === viewedSequenceTemplateId)?.name || "Sequence"}
                    </p>
                  )}

                  {loadingTodaysSequence || loadingSequenceBlocks ? (
                    <p style={styles.cardText}>Loading Sequence...</p>
                  ) : !viewedSequenceTemplateId ? (
                    <div>
                      <p style={styles.cardText}>
                        No Sequence is assigned to today. Assign one in Weekly Schedule, or open any Sequence
                        below to view and run it here.
                      </p>
                      <button
                        type="button"
                        style={{ ...styles.secondary, marginTop: "10px" }}
                        onClick={() => setPage("weekly-schedule")}
                      >
                        Go to Weekly Schedule
                      </button>
                    </div>
                  ) : sequenceBlocksError ? (
                    <p style={{ ...styles.cardText, color: colors.danger }}>{sequenceBlocksError}</p>
                  ) : sequenceBlocks.length === 0 ? (
                    <div>
                      <p style={styles.cardText}>This Sequence doesn't have any periods yet.</p>
                      <button
                        type="button"
                        style={{ ...styles.secondary, marginTop: "10px" }}
                        onClick={() => openSequenceBuilder(viewedSequenceTemplateId)}
                      >
                        Add Periods in Builder
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                        {sequenceBlocks.map((block, idx) => {
                          // Color-coded left border: the block's own color if
                          // set, otherwise the existing default (amber for
                          // breaks, teal for study) — same fallback pattern
                          // used everywhere else in the app.
                          const blockAccent = block.color || (block.is_break ? colors.warning : colors.accent);
                          const isDragging = sequenceDraggingIndex === idx;
                          const handleProps = getSequenceHandleProps(idx);

                          return (
                            <div
                              key={block.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 14px",
                                borderRadius: "12px",
                                background: block.is_break
                                  ? theme === "light"
                                    ? "#fbf6ec"
                                    : theme === "manni"
                                    ? "rgba(246, 178, 107, 0.12)"
                                    : "#1a1e16"
                                  : colors.cardAlt,
                                border: `1px solid ${block.is_break ? "rgba(232, 196, 104, 0.3)" : colors.border}`,
                                borderLeft: `4px solid ${blockAccent}`,
                                opacity: isDragging ? 0.92 : 1,
                                ...getSequenceRowStyle(idx),
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                <span
                                  {...handleProps}
                                  style={{ ...handleProps.style, color: colors.textDim, display: "flex", flexShrink: 0 }}
                                  aria-label="Drag to reorder"
                                >
                                  <DragHandleIcon width={16} height={16} />
                                </span>

                                <span
                                  style={{
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "6px",
                                    background: block.is_break ? "rgba(232, 196, 104, 0.2)" : colors.accentDim,
                                    color: block.is_break ? colors.warning : colors.accent,
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {idx + 1}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                  <strong style={{ fontSize: "13px", color: colors.text }}>{block.name}</strong>
                                  <p style={{ margin: 0, fontSize: "11px", color: colors.textDim }}>
                                    {block.duration_minutes} min {block.is_break ? "· Break" : "· Study Period"}
                                    {block.alarm_id
                                      ? ` · ${allAlarms.find((a) => a.id === block.alarm_id)?.name || "Custom Bell"}`
                                      : ""}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  background: block.is_break ? colors.warning : colors.accent,
                                  color: colors.accentText,
                                  border: "none",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  flexShrink: 0,
                                }}
                                onClick={() => handleStartSequenceBlock(block)}
                              >
                                Start
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          style={{
                            ...styles.primary,
                            flex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                          }}
                          onClick={() => handleStartSequenceBlock(sequenceBlocks[0])}
                        >
                          <PlayIcon width={16} height={16} />
                          Start with "{sequenceBlocks[0].name}"
                        </button>

                        <button
                          type="button"
                          style={{ ...styles.secondary, marginTop: 0, flex: "0 0 auto" }}
                          onClick={() => openSequenceBuilder(viewedSequenceTemplateId)}
                        >
                          Edit
                        </button>
                      </div>
                    </>
                  )}
                </section>

                {/* SEQUENCE TEMPLATES LIBRARY */}
                <section style={{ ...styles.timerCard, position: "relative" }}>
                  {/* MANNI MODE ONLY: twinkling ribbon in the corner. */}
                  {isManni && <ManniCornerDecor kind="ribbon" corner="top-right" color={colors.accent} />}

                  <p style={{ ...styles.cardLabel, marginBottom: "12px" }}>SEQUENCE TEMPLATES</p>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <input
                      type="text"
                      style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                      placeholder="New Sequence name"
                      value={newSequenceTemplateName}
                      onChange={(e) => setNewSequenceTemplateName(e.target.value)}
                    />
                    <button
                      type="button"
                      style={{
                        padding: "0 16px",
                        borderRadius: "10px",
                        background: colors.accent,
                        color: colors.accentText,
                        border: "none",
                        fontSize: "13px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexShrink: 0,
                      }}
                      onClick={handleCreateSequenceTemplate}
                      disabled={creatingSequenceTemplate || !newSequenceTemplateName.trim()}
                    >
                      <PlusIcon width={14} height={14} />
                      Create
                    </button>
                  </div>

                  {sequenceTemplatesError && (
                    <p style={{ ...styles.cardText, color: colors.danger, marginBottom: "10px" }}>
                      {sequenceTemplatesError}
                    </p>
                  )}

                  {loadingSequenceTemplates ? (
                    <p style={styles.cardText}>Loading Sequence templates...</p>
                  ) : sequenceTemplates.length === 0 ? (
                    <p style={styles.cardText}>
                      No Sequence templates yet. Create one above to start building your first Sequence.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {sequenceTemplates.map((t) => {
                        const isRenaming = renamingSequenceTemplateId === t.id;
                        const isToday = t.id === todaysSequenceTemplateId;

                        return (
                          <div
                            key={t.id}
                            style={{
                              padding: "12px 14px",
                              borderRadius: "12px",
                              background: colors.cardAlt,
                              border: `1px solid ${isToday ? colors.accent : colors.border}`,
                            }}
                          >
                            {isRenaming ? (
                              <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                                <input
                                  type="text"
                                  style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                                  value={renameSequenceValue}
                                  onChange={(e) => setRenameSequenceValue(e.target.value)}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  style={{
                                    padding: "0 14px",
                                    borderRadius: "8px",
                                    background: colors.accent,
                                    color: colors.accentText,
                                    border: "none",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                  onClick={handleConfirmRenameSequenceTemplate}
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <strong style={{ fontSize: "14px", color: colors.text }}>{t.name}</strong>
                                {isToday && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      color: colors.accent,
                                      letterSpacing: "0.5px",
                                    }}
                                  >
                                    TODAY
                                  </span>
                                )}
                              </div>
                            )}

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              <button
                                type="button"
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  border: `1px solid ${colors.border}`,
                                  background: "transparent",
                                  color: colors.accent,
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                onClick={() => handleViewSequenceTemplate(t.id)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  border: `1px solid ${colors.border}`,
                                  background: "transparent",
                                  color: colors.text,
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                onClick={() => openSequenceBuilder(t.id)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  border: `1px solid ${colors.border}`,
                                  background: "transparent",
                                  color: colors.text,
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                onClick={() => handleDuplicateSequenceTemplate(t.id)}
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                style={{
                                  padding: "6px",
                                  borderRadius: "8px",
                                  border: "none",
                                  background: "transparent",
                                  color: colors.danger,
                                  cursor: "pointer",
                                }}
                                onClick={() => handleDeleteSequenceTemplate(t.id)}
                                aria-label="Delete Sequence template"
                              >
                                <TrashIcon width={14} height={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {/* FOCUS TIPS */}
        <div style={{ ...styles.timerInfoCard, marginTop: "16px", position: "relative" }}>
          {/* MANNI MODE ONLY: twinkling cloud in the corner. */}
          {isManni && <ManniCornerDecor kind="cloud" corner="top-right" color={colors.accent} size={22} />}

          <p style={styles.cardLabel}>ACCURATE TIMESTAMP ENGINE</p>
          <p style={styles.tipText}>
            All focus periods compute from authoritative target timestamps, ensuring 100% precision even when your screen sleeps or you switch tabs.
          </p>
        </div>

        {/* RECENT TIMERS HISTORY */}
        {recentTimers.length > 0 && !hasActiveSession && (
          <section style={{ marginTop: "24px" }}>
            <p style={{ ...styles.cardLabel, marginBottom: "10px" }}>RECENT FOCUS SESSIONS</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentTimers.slice(0, 5).map((t) => {
                const editable = isWithinEditWindow(t.start_timestamp || t.created_at);
                const recentAccent = t.color || colors.accent;

                return (
                  <div
                    key={t.id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "14px",
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderLeft: `4px solid ${recentAccent}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: "14px", color: colors.text }}>{t.task_name}</p>
                        <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                          {Math.round((t.duration_seconds || 0) / 60)} min ·{" "}
                          {t.status === "completed" ? "Completed" : "Stopped"}
                          {t.rating ? ` · ${t.rating}/10` : ""}
                        </p>
                        {t.note && (
                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: "12px",
                              color: colors.textDim,
                              fontStyle: "italic",
                              lineHeight: 1.4,
                            }}
                          >
                            "{t.note}"
                          </p>
                        )}
                      </div>

                      {editable && (
                        <button
                          type="button"
                          onClick={() => setEditingRecentTimer(t)}
                          style={{
                            flexShrink: 0,
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            background: "transparent",
                            color: colors.accent,
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div style={{ height: "40px" }} />
      </main>

      {/* RATING MODAL (fired upon completion) */}
      {pendingRatingTimer && (
        <RatingModal
          title={pendingRatingTimer.isPomodoroFinale ? "Pomodoro Cycle Completed!" : "Focus Session Completed!"}
          subtitle={`How was your focus during "${pendingRatingTimer.task_name}"?`}
          onSubmit={async (rating, note) => {
            await submitTimerRating(pendingRatingTimer.id, rating, note);
          }}
          onSkip={dismissRating}
          styles={styles}
        />
      )}

      {/* EDIT MODAL — for Recent Focus Sessions, only shown within the
          48-hour edit window (see isWithinEditWindow above). Reuses the
          same rating+note UI, saving through the existing submitTimerRating
          function, which already updates both the rating and note columns. */}
      {editingRecentTimer && (
        <RatingModal
          title="Edit Session"
          subtitle={editingRecentTimer.task_name}
          initialRating={editingRecentTimer.rating || 8}
          onSubmit={handleSaveRecentEdit}
          onSkip={() => setEditingRecentTimer(null)}
          styles={styles}
        />
      )}
    </div>
  );
}
