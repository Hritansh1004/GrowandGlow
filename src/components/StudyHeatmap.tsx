import { useMemo, useState } from "react";
import { AppStyles } from "../hooks/useStyles";

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function getIntensityLevel(minutes: number) {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

const LEVEL_COLORS = [
  "#161f21", // 0 — no activity
  "#123430", // 1
  "#175f52", // 2
  "#20a08a", // 3
  "#58d8c4", // 4
];

function formatMinutesLabel(minutes: number) {
  if (minutes <= 0) return "No activity";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}m focused`;
  if (remaining === 0) return `${hours}h focused`;
  return `${hours}h ${remaining}m focused`;
}

function formatDateLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function StudyHeatmap({ days = [], styles }: { days?: any[]; styles: AppStyles }) {
  const [hoveredDay, setHoveredDay] = useState<any>(null);

  const weeks = useMemo(() => {
    if (days.length === 0) return [];

    const columns: (any[] | null)[] = [];
    let currentColumn: any[] = [];

    const firstDate = new Date(`${days[0].date}T00:00:00`);
    const firstJsDay = firstDate.getDay();
    const paddingCount = firstJsDay === 0 ? 6 : firstJsDay - 1;

    for (let i = 0; i < paddingCount; i++) {
      currentColumn.push(null);
    }

    days.forEach((day) => {
      currentColumn.push(day);
      if (currentColumn.length === 7) {
        columns.push(currentColumn);
        currentColumn = [];
      }
    });

    if (currentColumn.length > 0) {
      while (currentColumn.length < 7) {
        currentColumn.push(null);
      }
      columns.push(currentColumn);
    }

    return columns;
  }, [days]);

  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    let lastMonth: number | null = null;

    weeks.forEach((week) => {
      if (!week) return;
      const firstRealDay = week.find((d) => d !== null);
      if (!firstRealDay) {
        labels.push("");
        return;
      }

      const month = new Date(`${firstRealDay.date}T00:00:00`).getMonth();
      if (month !== lastMonth) {
        labels.push(
          new Date(`${firstRealDay.date}T00:00:00`).toLocaleDateString(undefined, {
            month: "short",
          })
        );
        lastMonth = month;
      } else {
        labels.push("");
      }
    });

    return labels;
  }, [weeks]);

  if (days.length === 0) {
    return (
      <div style={styles.timerInfoCard}>
        <p style={styles.cardText}>No activity data yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "3px", overflowX: "auto", paddingBottom: "6px" }}>
        {/* DAY-OF-WEEK LABELS */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            marginRight: "4px",
            flexShrink: 0,
            paddingTop: "16px",
          }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                width: "20px",
                height: "12px",
                fontSize: "9px",
                color: "#7b878b",
                fontWeight: 700,
                lineHeight: "12px",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* WEEK COLUMNS */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} style={{ display: "flex", flexDirection: "column", gap: "3px", flexShrink: 0 }}>
            <div
              style={{
                height: "13px",
                fontSize: "9px",
                color: "#7b878b",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {monthLabels[weekIndex]}
            </div>

            {week?.map((day, dayIndex) => {
              if (!day) {
                return <div key={dayIndex} style={{ width: "12px", height: "12px" }} />;
              }

              const level = getIntensityLevel(day.minutes);

              return (
                <div
                  key={dayIndex}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => setHoveredDay(day)}
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background: LEVEL_COLORS[level],
                    cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.03)",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* TOOLTIP / SELECTED DAY */}
      <div
        style={{
          marginTop: "12px",
          padding: "10px 14px",
          borderRadius: "12px",
          background: "#0d1416",
          border: "1px solid #202c30",
          fontSize: "12px",
          color: hoveredDay ? "#e8edef" : "#7b878b",
        }}
      >
        {hoveredDay
          ? `${formatDateLabel(hoveredDay.date)} · ${formatMinutesLabel(hoveredDay.minutes)}`
          : "Tap a square to see details"}
      </div>

      {/* LEGEND */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "12px" }}>
        <span style={{ fontSize: "10px", color: "#7b878b" }}>Less</span>
        {LEVEL_COLORS.map((color, i) => (
          <div
            key={i}
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "3px",
              background: color,
            }}
          />
        ))}
        <span style={{ fontSize: "10px", color: "#7b878b" }}>More</span>
      </div>
    </div>
  );
}
