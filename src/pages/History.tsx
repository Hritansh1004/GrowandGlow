import { useState } from "react";
import { AppStyles } from "../hooks/useStyles";
import useHistory from "../hooks/useHistory";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";
import RatingModal from "../components/RatingModal";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  CoffeeIcon,
  ChartIcon,
  UsersIcon,
} from "../components/Icons";

function formatMinutes(mins: number) {
  const safe = Math.max(0, Math.round(mins));
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatTimeOnly(timeStr?: string | null) {
  if (!timeStr) return "";
  if (timeStr.includes("T")) {
    return new Date(timeStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const [hours, minutes] = timeStr.slice(0, 5).split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

interface HistoryProps {
  user: any;
  setPage: (page: string) => void;
  styles: AppStyles;
}

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "last7", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
];

export default function History({ user, setPage, styles }: HistoryProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const {
    rangeKey,
    setRangeKey,
    rangeLabel,
    groupedHistory = [],
    overallStats,
    historyLoading,
    historyMessage,
    submitPeriodSessionRating,
  } = useHistory(user?.id);

  // NEW — Core Vision 8.7/8.8: lets the user rate/edit ANY past Routine
  // period session from History, on any date, not just the live "today"
  // moment it completed. No 48h cutoff (unlike Timer's Recent Focus
  // Sessions) — Routine history is meant to stay permanently editable.
  const [ratingTargetSession, setRatingTargetSession] = useState<any>(null);

  async function handleRatingSubmit(rating: number, note?: string) {
    if (!ratingTargetSession) return;
    await submitPeriodSessionRating(ratingTargetSession, rating, note);
    setRatingTargetSession(null);
  }

  return (
    <div style={styles.page}>
      <main style={styles.dashboard}>
        {/* BACK TO DASHBOARD */}
        <button
          type="button"
          style={{ ...styles.backButton, display: "inline-flex", alignItems: "center", gap: "8px" }}
          onClick={() => setPage("dashboard")}
        >
          <ArrowLeftIcon />
          Back to Dashboard
        </button>

        {/* HEADER */}
        <div style={styles.timerHeader}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={styles.eyebrow}>STUDY LOGS</p>
              <h1 style={styles.routineTitle}>History & Logs</h1>
              <p style={styles.cardText}>
                Review past focus periods, custom sessions, and daily ratings. Tap Edit on any
                period to rate or update it, any time.
              </p>
            </div>

            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 16px",
                borderRadius: "12px",
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: colors.accent,
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
              }}
              onClick={() => setPage("analytics")}
            >
              <ChartIcon width={16} height={16} />
              Analytics
            </button>
          </div>
        </div>

        {historyMessage && <p style={styles.message}>{historyMessage}</p>}

        {/* RANGE SELECTION BUTTONS */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "4px",
            marginBottom: "18px",
          }}
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              style={{
                padding: "8px 14px",
                borderRadius: "12px",
                border: rangeKey === r.key ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                background: rangeKey === r.key ? (theme === "light" ? "#e3f5f0" : "#19322f") : colors.card,
                color: rangeKey === r.key ? colors.accentSoft : colors.textDim,
                fontSize: "12px",
                fontWeight: 700,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* SUMMARY STATS BAR */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <div style={styles.timerCard}>
            <p style={styles.cardLabel}>TOTAL FOCUS</p>
            <h3 style={{ margin: "4px 0 0", fontSize: "18px", color: colors.accent }}>
              {formatMinutes(overallStats?.totalFocusMinutes || 0)}
            </h3>
          </div>

          <div style={styles.timerCard}>
            <p style={styles.cardLabel}>SESSIONS</p>
            <h3 style={{ margin: "4px 0 0", fontSize: "18px", color: colors.text }}>
              {overallStats?.totalSessions || 0}
            </h3>
          </div>

          <div style={styles.timerCard}>
            <p style={styles.cardLabel}>AVG RATING</p>
            <h3 style={{ margin: "4px 0 0", fontSize: "18px", color: colors.text }}>
              {overallStats?.averageRating ? `${overallStats.averageRating}★` : "—"}
            </h3>
          </div>
        </div>

        {/* HISTORY LIST GROUPED BY DATE */}
        {historyLoading ? (
          <div style={styles.timerInfoCard}>
            <p style={styles.cardText}>Loading study logs...</p>
          </div>
        ) : !groupedHistory || groupedHistory.length === 0 ? (
          <div style={styles.timerInfoCard}>
            <p style={styles.cardText}>No study sessions recorded for {rangeLabel?.toLowerCase() || "selected period"}.</p>
            <p style={styles.tipText}>
              Complete periods in your routine or run focus timers to record history.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {groupedHistory.map((group: any) => {
              const pSessions = group.periodSessions || group.periods || [];
              const cTimers = group.customTimers || group.timers || [];
              const dateHeading = group.dateLabel || group.date || "Date";
              const totalMins = group.totalMinutes || group.stats?.totalFocusMinutes || 0;

              return (
                <div key={group.date || Math.random()}>
                  {/* DATE HEADER */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                      paddingBottom: "6px",
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <strong style={{ fontSize: "15px", color: colors.text }}>{dateHeading}</strong>
                    <span style={{ fontSize: "12px", color: colors.accent, fontWeight: 700 }}>
                      {formatMinutes(totalMins)} focus
                    </span>
                  </div>

                  {/* SESSIONS IN THIS DAY */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {pSessions.length === 0 && cTimers.length === 0 && (
                      <p style={{ margin: "4px 0", fontSize: "12px", color: colors.textDim }}>
                        No completed sessions logged for this day.
                      </p>
                    )}

                    {/* Routine Periods (solo + room-sourced, merged) */}
                    {pSessions.map((session: any) => {
                      const isBreak = session.is_break;
                      const isCompleted = session.status === "completed";
                      const isRoom = Boolean(session.is_room);
                      const canRate = isCompleted && !isBreak;

                      return (
                        <div
                          key={session.id || Math.random()}
                          style={{
                            padding: "14px 16px",
                            borderRadius: "14px",
                            background: colors.card,
                            border: isRoom ? `1px solid ${colors.accent}40` : `1px solid ${colors.border}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "10px",
                                  background: isBreak
                                    ? (theme === "light" ? "#eef4f7" : "#19282f")
                                    : (theme === "light" ? "#e3f5f0" : "#162825"),
                                  color: isBreak ? colors.textDim : colors.accent,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {isBreak ? (
                                  <CoffeeIcon width={16} height={16} />
                                ) : isCompleted ? (
                                  <CheckIcon width={16} height={16} />
                                ) : (
                                  <ClockIcon width={16} height={16} />
                                )}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <strong style={{ fontSize: "14px", color: colors.text }}>
                                  {session.period_name || session.subject || (isBreak ? "Break" : "Study Period")}
                                </strong>
                                <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                                  {formatTimeOnly(session.planned_start)} – {formatTimeOnly(session.planned_end)}
                                </p>
                                {isRoom && (
                                  <p
                                    style={{
                                      margin: "3px 0 0",
                                      fontSize: "11px",
                                      color: colors.accent,
                                      fontWeight: 700,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <UsersIcon width={11} height={11} />
                                    via {session.room_name || "Study Room"}
                                  </p>
                                )}
                                {session.note && (
                                  <p
                                    style={{
                                      margin: "4px 0 0",
                                      fontSize: "12px",
                                      color: colors.textDim,
                                      fontStyle: "italic",
                                    }}
                                  >
                                    "{session.note}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              {session.rating != null && (
                                <span style={{ fontSize: "12px", color: colors.warning, fontWeight: 700, display: "block" }}>
                                  {session.rating}/10
                                </span>
                              )}
                              <p style={{ margin: 0, fontSize: "11px", color: isCompleted ? colors.accent : colors.textDim }}>
                                {session.status || "completed"}
                              </p>
                            </div>
                          </div>

                          {canRate && (
                            <div style={{ marginTop: "10px" }}>
                              <button
                                type="button"
                                onClick={() => setRatingTargetSession(session)}
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
                              >
                                {session.rating != null ? "Edit Rating" : "Rate this"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Custom Timers */}
                    {cTimers.map((timer: any) => (
                      <div
                        key={timer.id || Math.random()}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "14px",
                          background: colors.card,
                          border: `1px solid ${colors.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "10px",
                              background: theme === "light" ? "#e3f5f0" : "#162825",
                              color: colors.accent,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <ClockIcon width={16} height={16} />
                          </div>

                          <div>
                            <strong style={{ fontSize: "14px", color: colors.text }}>
                              {timer.task_name || "Focus Session"}
                            </strong>
                            <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                              {formatTimeOnly(timer.start_timestamp)} · {formatMinutes((timer.duration_seconds || 0) / 60)}
                            </p>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          {timer.rating && (
                            <span style={{ fontSize: "12px", color: colors.warning, fontWeight: 700 }}>
                              {timer.rating}★
                            </span>
                          )}
                          <p style={{ margin: 0, fontSize: "11px", color: colors.accent }}>
                            Custom Timer
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* RATING MODAL — used to rate or edit-the-rating of ANY past Routine
          period session, solo or room-sourced, no date/time-window cutoff */}
      {ratingTargetSession && (
        <RatingModal
          title={ratingTargetSession.rating != null ? "Edit Rating" : "Rate This Period"}
          subtitle={ratingTargetSession.period_name}
          initialRating={ratingTargetSession.rating || 8}
          onSubmit={handleRatingSubmit}
          onSkip={() => setRatingTargetSession(null)}
          styles={styles}
        />
      )}
    </div>
  );
}
