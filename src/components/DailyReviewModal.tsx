import { useState } from "react";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";

interface DailyReviewModalProps {
  stats: { completedPeriods?: number; totalPeriods?: number };
  totalFocusMinutes?: number;
  onSubmit: (rating: number, notes?: string, extra?: any) => Promise<any> | void;
  onSkip?: () => void;
  saving?: boolean;
  message?: string;
  styles: AppStyles;
}

const RATING_DESCRIPTIONS: Record<number, { label: string; color: string }> = {
  1: { label: "1/10 — Very Difficult Day", color: "#ff8f8f" },
  2: { label: "2/10 — Low Motivation", color: "#ff8f8f" },
  3: { label: "3/10 — Disorganized", color: "#f0a85d" },
  4: { label: "4/10 — Below Expectations", color: "#f0a85d" },
  5: { label: "5/10 — Average Day", color: "#f0c665" },
  6: { label: "6/10 — Steady Progress", color: "#f0c665" },
  7: { label: "7/10 — Good Day!", color: "#6fe0cd" },
  8: { label: "8/10 — Highly Productive", color: "#58d8c4" },
  9: { label: "9/10 — Superb Focus & Flow", color: "#58d8c4" },
  10: { label: "10/10 — Flawless Execution!", color: "#58d8c4" },
};

export default function DailyReviewModal({
  stats,
  totalFocusMinutes = 0,
  onSubmit,
  onSkip,
  saving,
  message,
  styles,
}: DailyReviewModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const [rating, setRating] = useState<number>(8);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const activeRating = hoverRating || rating;

  function formatMinutes(mins: number) {
    const safe = Math.max(0, Math.round(mins));
    const hours = Math.floor(safe / 60);
    const remaining = safe % 60;
    if (hours === 0) return `${remaining}m`;
    if (remaining === 0) return `${hours}h`;
    return `${hours}h ${remaining}m`;
  }

  async function handleSubmit() {
    await onSubmit(rating, notes, { totalFocusMinutes });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4, 7, 8, 0.78)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 350,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: colors.card,
          borderTop: `1px solid ${colors.border}`,
          borderTopLeftRadius: "28px",
          borderTopRightRadius: "28px",
          padding: "30px 22px calc(32px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          textAlign: "center",
          color: colors.text,
          boxShadow: "0 -10px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            margin: "0 auto 16px",
            borderRadius: "18px",
            background: `linear-gradient(135deg, ${colors.accent}, #319bd8)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.accentText,
            fontSize: "22px",
            fontWeight: 900,
          }}
        >
          {rating > 0 ? rating : "★"}
        </div>

        <p style={{ ...styles.eyebrow, textAlign: "center", color: colors.accent }}>
          DAY WRAP-UP & RATING
        </p>
        <h2 style={{ margin: "4px 0 16px", fontSize: "22px", fontWeight: 800, color: colors.text }}>
          How did your day go?
        </h2>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            marginBottom: "20px",
            padding: "12px",
            borderRadius: "14px",
            background: colors.cardAlt,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div>
            <p style={{ margin: "0 0 2px", fontSize: "18px", fontWeight: 800, color: colors.text }}>
              {stats?.completedPeriods ?? 0}/{stats?.totalPeriods ?? 0}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: colors.textDim, fontWeight: 700 }}>
              PERIODS COMPLETED
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: "18px", fontWeight: 800, color: colors.accent }}>
              {formatMinutes(totalFocusMinutes)}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: colors.textDim, fontWeight: 700 }}>
              TOTAL FOCUS TIME
            </p>
          </div>
        </div>

        {/* 1 - 10 SCORE SELECTOR BUTTONS */}
        <div style={{ marginBottom: "12px" }}>
          <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "8px" }}>
            RATE YOUR OVERALL DAY (1 TO 10)
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
              const isSelected = rating === value;
              const isHovered = hoverRating === value;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    padding: "10px 0",
                    borderRadius: "12px",
                    border: isSelected
                      ? `2px solid ${colors.accent}`
                      : isHovered
                      ? `1px solid ${colors.accentSoft}`
                      : `1px solid ${colors.border}`,
                    background: isSelected
                      ? colors.accent
                      : isHovered
                      ? colors.accentDim
                      : colors.cardAlt,
                    color: isSelected ? colors.accentText : colors.text,
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>

          {activeRating > 0 && RATING_DESCRIPTIONS[activeRating] && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: RATING_DESCRIPTIONS[activeRating].color,
                marginBottom: "14px",
                padding: "6px 12px",
                borderRadius: "999px",
                background: colors.cardAlt,
                display: "inline-block",
              }}
            >
              {RATING_DESCRIPTIONS[activeRating].label}
            </div>
          )}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a summary note about today's accomplishments..."
          rows={2}
          style={{
            width: "100%",
            padding: "12px 14px",
            marginBottom: "16px",
            borderRadius: "14px",
            border: `1px solid ${colors.border}`,
            background: colors.cardAlt,
            color: colors.text,
            fontSize: "13px",
            fontFamily: "inherit",
            resize: "none",
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        {message && (
          <p
            style={{
              margin: "0 0 14px",
              fontSize: "13px",
              fontWeight: 700,
              color: colors.danger,
            }}
          >
            {message}
          </p>
        )}

        <button
          type="button"
          style={{
            ...styles.primary,
            background: colors.accent,
            color: colors.accentText,
            marginBottom: "8px",
          }}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? "Saving..." : `Save ${rating}/10 Day Rating`}
        </button>

        {onSkip && (
          <button
            type="button"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "14px",
              border: "none",
              background: "transparent",
              color: colors.textDim,
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={onSkip}
            disabled={saving}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
