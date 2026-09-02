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
} from "../components/Icons";

interface SettingsProps {
  user: any;
  profile: any;
  setPage: (page: string) => void;
  logout: () => void;
  openProfileEditor: () => void;
  updatePassword: (newPassword: string) => Promise<{ error: { message: string } | null }>;
  styles: AppStyles;
}

const SUPABASE_SQL_MIGRATION = `-- =========================================================
-- BENCHMATE SUPABASE DATABASE MIGRATION SCRIPT
-- Paste and run this in your Supabase SQL Editor:
-- =========================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Alarms & Custom Bell Sounds Table
CREATE TABLE IF NOT EXISTS public.alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_builtin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Timetable Templates Table (Save & Reuse Schedules)
CREATE TABLE IF NOT EXISTS public.timetable_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Custom',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Template Periods Table
CREATE TABLE IF NOT EXISTS public.template_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.timetable_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  alarm_id TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Daily Ratings & Task Evaluations (1 to 10 scale)
CREATE TABLE IF NOT EXISTS public.daily_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period_id TEXT,
  task_id TEXT,
  rating_type TEXT DEFAULT 'day', -- 'day', 'period', 'task'
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Planner Tasks Table
CREATE TABLE IF NOT EXISTS public.planner_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  completed BOOLEAN DEFAULT false,
  alarm_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Study Rooms (Multiplayer / Friends Study)
CREATE TABLE IF NOT EXISTS public.study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  code TEXT UNIQUE NOT NULL,
  current_period_title TEXT,
  timer_state TEXT DEFAULT 'idle',
  timer_duration_seconds INT DEFAULT 1500,
  timer_ends_at TIMESTAMPTZ,
  active_template_id UUID,
  timetable_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;

-- 9. Basic RLS Policies
CREATE POLICY "Users can access their own profiles" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can access their alarms" ON public.alarms FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access their templates" ON public.timetable_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access their template periods" ON public.template_periods FOR ALL USING (true);
CREATE POLICY "Users can access their daily ratings" ON public.daily_ratings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access their tasks" ON public.planner_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access study rooms" ON public.study_rooms FOR ALL USING (true);
`;

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

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [customSoundName, setCustomSoundName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [showSqlAccordion, setShowSqlAccordion] = useState(false);
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

  function handleCopySql() {
    navigator.clipboard.writeText(SUPABASE_SQL_MIGRATION);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2500);
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
    <div style={{ ...styles.page, background: colors.bg, color: colors.text }}>
      <main style={styles.dashboard}>
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
          <h1 style={{ ...styles.routineTitle, color: colors.text }}>Settings & Audio</h1>
          <p style={{ ...styles.cardText, color: colors.textDim }}>
            Audio tones, theme preferences, custom bells, and database configuration.
          </p>
        </div>

        {/* APPEARANCE / THEME */}
        <section style={{ ...styles.timerCard, background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
          <p style={{ ...styles.cardLabel, color: colors.accent }}>APPEARANCE</p>
          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            {(["dark", "light", "system"] as const).map((mode) => {
              const active = themePreference === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "12px",
                    border: active ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                    background: active ? colors.accentDim : colors.cardAlt,
                    color: active ? colors.accent : colors.textDim,
                    fontSize: "13px",
                    fontWeight: 700,
                    textTransform: "capitalize",
                    cursor: "pointer",
                  }}
                  onClick={() => setThemePreference(mode)}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </section>

        {/* CUSTOM BELL & ALARM SOUND UPLOADER */}
        <section style={{ ...styles.timerCard, background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
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
        <section style={{ ...styles.timerCard, background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
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

        {/* SUPABASE SQL MIGRATION TOOL */}
        <section style={{ ...styles.timerCard, background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>
              DATABASE SQL SCHEMA & MIGRATION
            </p>
            <button
              type="button"
              onClick={handleCopySql}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                background: sqlCopied ? "#19322f" : colors.accent,
                color: sqlCopied ? "#58d8c4" : colors.accentText,
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {sqlCopied ? <CheckIcon width={12} height={12} /> : null}
              {sqlCopied ? "Copied SQL!" : "Copy SQL Script"}
            </button>
          </div>

          <p style={{ fontSize: "13px", color: colors.textDim, marginBottom: "12px" }}>
            Click below to inspect or copy the exact SQL schema to run in your Supabase SQL Editor.
          </p>

          <button
            type="button"
            onClick={() => setShowSqlAccordion((prev) => !prev)}
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              border: `1px solid ${colors.border}`,
              background: colors.cardAlt,
              color: colors.text,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: showSqlAccordion ? "10px" : "0",
            }}
          >
            {showSqlAccordion ? "Hide SQL Script ▲" : "View SQL Script ▼"}
          </button>

          {showSqlAccordion && (
            <pre
              style={{
                padding: "12px",
                borderRadius: "12px",
                background: colors.bgAlt,
                border: `1px solid ${colors.border}`,
                color: colors.textDim,
                fontSize: "11px",
                fontFamily: "monospace",
                overflowX: "auto",
                maxHeight: "220px",
              }}
            >
              {SUPABASE_SQL_MIGRATION}
            </pre>
          )}
        </section>

        {/* ACCOUNT INFO */}
        <section style={{ ...styles.timerCard, background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
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
        <section style={{ ...styles.timerCard, background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
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
          Log Out of Benchmate
        </button>
      </main>
    </div>
  );
}