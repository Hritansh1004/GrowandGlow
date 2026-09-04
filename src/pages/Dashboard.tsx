import { useTheme } from "../context/ThemeContext";
import { getThemeColors, getColorGradient } from "../styles/theme";
import { AppStyles } from "../hooks/useStyles";
import useNotifications from "../hooks/useNotifications";
import {
  BellIcon,
  BookIcon,
  TimerCircleIcon,
  CalendarIcon,
  UsersIcon,
  HeartIcon,
} from "../components/Icons";
import { ManniAmbientBackground, ManniCornerDecor } from "../components/ManniEffects";
import AvatarDisplay from "../components/AvatarDisplay";
interface DashboardProps {
  profile: any;
  user: any;
  currentTime: Date;
  currentRoutineItem: any;
  nextRoutineItem: any;
  todayTasks?: any[];
  completedTodayTasks?: any[];
  remainingTodayTasks?: any[];
  nextPlannerTask?: any;
  setPage: (page: string) => void;
  setMessage: (msg: string) => void;
  logout: () => void;
  message?: string;
  styles: AppStyles;
}

export default function Dashboard({
  profile,
  user,
  currentTime,
  currentRoutineItem,
  nextRoutineItem,
  todayTasks = [],
  completedTodayTasks = [],
  remainingTodayTasks = [],
  nextPlannerTask = null,
  setPage,
  logout,
  message,
  styles,
}: DashboardProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { unreadCount } = useNotifications(user?.id);

  // MANNI MODE ONLY: everything gated behind this flag is purely additive.
  // Light/Dark render exactly the JSX/styles they always have — this flag
  // is false for both, so none of the Manni-only branches below ever run
  // for them.
  const isManni = theme === "manni";

  const totalToday = todayTasks.length;
  const completedToday = completedTodayTasks.length;
  const remainingToday = remainingTodayTasks.length;

  const progress = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const greeting = (() => {
    const hour = currentTime.getHours();
    if (hour < 5) return "Still up";
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Good night";
  })();

  function formatTaskTime(task: any) {
    if (!task) return "";
    const start = task.start_time?.slice(0, 5) || "";
    const end = task.end_time?.slice(0, 5) || "";
    return `${start} – ${end}`;
  }

  function formatNextTaskDate(task: any) {
    if (!task?.task_date) return "";
    const date = new Date(`${task.task_date}T00:00:00`);
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  const statusLabel = currentRoutineItem
    ? currentRoutineItem.type === "Break"
      ? "On a break"
      : `Studying — ${currentRoutineItem.subject}`
    : nextRoutineItem
    ? "Free time"
    : "Nothing scheduled";

  const isActive = Boolean(currentRoutineItem && currentRoutineItem.type !== "Break");

  return (
    <div
      style={{
        ...styles.page,
        // MANNI MODE ONLY: soft blush gradient instead of the flat bg.
        // Light/Dark keep the exact same solid colors.bg they always had.
        background: isManni && colors.bgGradient ? colors.bgGradient : colors.bg,
        color: colors.text,
        position: "relative",
      }}
    >
      {/* MANNI MODE ONLY: slow-drifting hearts/sparkles/stars behind all
          page content. Renders nothing for Light/Dark. */}
      {isManni && <ManniAmbientBackground />}

      <main style={{ ...styles.dashboard, position: "relative", zIndex: 1 }}>
        {/* BRAND NAV BAR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <img
              src={theme === "dark" ? "/Logo.png" : theme === "light" ? "/Logo2.png" : "/Logo1.png"}
              alt="Grow & Glow logo"
              style={{ width: "26px", height: "26px", objectFit: "contain", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: colors.text,
              }}
            >
              Grow <span style={{ color: colors.accent }}>&amp; Glow</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setPage("notifications")}
              style={{
                position: "relative",
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: colors.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              aria-label="Notifications"
            >
              <BellIcon width={17} height={17} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-3px",
                    right: "-3px",
                    minWidth: "16px",
                    height: "16px",
                    padding: "0 4px",
                    borderRadius: "999px",
                    background: colors.accent,
                    color: colors.accentText,
                    fontSize: "10px",
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <button
              style={{
                ...styles.logoutButton,
                background: colors.card,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>

        {/* TOP BAR */}
        <div style={{ ...styles.topBar, marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <AvatarDisplay
              avatarUrl={profile?.avatar_url}
              name={profile?.display_name}
              size={54}
              background={colors.accentDim}
              color={colors.accent}
              border={`1px solid ${colors.border}`}
            />
            <div>
              <p style={{ ...styles.eyebrow, color: colors.accent, margin: "0 0 3px" }}>{greeting.toUpperCase()}</p>
              <h1
                style={{
                  ...styles.dashboardTitle,
                  color: colors.text,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {profile?.display_name || "there"}
                {/* MANNI MODE ONLY: small heart accent next to the name. */}
                {isManni && (
                  <span style={{ color: colors.accent, display: "inline-flex" }} aria-hidden="true">
                    <HeartIcon width={16} height={16} />
                  </span>
                )}
              </h1>
            </div>
          </div>
        </div>

        {/* LIVE CLOCK + STATUS — background/border/glow follow the
            current routine item's own chosen color when it has one,
            otherwise the existing teal default (see getColorGradient
            in theme.ts). getColorGradient already branches internally
            on `theme`, so the Manni pastel treatment here is automatic
            and required no changes in this file. */}
        <div
          style={{
            position: "relative",
            padding: "26px 24px",
            marginBottom: "14px",
            borderRadius: "26px",
            background: isActive
              ? getColorGradient(currentRoutineItem?.color, theme, 150).background
              : colors.card,
            border: isActive
              ? `1px solid ${getColorGradient(currentRoutineItem?.color, theme, 150).border}`
              : `1px solid ${colors.border}`,
            boxShadow: isActive
              ? `0 20px 55px ${getColorGradient(currentRoutineItem?.color, theme, 150).shadowColor}`
              : "none",
          }}
        >
          {/* MANNI MODE ONLY: twinkling bow tucked in the corner. */}
          {isManni && <ManniCornerDecor kind="bow" corner="top-right" color={colors.accent} />}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <p style={{ ...styles.cardLabel, color: colors.textDim }}>RIGHT NOW</p>
              <h2
                style={{
                  fontSize: "52px",
                  margin: "10px 0 4px",
                  letterSpacing: "-2.5px",
                  fontVariantNumeric: "tabular-nums",
                  color: colors.text,
                }}
              >
                {currentTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "7px 12px",
                borderRadius: "999px",
                background: isActive ? colors.accentDim : colors.cardAlt,
                marginTop: "4px",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: isActive
                    ? getColorGradient(currentRoutineItem?.color, theme, 150).solid
                    : colors.textFaint,
                  boxShadow: isActive
                    ? `0 0 8px ${getColorGradient(currentRoutineItem?.color, theme, 150).solid}`
                    : "none",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: isActive ? colors.accentSoft : colors.textDim,
                  whiteSpace: "nowrap",
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {currentRoutineItem && (
            <p
              style={{
                color: colors.textDim,
                fontSize: "13px",
                margin: "6px 0 0",
              }}
            >
              until {currentRoutineItem.end}
            </p>
          )}
        </div>

        {/* TODAY'S PROGRESS */}
        <div
          style={{
            position: "relative",
            marginBottom: "14px",
            padding: "22px",
            borderRadius: "22px",
            background: colors.card,
            border: `1px solid ${colors.border}`,
          }}
        >
          {/* MANNI MODE ONLY: twinkling sparkle in the corner. */}
          {isManni && <ManniCornerDecor kind="sparkle" corner="top-right" color={colors.accent} />}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "14px",
            }}
          >
            <div>
              <p style={{ ...styles.cardLabel, color: colors.textDim }}>TODAY'S PROGRESS</p>
              <h2 style={{ margin: "7px 0 0", color: colors.text }}>
                {completedToday} of {totalToday} completed
              </h2>
            </div>

            <strong style={{ color: colors.accent, fontSize: "24px" }}>
              {progress}%
            </strong>
          </div>

          <div
            style={{
              height: "9px",
              borderRadius: "99px",
              background: colors.cardAlt,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: "99px",
                background: colors.accent,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <p style={{ ...styles.cardText, marginTop: "14px", marginBottom: 0, color: colors.textDim }}>
            {totalToday === 0
              ? "Nothing planned for today yet."
              : remainingToday === 0
              ? "Everything planned for today is complete. Nice work."
              : `${remainingToday} task${remainingToday === 1 ? "" : "s"} remaining today.`}
          </p>
        </div>

        {/* NEXT PLANNER TASK */}
        <div
          style={{
            position: "relative",
            marginBottom: "14px",
            padding: "22px",
            borderRadius: "22px",
            background: nextPlannerTask
              ? `linear-gradient(145deg, ${colors.accentDim}, ${colors.card})`
              : colors.card,
            border: `1px solid ${nextPlannerTask ? colors.accent : colors.border}`,
            boxShadow: nextPlannerTask
              ? theme === "light"
                ? "0 12px 40px rgba(24, 138, 117, 0.05)"
                : theme === "manni"
                ? `0 12px 40px ${colors.borderGlow || "rgba(244, 143, 177, 0.2)"}`
                : "0 12px 40px rgba(88, 216, 196, 0.06)"
              : "none",
          }}
        >
          {/* MANNI MODE ONLY: heart in the corner when there's an upcoming task. */}
          {isManni && nextPlannerTask && (
            <ManniCornerDecor kind="heart" corner="top-right" color={colors.accent} />
          )}

          <p style={{ ...styles.cardLabel, color: colors.textDim }}>NEXT UP</p>

          {nextPlannerTask ? (
            <>
              <h2 style={{ fontSize: "23px", margin: "8px 0 5px", color: colors.text }}>
                {nextPlannerTask.title}
              </h2>

              <p
                style={{
                  color: colors.accent,
                  fontSize: "12px",
                  fontWeight: "800",
                  letterSpacing: "1.5px",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                }}
              >
                {nextPlannerTask.subject}
              </p>

              <p style={{ color: colors.textDim, margin: 0 }}>
                {formatNextTaskDate(nextPlannerTask)} · {formatTaskTime(nextPlannerTask)}
              </p>

              <button
                style={{
                  ...styles.primary,
                  marginTop: "16px",
                  background: colors.accent,
                  color: colors.accentText,
                }}
                onClick={() => setPage("planner")}
              >
                Open Planner
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: "20px", margin: "8px 0", color: colors.text }}>
                You're all caught up
              </h2>
              <p style={{ ...styles.cardText, marginBottom: 0, color: colors.textDim }}>
                No upcoming tasks right now.
              </p>
              <button
                style={{
                  ...styles.secondary,
                  marginTop: "16px",
                  background: colors.cardAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onClick={() => setPage("planner")}
              >
                Open Planner
              </button>
            </>
          )}
        </div>

        {/* FEATURE GRID */}
        <div style={styles.grid}>
          <button
            style={{
              ...styles.featureCard,
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
            onClick={() => setPage("routine")}
          >
            <span style={{ color: colors.accent, marginBottom: "4px" }}>
              <BookIcon width={22} height={22} />
            </span>
            <strong style={{ color: colors.text }}>Today's Routine</strong>
            <small style={{ color: colors.textDim }}>Your timetable</small>
          </button>

          <button
            style={{
              ...styles.featureCard,
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
            onClick={() => setPage("timer")}
          >
            <span style={{ color: colors.accent, marginBottom: "4px" }}>
              <TimerCircleIcon width={22} height={22} />
            </span>
            <strong style={{ color: colors.text }}>Custom & Pomodoro</strong>
            <small style={{ color: colors.textDim }}>Focus timer</small>
          </button>

          <button
            style={{
              ...styles.featureCard,
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
            onClick={() => setPage("planner")}
          >
            <span style={{ color: colors.accent, marginBottom: "4px" }}>
              <CalendarIcon width={22} height={22} />
            </span>
            <strong style={{ color: colors.text }}>Planner</strong>
            <small style={{ color: colors.textDim }}>Plan your days</small>
          </button>

          <button
            style={{
              ...styles.featureCard,
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
            onClick={() => setPage("friends")}
          >
            <span style={{ color: colors.accent, marginBottom: "4px" }}>
              <UsersIcon width={22} height={22} />
            </span>
            <strong style={{ color: colors.text }}>Friends</strong>
            <small style={{ color: colors.textDim }}>Study together</small>
          </button>
        </div>

        {message && (
          <p style={{ ...styles.dashboardMessage, color: colors.accent }}>{message}</p>
        )}

        {/* PROFILE */}
        <div
          style={{
            ...styles.welcomeCard,
            position: "relative",
            background: colors.card,
            border: `1px solid ${colors.border}`,
          }}
        >
          {/* MANNI MODE ONLY: twinkling star in the corner. */}
          {isManni && <ManniCornerDecor kind="star" corner="top-right" color={colors.accent} />}

          <p style={{ ...styles.cardLabel, color: colors.textDim }}>PROFILE</p>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "8px" }}>
            <AvatarDisplay
              avatarUrl={profile?.avatar_url}
              name={profile?.display_name}
              size={56}
              background={colors.accentDim}
              color={colors.accent}
              border={`1px solid ${colors.border}`}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ ...styles.profileName, color: colors.text, margin: "0 0 2px" }}>{profile?.display_name}</p>
              <p style={{ ...styles.username, color: colors.accent, margin: "0 0 2px" }}>@{profile?.username}</p>
              <p
                style={{
                  ...styles.cardText,
                  marginBottom: 0,
                  color: colors.textDim,
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
