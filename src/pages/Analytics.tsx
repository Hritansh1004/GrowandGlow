import { AppStyles } from "../hooks/useStyles";
import useAnalytics from "../hooks/useAnalytics";
import StudyHeatmap from "../components/StudyHeatmap";
import { ArrowLeftIcon, FlameIcon, BarChartIcon } from "../components/Icons";

function formatMinutes(mins: number) {
  const safe = Math.max(0, Math.round(mins));
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

interface AnalyticsProps {
  user: any;
  setPage: (page: string) => void;
  styles: AppStyles;
}

export default function Analytics({ user, setPage, styles }: AnalyticsProps) {
  const {
    loading,
    message,
    heatmapDays,
    weeklyChart,
    categoryBreakdown,
    summary,
  } = useAnalytics(user?.id);

  return (
    <div style={styles.page}>
      <main style={styles.dashboard}>
        {/* BACK TO HISTORY */}
        <button
          type="button"
          style={{ ...styles.backButton, display: "inline-flex", alignItems: "center", gap: "8px" }}
          onClick={() => setPage("history")}
        >
          <ArrowLeftIcon />
          Back to History
        </button>

        {/* HEADER */}
        <div style={styles.timerHeader}>
          <p style={styles.eyebrow}>STUDY ANALYTICS</p>
          <h1 style={styles.routineTitle}>Performance & Insights</h1>
          <p style={styles.cardText}>
            Track your focus habits, subjects, streaks, and long-term consistency.
          </p>
        </div>

        {message && <p style={styles.message}>{message}</p>}

        {/* STATS OVERVIEW CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div style={styles.timerCard}>
            <p style={styles.cardLabel}>TOTAL FOCUS TIME</p>
            <h2 style={{ margin: "4px 0 0", fontSize: "22px", color: "#58d8c4" }}>
              {formatMinutes(summary?.totalFocusMinutes || 0)}
            </h2>
          </div>

          <div style={styles.timerCard}>
            <p style={styles.cardLabel}>CURRENT STREAK</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <FlameIcon width={20} height={20} color="#58d8c4" />
              <h2 style={{ margin: 0, fontSize: "22px" }}>
                {summary?.currentStreak || 0} <span style={{ fontSize: "13px", color: "#829096" }}>days</span>
              </h2>
            </div>
          </div>

          <div style={styles.timerCard}>
            <p style={styles.cardLabel}>AVG SESSION RATING</p>
            <h2 style={{ margin: "4px 0 0", fontSize: "22px" }}>
              {summary?.averageRating ? `${summary.averageRating} / 10` : "N/A"}
            </h2>
          </div>

          <div style={styles.timerCard}>
            <p style={styles.cardLabel}>LONGEST STREAK</p>
            <h2 style={{ margin: "4px 0 0", fontSize: "22px" }}>
              {summary?.longestStreak || 0} <span style={{ fontSize: "13px", color: "#829096" }}>days</span>
            </h2>
          </div>
        </div>

        {/* YEARLY ACTIVITY HEATMAP */}
        <section style={{ ...styles.timerCard, marginBottom: "20px" }}>
          <p style={{ ...styles.cardLabel, marginBottom: "12px" }}>STUDY HEATMAP</p>
          <StudyHeatmap days={heatmapDays} styles={styles} />
        </section>

        {/* WEEKLY FOCUS TREND */}
        {weeklyChart.length > 0 && (
          <section style={{ ...styles.timerCard, marginBottom: "20px" }}>
            <p style={{ ...styles.cardLabel, marginBottom: "12px" }}>WEEKLY FOCUS HOURS</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "120px", padding: "10px 0" }}>
              {weeklyChart.map((week, idx) => {
                const maxMins = Math.max(...weeklyChart.map((w) => w.totalMinutes), 60);
                const heightPct = Math.max(8, Math.round((week.totalMinutes / maxMins) * 100));

                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      height: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "28px",
                        height: `${heightPct}%`,
                        borderRadius: "6px 6px 0 0",
                        background: week.totalMinutes > 0 ? "linear-gradient(180deg, #58d8c4, #267064)" : "#162225",
                      }}
                      title={`${week.label}: ${formatMinutes(week.totalMinutes)}`}
                    />
                    <span style={{ fontSize: "10px", color: "#829096", marginTop: "6px" }}>
                      {week.label.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SUBJECT / TOPIC BREAKDOWN */}
        <section style={styles.timerCard}>
          <p style={{ ...styles.cardLabel, marginBottom: "12px" }}>SUBJECT BREAKDOWN</p>

          {categoryBreakdown.length === 0 ? (
            <p style={styles.cardText}>No subject data recorded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {categoryBreakdown.map((item, idx) => {
                const totalMins = summary?.totalFocusMinutes || 1;
                const pct = Math.round((item.minutes / totalMins) * 100);

                return (
                  <div key={idx}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700 }}>{item.category}</span>
                      <span style={{ fontSize: "12px", color: "#829096" }}>
                        {formatMinutes(item.minutes)} ({pct}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: "6px",
                        borderRadius: "3px",
                        background: "#162225",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "#58d8c4",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
