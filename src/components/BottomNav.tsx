import type { SVGProps } from "react";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import {
  HistoryIcon,
  CalendarIcon,
  TimerCircleIcon,
  BookIcon,
  UsersIcon,
  SparkleIcon,
} from "./Icons";

interface BottomNavProps {
  page: string;
  setPage: (page: string) => void;
  styles: AppStyles;
}

function HomeGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function SettingsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Home", Glyph: HomeGlyph },
  { key: "routine", label: "Routine", Glyph: BookIcon },
  { key: "timer", label: "Timer", Glyph: TimerCircleIcon },
  { key: "planner", label: "Planner", Glyph: CalendarIcon },
  { key: "friends", label: "Benchmates", Glyph: UsersIcon },
  { key: "history", label: "History", Glyph: HistoryIcon },
  { key: "settings", label: "Settings", Glyph: SettingsGlyph },
];

export default function BottomNav({ page, setPage, styles }: BottomNavProps) {
  const { theme } = useTheme();
  const isManni = theme === "manni";
  const isHistoryActive = page === "history" || page === "analytics";

  return (
    <nav style={styles.bottomNav} aria-label="Bottom Navigation">
      {NAV_ITEMS.map((item) => {
        const Glyph = item.Glyph;
        const isActive = item.key === "history" ? isHistoryActive : page === item.key;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setPage(item.key)}
            style={{
              ...styles.bottomNavItem,
              ...(isActive ? styles.bottomNavItemActive : {}),
              // MANNI MODE ONLY: floating pill behind the active tab, plus
              // a tiny lift on the whole button. Light/Dark untouched —
              // this block only ever contributes styles when isManni is
              // true, so position/transform/transition are undefined
              // (i.e. absent) for every other theme, same as before.
              position: "relative",
              transform: isManni && isActive ? "translateY(-2px)" : "none",
              transition: isManni ? "transform 0.25s ease" : undefined,
            }}
          >
            {/* MANNI MODE ONLY: soft glowing pill behind the active icon.
                Purely decorative, absolute-positioned so it never affects
                layout/spacing of the icon+label below it. */}
            {isManni && isActive && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "-2px",
                  width: "38px",
                  height: "38px",
                  borderRadius: "999px",
                  background: "rgba(244, 143, 177, 0.16)",
                  boxShadow: "0 0 14px rgba(244, 143, 177, 0.45)",
                  zIndex: 0,
                }}
              />
            )}

            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Glyph width={18} height={18} />
              {/* MANNI MODE ONLY: tiny sparkle accent on the active tab. */}
              {isManni && isActive && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-8px",
                    color: "#F48FB1",
                  }}
                >
                  <SparkleIcon width={10} height={10} />
                </span>
              )}
            </span>

            <span style={{ position: "relative", zIndex: 1 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}