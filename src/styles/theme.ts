// src/styles/theme.ts
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
  // Optional — only populated by Manni Mode today. Light/Dark deliberately
  // leave these undefined; do not rely on them outside Manni-specific code.
  textSecondary?: string;
  bgGradient?: string;
  borderGlow?: string;
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

/* =========================================================
   MANNI MODE — premium feminine pastel theme (Phase 1)

   Every value below the "--- from spec ---" line is exactly what was
   requested. Everything above fills interface fields the spec didn't
   name (bgAlt, cardHover, borderAlt, accentSoft, textFaint) with
   shades mixed from the same rose/blush family so they sit naturally
   alongside the spec'd tokens instead of looking bolted-on.
========================================================= */
export const manniColors: ThemeColors = {
  // --- filled to satisfy ThemeColors, not in original spec list ---
  bgAlt: "#FFE4E9",
  cardHover: "rgba(255, 228, 233, 0.95)",
  borderAlt: "#F6C6D9",
  accentSoft: "#EC6A97",
  textFaint: "#D2AFC0",

  // --- from spec ---
  bg: "#FFF0F5",
  bgGradient: "linear-gradient(180deg, #FFF0F5 0%, #FFE4E9 50%, #F8E1EE 100%)",
  card: "rgba(255, 255, 255, 0.85)",
  cardAlt: "rgba(255, 240, 245, 0.95)",
  border: "#FAD2E1",
  borderGlow: "rgba(244, 180, 199, 0.45)",
  text: "#5A3846",
  textSecondary: "#966B7E",
  textDim: "#BA94A5",
  accent: "#F48FB1",
  accentDim: "rgba(244, 143, 177, 0.18)",
  accentText: "#FFFFFF",
  warning: "#F6B26B",
  danger: "#FF6B8B",
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

export type ThemeMode = "dark" | "light" | "manni";

export function getThemeColors(mode: ThemeMode): ThemeColors {
  if (mode === "manni") return manniColors;
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

// Linear RGB interpolation between two hex colors. Used only by Manni
// Mode to "pastel-ify" a user's chosen item color — e.g. someone's
// saturated red timer block gets pulled softly toward the rose/blush
// family so it feels native to the theme instead of clashing with it,
// while still remaining visibly "that item's own color" rather than a
// generic pink for everything.
function mixHex(hexA: string, hexB: string, weight: number): string {
  const parse = (hex: string) => {
    let clean = (hex || "").trim().replace("#", "");
    if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
    const bigint = parseInt(clean, 16);
    if (clean.length !== 6 || Number.isNaN(bigint)) return { r: 244, g: 143, b: 177 }; // accent fallback
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  };
  const a = parse(hexA);
  const b = parse(hexB);
  const r = Math.round(a.r + (b.r - a.r) * weight);
  const g = Math.round(a.g + (b.g - a.g) * weight);
  const bl = Math.round(a.b + (b.b - a.b) * weight);
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
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
  mode: ThemeMode,
  angle: number = 150
): ColorTreatment {
  const colors = getThemeColors(mode);
  const resolvedHex = hex && hex.trim() ? hex.trim() : colors.accent;

  // ---- Light & Dark: untouched, byte-identical to the original logic ----
  if (mode !== "manni") {
    const glowAlpha = mode === "light" ? 0.1 : 0.16;
    const shadowAlpha = mode === "light" ? 0.06 : 0.1;
    return {
      background: `linear-gradient(${angle}deg, ${hexToRgba(resolvedHex, glowAlpha)} 0%, ${colors.card} 65%)`,
      border: resolvedHex,
      solid: resolvedHex,
      shadowColor: hexToRgba(resolvedHex, shadowAlpha),
    };
  }

  // ---- Manni Mode: soft pastel pink/rose treatment ----
  // Pull any item color 30% toward baby pink so custom colors still read
  // as "that item's color" while staying inside the dreamy pastel palette,
  // per spec: "Avoid: Neon pink, Hot pink, Oversaturated colors... Everything
  // should feel soft."
  const pastelHex = mixHex(resolvedHex, "#F8C8DC", 0.3);

  return {
    background: `linear-gradient(${angle}deg, ${hexToRgba(pastelHex, 0.32)} 0%, ${hexToRgba("#FFFFFF", 0.55)} 55%, ${colors.cardAlt} 100%)`,
    border: hexToRgba(pastelHex, 0.55),
    // Solid stays true to the resolved (non-pastel) hex so rings/dots/icons
    // remain recognizably "this item's color" against the soft background.
    solid: resolvedHex,
    shadowColor: hexToRgba(pastelHex, 0.28),
  };
}

export const theme = { colors: darkColors, radius, font };
export default theme;