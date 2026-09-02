import { useState } from "react";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";

interface RatingModalProps {
  title: string;
  subtitle?: string;
  initialRating?: number;
  onSubmit: (rating: number, note?: string) => Promise<void> | void;
  onSkip?: () => void;
  styles: AppStyles;
}

const RATING_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: "1/10 — Very Distracted", color: "#ff8f8f" },
  2: { text: "2/10 — Rough Session", color: "#ff8f8f" },
  3: { text: "3/10 — Low Focus", color: "#f0a85d" },
  4: { text: "4/10 — Below Average", color: "#f0a85d" },
  5: { text: "5/10 — Average Focus", color: "#f0c665" },
  6: { text: "6/10 — Decent Progress", color: "#f0c665" },
  7: { text: "7/10 — Good Focus", color: "#6fe0cd" },
  8: { text: "8/10 — Great Work!", color: "#58d8c4" },
  9: { text: "9/10 — Excellent Flow 🔥", color: "#58d8c4" },
  10: { text: "10/10 — Peak Mastery! 🏆", color: "#58d8c4" },
};

export default function RatingModal({
  title,
  subtitle,
  initialRating = 8,
  onSubmit,
  onSkip,
  styles,
}: RatingModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const [rating, setRating] = useState<number>(initialRating || 8);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeRating = hoverRating || rating;

  async function handleSubmit() {
    setSubmitting(true);
    await onSubmit(rating, note);
    setSubmitting(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4, 7, 8, 0.72)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 300,
        backdropFilter: "blur(4px)",
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
          padding: "28px 22px calc(30px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          textAlign: "center",
          color: colors.text,
          boxShadow: "0 -10px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            margin: "0 auto 16px",
            borderRadius: "16px",
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

        <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 800, color: colors.text }}>
          {title}
        </h2>

        {subtitle && (
          <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 16px" }}>
            {subtitle}
          </p>
        )}

        {/* 1 - 10 SCORE SELECTOR BUTTONS */}
        <div style={{ marginBottom: "8px" }}>
          <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "8px" }}>
            RATE PERFORMANCE (1 TO 10)
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

          {/* ACTIVE SCORE LABEL */}
          {activeRating > 0 && RATING_LABELS[activeRating] && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: RATING_LABELS[activeRating].color,
                marginBottom: "16px",
                padding: "6px 12px",
                borderRadius: "999px",
                background: colors.cardAlt,
                display: "inline-block",
              }}
            >
              {RATING_LABELS[activeRating].text}
            </div>
          )}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a reflection note or task takeaway (optional)..."
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

        <button
          type="button"
          style={{
            ...styles.primary,
            background: colors.accent,
            color: colors.accentText,
            marginBottom: "8px",
          }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Saving..." : `Submit ${rating}/10 Rating`}
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
            disabled={submitting}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

