// src/pages/Settings.tsx
import { useState, useRef, type FormEvent } from "react";
import { AppStyles } from "../hooks/useStyles";
import useAlarms from "../hooks/useAlarms";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";
import {
  ArrowLeftIcon,
  PlayIcon,
  VolumeIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  PencilIcon,
  LockIcon,
  SparkleIcon,
} from "../components/Icons";
import { ManniAmbientBackground, ManniCornerDecor } from "../components/ManniEffects";

interface SettingsProps {
  user: any;
  profile: any;
  setPage: (page: string) => void;
  logout: () => void;
  openProfileEditor: () => void;
  updatePassword: (newPassword: string) => Promise<{ error: { message: string } | null }>;
  styles: AppStyles;
}

// Display labels for each theme preference. Kept as an explicit map
// (rather than relying on textTransform: capitalize on the raw key)
// so "manni" can render as the full "Manni Mode" label per spec instead
// of just "Manni".
const THEME_LABELS: Record<"dark" | "light" | "system" | "manni", string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
  manni: "Manni Mode",
};

export default function Settings({
  user,
  profile,
  setPage,
  logout,
  openProfileEditor,
  updatePassword,
  styles,
}: SettingsProps) {
  const { theme, themePreference, setThemePreference } = useTheme();
  const colors = getThemeColors(theme);
  const {
    allAlarms,
    customAlarms,
    uploadAlarm,
    deleteAlarm,
    playAlarm,
    uploading,
    alarmsMessage,
  } = useAlarms(user?.id);

  // MANNI MODE ONLY: everything gated behind this flag is purely additive.
  // Light/Dark render exactly the JSX/styles they always have — this flag
  // is false for both, so none of the Manni-only branches below ever run
  // for them. Same pattern as Dashboard.tsx / Timer.tsx / Routine.tsx /
  // BottomNav.tsx.
  const isManni = theme === "manni";

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [customSoundName, setCustomSoundName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change Password (for already-logged-in users). This is separate from
  // the Forgot Password recovery-link flow in ForgotPassword.tsx /
  // ResetPassword.tsx, but calls the same updatePassword() from
  // useAuth.ts under the hood — there's only one code path that actually
  // talks to Supabase Auth for setting a new password.
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordMessage, setChangePasswordMessage] = useState("");
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false);

  function handlePreview(id: string) {
    setPlayingId(id);
    playAlarm(id);
    setTimeout(() => setPlayingId(null), 2500);
  }

  async function handleUploadCustomSound(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    await uploadAlarm(selectedFile, customSoundName);
    setSelectedFile(null);
    setCustomSoundName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setChangePasswordMessage("");

    if (newPassword !== confirmNewPassword) {
      setChangePasswordMessage("Passwords do not match.");
      return;
    }

    setChangePasswordSubmitting(true);
    const res = await updatePassword(newPassword);
    setChangePasswordSubmitting(false);

    if (res?.error) {
      setChangePasswordMessage(res.error.message || "Failed to update password.");
    } else {
      setNewPassword("");
      setConfirmNewPassword("");
      setChangePasswordMessage("Password updated successfully.");
    }
  }
  return (
    <div
      style={{
        ...styles.page,
        // MANNI MODE ONLY: soft blush gradient instead of the flat bg.
        // Light/Dark keep the exact same solid colors.bg they always had.
        background: isManni && colors.bgGradient ? colors.bgGradient : colors.bg,
        color: colors.text,
        position: "relative",
      }}
    >
      {/* MANNI MODE ONLY: slow-drifting hearts/sparkles/stars behind all
          page content. Renders nothing for Light/Dark. */}
      {isManni && <ManniAmbientBackground />}

      <main style={{ ...styles.dashboard, position: "relative", zIndex: 1 }}>
        {/* BACK TO DASHBOARD */}
        <button
          type="button"
          style={{ ...styles.backButton, display: "inline-flex", alignItems: "center", gap: "8px", color: colors.textDim }}
          onClick={() => setPage("dashboard")}
        >
          <ArrowLeftIcon />
          Back to Dashboard
        </button>

        {/* HEADER */}
        <div style={styles.timerHeader}>
          <p style={{ ...styles.eyebrow, color: colors.accent }}>PREFERENCES</p>
          <h1
            style={{
              ...styles.routineTitle,
              color: colors.text,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Settings & Audio
            {/* MANNI MODE ONLY: small sparkle accent next to the title. */}
            {isManni && (
              <span style={{ color: colors.accent, display: "inline-flex" }} aria-hidden="true">
                <SparkleIcon width={16} height={16} />
              </span>
            )}
          </h1>
          <p style={{ ...styles.cardText, color: colors.textDim }}>
            Audio tones, theme preferences, custom bells, and database configuration.
          </p>
        </div>

        {/* APPEARANCE / THEME */}
        <section style={{ ...styles.timerCard, position: "relative", background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
          {/* MANNI MODE ONLY: twinkling bow in the corner. */}
          {isManni && <ManniCornerDecor kind="bow" corner="top-right" color={colors.accent} />}

          <p style={{ ...styles.cardLabel, color: colors.accent }}>APPEARANCE</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            {(["dark", "light", "system", "manni"] as const).map((mode) => {
              const active = themePreference === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  style={{
                    padding: "10px",
                    borderRadius: "12px",
                    border: active ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                    background: active ? colors.accentDim : colors.cardAlt,
                    color: active ? colors.accent : colors.textDim,
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => setThemePreference(mode)}
                >
                  {THEME_LABELS[mode]}
                </button>
              );
            })}
          </div>
        </section>

        {/* CUSTOM BELL & ALARM SOUND UPLOADER */}
        <section style={{ ...styles.timerCard, position: "relative", background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
          {/* MANNI MODE ONLY: twinkling sparkle in the corner. */}
          {isManni && <ManniCornerDecor kind="sparkle" corner="top-right" color={colors.accent} />}

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <VolumeIcon width={18} height={18} />
            <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>
              UPLOAD CUSTOM BELL & ALARM SOUNDS
            </p>
          </div>
          <p style={{ fontSize: "13px", color: colors.textDim, marginBottom: "14px" }}>
            Upload your own school bells, gongs, or alarm audio files (MP3, WAV, OGG, M4A) to ring at period transitions.
          </p>

          <form onSubmit={handleUploadCustomSound} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="Sound Name (e.g. School Bell, Loud Siren, Zen Bowl)"
              value={customSoundName}
              onChange={(e) => setCustomSoundName(e.target.value)}
              style={{
                ...styles.input,
                marginBottom: 0,
                background: colors.cardAlt,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            />

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                    if (!customSoundName) {
                      setCustomSoundName(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                    }
                  }
                }}
                style={{
                  ...styles.input,
                  marginBottom: 0,
                  flex: 1,
                  padding: "10px",
                  background: colors.cardAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: "12px",
                }}
              />

              <button
                type="submit"
                disabled={!selectedFile || uploading}
                style={{
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "none",
                  background: selectedFile ? colors.accent : colors.cardAlt,
                  color: selectedFile ? colors.accentText : colors.textDim,
                  fontWeight: 800,
                  fontSize: "13px",
                  cursor: selectedFile ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <PlusIcon width={14} height={14} />
                {uploading ? "Uploading..." : "Save Sound"}
              </button>
            </div>

            {alarmsMessage && (
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: colors.accent, fontWeight: 600 }}>
                {alarmsMessage}
              </p>
            )}
          </form>

          {/* LIST OF USER'S CUSTOM SOUNDS */}
          {customAlarms.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: colors.textDim }}>
                YOUR CUSTOM SOUNDS ({customAlarms.length})
              </p>
              {customAlarms.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: colors.cardAlt,
                    border: `1px solid ${colors.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: colors.text }}>{a.name}</strong>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: `1px solid ${colors.border}`,
                        background: playingId === a.id ? colors.accentDim : "transparent",
                        color: playingId === a.id ? colors.accent : colors.text,
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      onClick={() => handlePreview(a.id)}
                    >
                      <PlayIcon width={12} height={12} />
                      {playingId === a.id ? "Playing..." : "Test"}
                    </button>

                    <button
                      type="button"
                      style={{
                        padding: "6px 8px",
                        borderRadius: "8px",
                        border: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.danger,
                        cursor: "pointer",
                      }}
                      onClick={() => deleteAlarm(a.id)}
                      title="Delete sound"
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* BUILT-IN ALARM SOUNDS */}
        <section style={{ ...styles.timerCard, position: "relative", background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
          {/* MANNI MODE ONLY: twinkling star in the corner. */}
          {isManni && <ManniCornerDecor kind="star" corner="top-right" color={colors.accent} />}

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <VolumeIcon width={18} height={18} />
            <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>
              BUILT-IN SYNTHESIZED SOUNDS
            </p>
          </div>
          <p style={{ fontSize: "13px", color: colors.textDim, marginBottom: "14px" }}>
            High-fidelity harmonic tones for study periods and breaks.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {allAlarms
              .filter((a) => a.group === "Default Sounds")
              .map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: colors.cardAlt,
                    border: `1px solid ${colors.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: colors.text }}>{a.name}</strong>

                  <button
                    type="button"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                      background: playingId === a.id ? colors.accentDim : "transparent",
                      color: playingId === a.id ? colors.accent : colors.text,
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onClick={() => handlePreview(a.id)}
                  >
                    <PlayIcon width={12} height={12} />
                    {playingId === a.id ? "Playing..." : "Test"}
                  </button>
                </div>
              ))}
          </div>
        </section>

        {/* ACCOUNT INFO */}
        <section style={{ ...styles.timerCard, position: "relative", background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
          {/* MANNI MODE ONLY: twinkling heart in the corner. */}
          {isManni && <ManniCornerDecor kind="heart" corner="top-right" color={colors.accent} />}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>ACCOUNT</p>
            <button
              type="button"
              onClick={openProfileEditor}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                background: colors.cardAlt,
                color: colors.text,
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <PencilIcon width={12} height={12} />
              Edit Profile
            </button>
          </div>
          <div style={{ marginTop: "10px" }}>
            <p style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: colors.text }}>
              {profile?.display_name}
            </p>
            <p style={{ margin: "0 0 8px", fontSize: "13px", color: colors.accent }}>
              @{profile?.username}
            </p>
            {profile?.bio && (
              <p style={{ margin: "0 0 8px", fontSize: "13px", color: colors.textDim }}>
                {profile.bio}
              </p>
            )}
            <p style={{ margin: 0, fontSize: "13px", color: colors.textDim }}>
              {user?.email}
            </p>
          </div>
        </section>

        {/* CHANGE PASSWORD */}
        <section style={{ ...styles.timerCard, position: "relative", background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
          {/* MANNI MODE ONLY: twinkling ribbon in the corner. */}
          {isManni && <ManniCornerDecor kind="ribbon" corner="top-right" color={colors.accent} />}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: showChangePassword ? "12px" : "0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <LockIcon width={16} height={16} />
              <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>
                CHANGE PASSWORD
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowChangePassword((v) => !v);
                setChangePasswordMessage("");
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                background: colors.cardAlt,
                color: colors.text,
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {showChangePassword ? "Cancel" : "Change"}
            </button>
          </div>

          {showChangePassword && (
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                style={{
                  ...styles.input,
                  marginBottom: 0,
                  background: colors.cardAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                style={{
                  ...styles.input,
                  marginBottom: 0,
                  background: colors.cardAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
              <button
                type="submit"
                disabled={changePasswordSubmitting}
                style={{
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "none",
                  background: colors.accent,
                  color: colors.accentText,
                  fontWeight: 800,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {changePasswordSubmitting ? "Saving..." : "Save New Password"}
              </button>
            </form>
          )}

          {changePasswordMessage && (
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: colors.accent, fontWeight: 600 }}>
              {changePasswordMessage}
            </p>
          )}
        </section>

        {/* LOGOUT */}
        <button
          type="button"
          style={{ ...styles.secondary, color: colors.danger, border: `1px solid ${colors.danger}40`, background: colors.card }}
          onClick={logout}
        >
          Log Out of Grow & Glow
        </button>
      </main>
    </div>
  );
}
