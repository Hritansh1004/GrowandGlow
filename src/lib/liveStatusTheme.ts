import { getThemeColors, getColorGradient } from "../styles/theme";
import type { ResolvedTheme } from "../context/ThemeContext";
import type { LiveStatusTheme } from "../services/liveStatusPlugin";

// Maps the app's own theme system onto the native notification card.
// Deliberately pulls only from fields that are guaranteed solid hex in all
// three modes (bg, text, textDim, accentText) — some theme fields (card,
// cardAlt) are semi-transparent rgba() strings meant for layered CSS
// backgrounds, which Android's native color parser can't read.
export function buildLiveStatusTheme(mode: ResolvedTheme, itemColorHex?: string | null): LiveStatusTheme {
  const colors = getThemeColors(mode);
  const accent = getColorGradient(itemColorHex, mode).solid;

  return {
    cardBgColor: colors.bg,
    accentColor: accent,
    titleColor: colors.text,
    subtitleColor: colors.textDim,
    onAccentColor: colors.accentText,
  };
}
