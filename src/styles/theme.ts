export interface ThemeColors {
  bg: string;
  bgAlt: string;
  card: string;
  cardAlt: string;
  cardHover: string;
  border: string;
  borderAlt: string;
  accent: string;
  accentSoft: string;
  accentDim: string;
  accentText: string;
  text: string;
  textDim: string;
  textFaint: string;
  danger: string;
  warning: string;
}

export const darkColors: ThemeColors = {
  bg: "#080d0f",
  bgAlt: "#0e1518",
  card: "#121b1e",
  cardAlt: "#172327",
  cardHover: "#1c2d32",
  border: "#253439",
  borderAlt: "#314349",
  accent: "#58d8c4",
  accentSoft: "#6fe0cd",
  accentDim: "rgba(88, 216, 196, 0.12)",
  accentText: "#071012",
  text: "#f5f7f8",
  textDim: "#a1b1b6",
  textFaint: "#74868c",
  danger: "#ff8f8f",
  warning: "#f0c665",
};

export const lightColors: ThemeColors = {
  bg: "#f4f7f8",
  bgAlt: "#ffffff",
  card: "#ffffff",
  cardAlt: "#edf2f3",
  cardHover: "#e2ebed",
  border: "#d5dfdf",
  borderAlt: "#becbcb",
  accent: "#188a75",
  accentSoft: "#127362",
  accentDim: "rgba(24, 138, 117, 0.10)",
  accentText: "#ffffff",
  text: "#0c1517",
  textDim: "#4f6368",
  textFaint: "#6e8388",
  danger: "#c83b35",
  warning: "#a8720a",
};

export const radius = {
  sm: "10px",
  md: "16px",
  lg: "22px",
  xl: "26px",
  pill: "999px",
};

export const font = {
  family: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export function getThemeColors(mode: "dark" | "light"): ThemeColors {
  return mode === "light" ? lightColors : darkColors;
}

/* =========================================================
   COLOR-CODED "ACTIVE / RUNNING NOW" TREATMENT

   Shared helper so every "this is happening right now" card in the app
   (Routine's CURRENT SESSION, Dashboard's RIGHT NOW, StudyRoom's HAPPENING
   NOW / Live session, Timer's circular progress ring) can reflect the
   specific item's own chosen color instead of always defaulting to the
   app's fixed teal accent — written once here so the "how do we turn a
   hex into a tasteful active-state background" logic is tuned exactly
   once, not reinvented slightly differently at every call site.

   Falls back cleanly to the existing teal/accent look when the item has
   no custom color (hex is null/undefined), so nothing changes visually
   for any item that was never given a color.
========================================================= */

function hexToRgba(hex: string, alpha: number): string {
  let clean = (hex || "").trim().replace("#", "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const bigint = parseInt(clean, 16);
  if (clean.length !== 6 || Number.isNaN(bigint)) {
    // Fall back to the dark-theme accent teal if given something unusable.
    return `rgba(88, 216, 196, ${alpha})`;
  }
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface ColorTreatment {
  /** Ready-to-use CSS gradient for a card background. */
  background: string;
  /** Solid hex/color for a 1px card border. */
  border: string;
  /** The resolved solid color itself (item's color, or the theme accent if none set) — use for ring strokes, dots, icons, etc. */
  solid: string;
  /** A translucent rgba version of the resolved color, for box-shadow glows. Compose with your own blur/spread, e.g. `0 15px 45px ${shadowColor}`. */
  shadowColor: string;
}

export function getColorGradient(
  hex: string | null | undefined,
  mode: "dark" | "light",
  angle: number = 150
): ColorTreatment {
  const colors = getThemeColors(mode);
  const resolvedHex = hex && hex.trim() ? hex.trim() : colors.accent;
  const glowAlpha = mode === "light" ? 0.1 : 0.16;
  const shadowAlpha = mode === "light" ? 0.06 : 0.1;

  return {
    background: `linear-gradient(${angle}deg, ${hexToRgba(resolvedHex, glowAlpha)} 0%, ${colors.card} 65%)`,
    border: resolvedHex,
    solid: resolvedHex,
    shadowColor: hexToRgba(resolvedHex, shadowAlpha),
  };
}

export const theme = { colors: darkColors, radius, font };
export default theme;
