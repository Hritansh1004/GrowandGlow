import { CSSProperties, useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors, radius, font } from "../styles/theme";

export interface AppStyles {
  page: CSSProperties;
  dashboard: CSSProperties;
  authCard: CSSProperties;
  logo: CSSProperties;
  eyebrow: CSSProperties;
  authTitle: CSSProperties;
  routineTitle: CSSProperties;
  dashboardTitle: CSSProperties;
  cardText: CSSProperties;
  cardLabel: CSSProperties;
  label: CSSProperties;
  helper: CSSProperties;
  input: CSSProperties;
  primary: CSSProperties;
  secondary: CSSProperties;
  backButton: CSSProperties;
  message: CSSProperties;
  topBar: CSSProperties;
  logoutButton: CSSProperties;
  clockCard: CSSProperties;
  clock: CSSProperties;
  statusCard: CSSProperties;
  statusTitle: CSSProperties;
  statusDot: CSSProperties;
  activeStatusDot: CSSProperties;
  grid: CSSProperties;
  featureCard: CSSProperties;
  icon: CSSProperties;
  dashboardMessage: CSSProperties;
  welcomeCard: CSSProperties;
  profileName: CSSProperties;
  username: CSSProperties;
  timerHeader: CSSProperties;
  timerCard: CSSProperties;
  timerInfoCard: CSSProperties;
  timerDisplay: CSSProperties;
  timerStatus: CSSProperties;
  durationGrid: CSSProperties;
  durationButton: CSSProperties;
  selectedDuration: CSSProperties;
  timerActions: CSSProperties;
  tipText: CSSProperties;
  plannerList: CSSProperties;
  plannerTwoColumn: CSSProperties;
  templateLibraryCard: CSSProperties;
  templateLibraryHeader: CSSProperties;
  templateLibraryHeading: CSSProperties;
  templateLibraryTitle: CSSProperties;
  templateLibraryDescription: CSSProperties;
  templateCreateButton: CSSProperties;
  templateCreator: CSSProperties;
  templateCreatorLabel: CSSProperties;
  templateCreatorActions: CSSProperties;
  templateEmpty: CSSProperties;
  templateEmptyIcon: CSSProperties;
  templateEmptyTitle: CSSProperties;
  templateEmptyText: CSSProperties;
  templateEmptyButton: CSSProperties;
  templateList: CSSProperties;
  templateCard: CSSProperties;
  templateCardIcon: CSSProperties;
  templateCardContent: CSSProperties;
  templateCardLabel: CSSProperties;
  templateCardTitle: CSSProperties;
  templateCardMeta: CSSProperties;
  templateMoreButton: CSSProperties;
  bottomNav: CSSProperties;
  bottomNavItem: CSSProperties;
  bottomNavItemActive: CSSProperties;
}

export default function useStyles(): AppStyles {
  const { theme } = useTheme();
  const colors = useMemo(() => getThemeColors(theme), [theme]);

  return useMemo(() => {
    return {
      page: {
        minHeight: "100vh",
        background: colors.bg,
        color: colors.text,
        fontFamily: font.family,
        boxSizing: "border-box",
      },

      dashboard: {
        maxWidth: "560px",
        margin: "0 auto",
        padding: "24px 20px 100px",
        boxSizing: "border-box",
      },

      authCard: {
        maxWidth: "420px",
        margin: "0 auto",
        padding: "48px 24px",
        boxSizing: "border-box",
        textAlign: "center",
      },

      logo: {
        width: "64px",
        height: "64px",
        margin: "0 auto 20px",
        borderRadius: radius.md,
        objectFit: "contain",
      },

      eyebrow: {
        color: colors.accentSoft,
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "2px",
        margin: "0 0 8px",
        textTransform: "uppercase",
      },

      authTitle: {
        fontSize: "32px",
        margin: "0 0 10px",
        letterSpacing: "-1px",
      },

      routineTitle: {
        fontSize: "32px",
        margin: "6px 0 0",
        letterSpacing: "-1px",
      },

      dashboardTitle: {
        fontSize: "26px",
        margin: "6px 0 0",
        letterSpacing: "-0.5px",
      },

      cardText: {
        color: colors.textDim,
        lineHeight: 1.6,
        fontSize: "14px",
        margin: "0 0 20px",
      },

      cardLabel: {
        color: colors.accentSoft,
        fontSize: "10px",
        fontWeight: 800,
        letterSpacing: "1.5px",
        margin: 0,
        textTransform: "uppercase",
      },

      label: {
        display: "block",
        textAlign: "left",
        fontSize: "13px",
        fontWeight: 700,
        marginBottom: "7px",
        marginTop: "12px",
        color: colors.text,
      },

      helper: {
        color: colors.textFaint,
        fontSize: "12px",
        textAlign: "left",
        marginTop: "-8px",
        marginBottom: "16px",
      },

      input: {
        width: "100%",
        padding: "15px 16px",
        marginBottom: "12px",
        borderRadius: radius.sm,
        border: `1px solid ${colors.borderAlt}`,
        background: colors.cardAlt,
        color: colors.text,
        fontSize: "15px",
        boxSizing: "border-box",
        outline: "none",
      },

      primary: {
        width: "100%",
        padding: "16px",
        borderRadius: "15px",
        border: "none",
        background: colors.accent,
        color: colors.accentText,
        fontSize: "15px",
        fontWeight: 800,
        cursor: "pointer",
      },

      secondary: {
        width: "100%",
        padding: "16px",
        marginTop: "10px",
        borderRadius: "15px",
        border: `1px solid ${colors.borderAlt}`,
        background: colors.bgAlt,
        color: colors.text,
        fontSize: "15px",
        fontWeight: 700,
        cursor: "pointer",
      },

      backButton: {
        background: "transparent",
        border: "none",
        color: colors.textDim,
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
        padding: "8px 0",
        marginBottom: "8px",
      },

      message: {
        color: colors.accentSoft,
        fontSize: "13px",
        marginTop: "14px",
        lineHeight: 1.5,
      },

      topBar: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "24px",
        gap: "12px",
      },

      logoutButton: {
        padding: "10px 16px",
        borderRadius: radius.sm,
        border: `1px solid ${colors.borderAlt}`,
        background: colors.bgAlt,
        color: colors.textDim,
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
        flexShrink: 0,
      },

      clockCard: {
        padding: "24px",
        marginBottom: "14px",
        borderRadius: radius.lg,
        background: colors.card,
        border: `1px solid ${colors.border}`,
      },

      clock: {
        fontSize: "56px",
        margin: "8px 0",
        letterSpacing: "-3px",
      },

      statusCard: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 22px",
        marginBottom: "14px",
        borderRadius: radius.lg,
        background: colors.card,
        border: `1px solid ${colors.border}`,
      },

      statusTitle: {
        margin: "6px 0 0",
        fontSize: "19px",
      },

      statusDot: {
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        background: colors.borderAlt,
        flexShrink: 0,
      },

      activeStatusDot: {
        background: colors.accent,
        boxShadow: `0 0 14px ${colors.accent}`,
      },
      grid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "12px",
        marginBottom: "18px",
      },

      featureCard: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "6px",
        padding: "20px",
        borderRadius: radius.md,
        background: colors.card,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        cursor: "pointer",
        textAlign: "left",
      },

      icon: {
        fontSize: "22px",
      },

      dashboardMessage: {
        color: colors.accentSoft,
        fontSize: "13px",
        textAlign: "center",
        margin: "0 0 14px",
      },

      welcomeCard: {
        padding: "22px",
        borderRadius: radius.lg,
        background: colors.card,
        border: `1px solid ${colors.border}`,
      },

      profileName: {
        fontSize: "20px",
        fontWeight: 800,
        margin: "8px 0 2px",
      },

      username: {
        color: colors.textDim,
        fontSize: "13px",
        margin: "0 0 10px",
      },

      timerHeader: {
        marginBottom: "20px",
      },

      // MANNI MODE: dedicated soft-pastel branch added ahead of the
      // existing light/dark ternary. Light and Dark below are byte-
      // identical to before — nothing in their branch changed.
      timerCard:
        theme === "manni"
          ? {
              padding: "26px 22px",
              borderRadius: radius.xl,
              background: colors.bgGradient
                ? colors.bgGradient
                : `linear-gradient(145deg, ${colors.cardAlt}, ${colors.card})`,
              border: `1px solid ${colors.border}`,
              boxShadow: `0 14px 42px ${colors.borderGlow || "rgba(244, 143, 177, 0.28)"}`,
              marginBottom: "18px",
            }
          : {
              padding: "26px 22px",
              borderRadius: radius.xl,
              background:
                theme === "light"
                  ? `linear-gradient(145deg, ${colors.cardHover}, ${colors.card})`
                  : `linear-gradient(145deg, #12211f, #11191c)`,
              border: theme === "light" ? `1px solid ${colors.border}` : `1px solid #2f6f67`,
              marginBottom: "18px",
            },

      timerInfoCard: {
        padding: "20px",
        borderRadius: radius.lg,
        background: colors.card,
        border: `1px solid ${colors.border}`,
        marginBottom: "12px",
      },

      timerDisplay: {
        fontSize: "64px",
        fontWeight: 800,
        letterSpacing: "-3px",
        textAlign: "center",
        margin: "18px 0 10px",
      },

      timerStatus: {
        color: colors.textDim,
        textAlign: "center",
        lineHeight: 1.5,
        marginBottom: "20px",
      },

      durationGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "8px",
        marginBottom: "10px",
      },

      durationButton: {
        padding: "13px 8px",
        borderRadius: radius.sm,
        border: `1px solid ${colors.borderAlt}`,
        background: colors.cardAlt,
        color: colors.text,
        fontWeight: 700,
        cursor: "pointer",
      },

      selectedDuration: {
        border: `1px solid ${colors.accent}`,
        background: colors.accentDim,
        color: colors.accentSoft,
      },

      timerActions: {
        marginTop: "8px",
      },

      tipText: {
        color: colors.textFaint,
        fontSize: "13px",
        lineHeight: 1.5,
        margin: 0,
      },

      plannerList: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      },

      plannerTwoColumn: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
      },

      templateLibraryCard: {
        padding: "22px",
        borderRadius: radius.lg,
        background: colors.card,
        border: `1px solid ${colors.border}`,
        marginBottom: "22px",
      },

      templateLibraryHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        marginBottom: "16px",
        flexWrap: "wrap",
      },

      templateLibraryHeading: {
        flex: 1,
        minWidth: "200px",
      },

      templateLibraryTitle: {
        margin: "6px 0 8px",
        fontSize: "22px",
      },

      templateLibraryDescription: {
        color: colors.textDim,
        fontSize: "13px",
        lineHeight: 1.5,
        margin: 0,
      },

      templateCreateButton: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 16px",
        borderRadius: radius.sm,
        border: "none",
        background: colors.accent,
        color: theme === "manni" ? colors.accentText : "#071012",
        fontWeight: 800,
        fontSize: "13px",
        cursor: "pointer",
        flexShrink: 0,
      },

      templateCreator: {
        padding: "16px",
        marginBottom: "16px",
        borderRadius: radius.md,
        background: colors.cardAlt,
        border: `1px solid ${colors.border}`,
      },

      templateCreatorLabel: {
        color: colors.accentSoft,
        fontSize: "10px",
        fontWeight: 800,
        letterSpacing: "1.5px",
        marginBottom: "10px",
      },

      templateCreatorActions: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        marginTop: "4px",
      },

      templateEmpty: {
        textAlign: "center",
        padding: "36px 16px",
      },

      templateEmptyIcon: {
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        width: "52px",
        height: "52px",
        borderRadius: radius.md,
        background: colors.cardAlt,
        color: colors.accentSoft,
        marginBottom: "16px",
      },

      templateEmptyTitle: {
        fontSize: "16px",
        fontWeight: 800,
        margin: "0 0 8px",
      },

      templateEmptyText: {
        color: colors.textDim,
        fontSize: "13px",
        lineHeight: 1.5,
        margin: "0 0 18px",
      },

      templateEmptyButton: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 18px",
        borderRadius: radius.sm,
        border: "none",
        background: colors.accent,
        color: theme === "manni" ? colors.accentText : "#071012",
        fontWeight: 800,
        fontSize: "13px",
        cursor: "pointer",
      },

      templateList: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      },

      templateCard: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "16px",
        borderRadius: radius.md,
        background: colors.cardAlt,
        border: `1px solid ${colors.border}`,
      },

      templateCardIcon: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "42px",
        height: "42px",
        borderRadius: radius.sm,
        background: colors.accentDim,
        color: colors.accentSoft,
        flexShrink: 0,
      },

      templateCardContent: {
        flex: 1,
        minWidth: 0,
      },

      templateCardLabel: {
        color: colors.accentSoft,
        fontSize: "9px",
        fontWeight: 800,
        letterSpacing: "1.5px",
        margin: 0,
        textTransform: "uppercase",
      },

      templateCardTitle: {
        fontSize: "16px",
        margin: "5px 0 4px",
        fontWeight: 800,
      },

      templateCardMeta: {
        color: colors.textFaint,
        fontSize: "12px",
        margin: 0,
      },

      templateMoreButton: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "36px",
        height: "36px",
        borderRadius: radius.sm,
        border: `1px solid ${colors.border}`,
        background: colors.bgAlt,
        color: colors.textDim,
        cursor: "pointer",
        flexShrink: 0,
      },

      // MANNI MODE: dedicated soft-frosted branch added ahead of the
      // existing light/dark ternary. Light and Dark below are byte-
      // identical to before.
      bottomNav:
        theme === "manni"
          ? {
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              padding: "10px 6px calc(10px + env(safe-area-inset-bottom))",
              background: "rgba(255, 240, 245, 0.90)",
              backdropFilter: "blur(14px)",
              borderTop: `1px solid ${colors.border}`,
              boxShadow: `0 -8px 24px ${colors.borderGlow || "rgba(244, 143, 177, 0.18)"}`,
              zIndex: 50,
            }
          : {
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              padding: "10px 6px calc(10px + env(safe-area-inset-bottom))",
              background:
                theme === "light"
                  ? "rgba(255, 255, 255, 0.92)"
                  : "rgba(11, 17, 19, 0.92)",
              backdropFilter: "blur(14px)",
              borderTop: `1px solid ${colors.border}`,
              zIndex: 50,
            },

      bottomNavItem: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        background: "transparent",
        border: "none",
        color: colors.textFaint,
        fontSize: "10px",
        fontWeight: 700,
        cursor: "pointer",
        padding: "6px 8px",
        flex: 1,
      },

      // MANNI MODE: active tab gets a soft glow in addition to the
      // existing color change. Light/Dark unaffected (textShadow is
      // "none" for them, same visual result as before).
      bottomNavItemActive: {
        color: colors.accentSoft,
        textShadow: theme === "manni" ? `0 0 10px ${colors.borderGlow || "rgba(244, 143, 177, 0.5)"}` : "none",
      },
    };
  }, [colors, theme]);
}