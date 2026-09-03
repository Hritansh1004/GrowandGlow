import type { CSSProperties } from "react";
import { CalendarIcon, TimerCircleIcon, UsersIcon } from "../components/Icons";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";
import { ManniAmbientBackground, ManniCornerDecor } from "../components/ManniEffects";

interface HomeProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

// Local-only helper (theme.ts keeps its own copy private) — turns a
// theme token's hex into an rgba() string so blobs/glows/pills can be
// derived straight from the app's real palette instead of hardcoded hex.
function hexToRgba(hex: string, alpha: number): string {
  let clean = (hex || "").trim().replace("#", "");
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  const bigint = parseInt(clean, 16);
  if (clean.length !== 6 || Number.isNaN(bigint)) return `rgba(88, 216, 196, ${alpha})`;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const THEME_OPTIONS: { id: "dark" | "light" | "manni"; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "manni", label: "Manni" },
];

export default function Home({ onGetStarted, onLogin }: HomeProps) {
  const { theme, setThemePreference } = useTheme();
  const colors = getThemeColors(theme);
  const isManni = theme === "manni";
  const isLight = theme === "light";
  const logoSrc = theme === "dark" ? "/Logo.png" : "/Logo1.png";

  // Aurora blob opacity: rich on dark, much softer on light so it stays
  // a wash instead of muddying a white page. Manni skips these entirely
  // and uses its own spec'd ambient hearts/sparkles instead (see below) —
  // same rule Dashboard follows for isManni-gated visuals.
  const blobAlpha = isLight ? [0.14, 0.09, 0.09] : [0.3, 0.2, 0.16];

  // Same gradient formula for every theme — accent → accentSoft → warning
  // → accent — just resolved against each theme's own tokens, so dark
  // keeps its teal/amber shimmer, light gets teal/bronze, Manni gets a
  // blush/peach one.
  const gradientText = `linear-gradient(90deg, ${colors.accent} 0%, ${colors.accentSoft} 35%, ${colors.warning} 60%, ${colors.accent} 100%)`;

  return (
    <div
      style={
        {
          position: "relative",
          minHeight: "100vh",
          overflow: "hidden",
          background: isManni && colors.bgGradient ? colors.bgGradient : colors.bg,
          color: colors.text,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "32px 24px",
          boxSizing: "border-box",
          fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          "--gg-gradient": gradientText,
        } as CSSProperties
      }
    >
      <style>{`
        @keyframes gg-drift-a {
          0%   { transform: translate(-8%, -6%) scale(1); }
          50%  { transform: translate(6%, 4%) scale(1.15); }
          100% { transform: translate(-8%, -6%) scale(1); }
        }
        @keyframes gg-drift-b {
          0%   { transform: translate(6%, 4%) scale(1.05); }
          50%  { transform: translate(-10%, -2%) scale(0.95); }
          100% { transform: translate(6%, 4%) scale(1.05); }
        }
        @keyframes gg-drift-c {
          0%   { transform: translate(0%, 8%) scale(1); }
          50%  { transform: translate(4%, -8%) scale(1.1); }
          100% { transform: translate(0%, 8%) scale(1); }
        }
        @keyframes gg-rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gg-word-rise {
          from { opacity: 0; transform: translateY(0.4em); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gg-shine {
          0%   { background-position: 0% center; }
          50%  { background-position: 100% center; }
          100% { background-position: 0% center; }
        }
        .gg-word {
          display: inline-block;
          opacity: 0;
          animation: gg-word-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: var(--enter-delay, 0s);
        }
        .gg-gradient-text {
          background-image: var(--gg-gradient);
          background-size: 220% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        /* Words that both enter AND shine need both animations running
           together — longhand props so neither class clobbers the other. */
        .gg-word.gg-gradient-text {
          animation-name: gg-word-rise, gg-shine;
          animation-duration: 0.6s, 7s;
          animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1), ease-in-out;
          animation-delay: var(--enter-delay, 0s), 0s;
          animation-iteration-count: 1, infinite;
          animation-fill-mode: forwards, none;
        }
        .gg-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          pointer-events: none;
          will-change: transform;
        }
        .gg-enter {
          opacity: 0;
          animation: gg-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .gg-cta-primary {
          transition: transform 0.2s ease, box-shadow 0.25s ease, filter 0.25s ease;
        }
        .gg-cta-primary:hover {
          transform: translateY(-2px);
          filter: brightness(1.04);
        }
        .gg-cta-primary:active {
          transform: translateY(0px) scale(0.98);
        }
        .gg-cta-secondary {
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .gg-blob { animation: none !important; }
          .gg-enter, .gg-word, .gg-word.gg-gradient-text {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            background-position: 0% center !important;
          }
          .gg-cta-primary, .gg-cta-secondary { transition: none !important; }
        }
      `}</style>

      {/* Theme switcher — explicit choice between the app's three modes.
          Kept top-right and small so it doesn't compete with the hero. */}
      <div
        className="gg-enter"
        role="group"
        aria-label="Choose theme"
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          zIndex: 2,
          display: "inline-flex",
          gap: "2px",
          padding: "3px",
          borderRadius: "999px",
          background: hexToRgba(colors.accent, isLight ? 0.05 : 0.07),
          border: `1px solid ${colors.border}`,
          animationDelay: "0.3s",
        }}
      >
        {THEME_OPTIONS.map((opt) => {
          const active = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setThemePreference(opt.id)}
              aria-pressed={active}
              style={{
                padding: "6px 12px",
                borderRadius: "999px",
                border: "none",
                background: active ? colors.accent : "transparent",
                color: active ? colors.accentText : colors.textDim,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.2px",
                cursor: "pointer",
                transition: "background 0.2s ease, color 0.2s ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {isManni ? (
        // Manni Mode: use the app's own spec'd ambient layer (floating
        // hearts/sparkles/stars) instead of the aurora blobs below —
        // same pattern Dashboard follows for isManni-gated visuals.
        <ManniAmbientBackground />
      ) : (
        <>
          {/* Ambient aurora field — the one animated flourish on this page */}
          <div
            className="gg-blob"
            style={{
              width: "60vmax",
              height: "60vmax",
              left: "-20vmax",
              top: "-24vmax",
              background: `radial-gradient(circle, ${hexToRgba(colors.accent, blobAlpha[0])} 0%, ${hexToRgba(colors.accent, 0)} 70%)`,
              animation: "gg-drift-a 22s ease-in-out infinite",
            }}
          />
          <div
            className="gg-blob"
            style={{
              width: "50vmax",
              height: "50vmax",
              right: "-18vmax",
              top: "-10vmax",
              background: `radial-gradient(circle, ${hexToRgba(colors.warning, blobAlpha[1])} 0%, ${hexToRgba(colors.warning, 0)} 70%)`,
              animation: "gg-drift-b 26s ease-in-out infinite",
            }}
          />
          <div
            className="gg-blob"
            style={{
              width: "55vmax",
              height: "55vmax",
              left: "10vmax",
              bottom: "-30vmax",
              background: `radial-gradient(circle, ${hexToRgba(colors.accentSoft, blobAlpha[2])} 0%, ${hexToRgba(colors.accentSoft, 0)} 70%)`,
              animation: "gg-drift-c 30s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 20% 0%, transparent 0%, ${colors.bg} 65%)`,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      <main style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "440px" }}>
        <div
          className="gg-enter"
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 14px 8px 8px",
            borderRadius: "999px",
            background: hexToRgba(colors.accent, isLight ? 0.06 : 0.08),
            border: `1px solid ${hexToRgba(colors.accent, isLight ? 0.22 : 0.18)}`,
            marginBottom: "36px",
          }}
        >
          {isManni && <ManniCornerDecor kind="sparkle" corner="top-right" color={colors.accent} size={14} />}
          <img
            src={logoSrc}
            alt="Grow & Glow logo"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "9px",
              objectFit: "contain",
            }}
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

        <h1
          style={{
            fontSize: "clamp(38px, 9vw, 56px)",
            lineHeight: "1.04",
            letterSpacing: "-2.2px",
            margin: "0 0 18px",
            fontWeight: 700,
          }}
        >
          {["Your", "study", "desk,"].map((word, i) => (
            <span
              key={word}
              className="gg-word"
              style={{ marginRight: "0.28em", "--enter-delay": `${0.08 + i * 0.06}s` } as CSSProperties}
            >
              {word}
            </span>
          ))}
          <br />
          {["built", "for", "focus."].map((word, i) => (
            <span
              key={word}
              className="gg-word gg-gradient-text"
              style={{ marginRight: "0.28em", "--enter-delay": `${0.3 + i * 0.06}s` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </h1>

        <p
          className="gg-enter"
          style={{
            color: colors.textDim,
            lineHeight: "1.65",
            fontSize: "16px",
            maxWidth: "380px",
            margin: "0 0 36px",
            animationDelay: "0.12s",
          }}
        >
          A custom timetable, an accurate Pomodoro focus timer, real study history — and a room to study alongside friends, live.
        </p>

        <div
          className="gg-enter"
          style={{ display: "flex", flexDirection: "column", gap: "12px", animationDelay: "0.18s" }}
        >
          <button
            type="button"
            onClick={onGetStarted}
            className="gg-cta-primary"
            style={{
              width: "100%",
              padding: "18px",
              borderRadius: "16px",
              border: "none",
              background: colors.accent,
              color: colors.accentText,
              fontSize: "16px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: `0 12px 30px ${hexToRgba(colors.accent, isLight ? 0.14 : 0.18)}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 16px 38px ${hexToRgba(colors.accent, isLight ? 0.24 : 0.32)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 12px 30px ${hexToRgba(colors.accent, isLight ? 0.14 : 0.18)}`;
            }}
          >
            Get Started
          </button>

          <button
            type="button"
            onClick={onLogin}
            className="gg-cta-secondary"
            style={{
              width: "100%",
              padding: "18px",
              borderRadius: "16px",
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.text,
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.borderAlt;
              e.currentTarget.style.background = hexToRgba(colors.accent, 0.05);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.background = "transparent";
            }}
          >
            I already have an account
          </button>
        </div>

        <div
          className="gg-enter"
          style={{
            display: "flex",
            gap: "22px",
            marginTop: "44px",
            flexWrap: "wrap",
            animationDelay: "0.24s",
          }}
        >
          {[
            { Icon: CalendarIcon, label: "Custom timetable" },
            { Icon: TimerCircleIcon, label: "Focus & Pomodoro" },
            { Icon: UsersIcon, label: "Study together" },
          ].map(({ Icon, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12.5px",
                color: colors.textDim,
                fontWeight: 600,
              }}
            >
              <Icon width={15} height={15} />
              {label}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
