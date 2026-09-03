import { useRef, useState, type FormEvent } from "react";
import { AppStyles } from "../hooks/useStyles";
import { CameraIcon, PencilIcon } from "../components/Icons";
import { AVATAR_PRESETS, getAvatarPreset } from "../components/AvatarPresets";
import { useTheme } from "../context/ThemeContext";

interface ProfileProps {
  mode: "onboarding" | "edit";
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  setDisplayName: (val: string) => void;
  setUsername: (val: string) => void;
  setBio: (val: string) => void;
  setAvatarUrl: (val: string | null) => void;
  uploadAvatar: (file: File) => Promise<{ url: string | null; error: { message: string } | null }>;
  saveProfile: (e: FormEvent) => void;
  onCancel?: () => void;
  loading: boolean;
  message: string;
  styles: AppStyles;
}

export default function Profile({
  mode,
  displayName,
  username,
  bio,
  avatarUrl,
  setDisplayName,
  setUsername,
  setBio,
  setAvatarUrl,
  uploadAvatar,
  saveProfile,
  onCancel,
  loading,
  message,
  styles,
}: ProfileProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/Logo.png" : "/Logo1.png";

  const presetMatch = getAvatarPreset(avatarUrl);
  // A real uploaded photo is any avatarUrl that isn't a "preset:xxx"
  // reference — presets are matched above via getAvatarPreset instead.
  const hasPhoto = Boolean(avatarUrl) && !presetMatch;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploading(true);
    const res = await uploadAvatar(file);
    setUploading(false);

    if (res.error) {
      setUploadError(res.error.message || "Failed to upload photo.");
      return;
    }

    setAvatarUrl(res.url);
    setShowPresetPicker(false);

    // Allow re-selecting the same file later (e.g. after choosing a
    // preset in between) by clearing the input's internal value.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePickPreset(presetId: string) {
    setAvatarUrl(`preset:${presetId}`);
    setShowPresetPicker(false);
    setUploadError("");
  }

  const isOnboarding = mode === "onboarding";

  return (
    <div style={styles.page}>
      <main style={styles.authCard}>
        <img src={logoSrc} alt="Grow & Glow logo" style={styles.logo} />
        <p style={styles.eyebrow}>GROW & GLOW</p>
        <h1 style={styles.authTitle}>
          {isOnboarding ? "Welcome" : "Edit Profile"}
        </h1>
        <p style={styles.cardText}>
          {isOnboarding
            ? "Before we continue, set up your profile."
            : "Update your display name, username, avatar, and bio."}
        </p>

        {/* AVATAR PICKER */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ position: "relative", width: "88px", height: "88px" }}>
            <div
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "50%",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(99, 216, 199, 0.12)",
                border: "2px solid rgba(99, 216, 199, 0.35)",
              }}
            >
              {presetMatch ? (
                <presetMatch.Component width={88} height={88} />
              ) : hasPhoto ? (
                <img
                  src={avatarUrl as string}
                  alt="Your avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: "32px", fontWeight: 800, color: "#63d8c7" }}>
                  {(displayName || "?").trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload a photo"
              style={{
                position: "absolute",
                bottom: "-2px",
                right: "-2px",
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                border: "2px solid #0f1613",
                background: "#63d8c7",
                color: "#0f1613",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <CameraIcon width={14} height={14} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {uploading && (
            <p style={{ ...styles.helper, marginTop: "8px" }}>Uploading photo...</p>
          )}
          {uploadError && (
            <p style={{ ...styles.helper, color: "#e0645c", marginTop: "8px" }}>
              {uploadError}
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowPresetPicker((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "10px",
              background: "transparent",
              border: "none",
              color: "#63d8c7",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <PencilIcon width={12} height={12} />
            {showPresetPicker ? "Hide preset avatars" : "Choose a preset avatar"}
          </button>

          {showPresetPicker && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "8px",
                marginTop: "10px",
                width: "100%",
              }}
            >
              {AVATAR_PRESETS.map((p) => {
                const active = presetMatch?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePickPreset(p.id)}
                    title={p.label}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: "12px",
                      overflow: "hidden",
                      padding: 0,
                      cursor: "pointer",
                      background: "transparent",
                      border: active ? "2px solid #63d8c7" : "2px solid transparent",
                    }}
                  >
                    <p.Component width="100%" height="100%" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={saveProfile} style={{ textAlign: "left" }}>
          <label style={styles.label}>Display name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="What should we call you?"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s+/g, "_"))}
            required
          />
          <p style={styles.helper}>
            Friends will find you by this username.
          </p>

          <label style={styles.label}>Bio</label>
          <textarea
            style={{ ...styles.input, minHeight: "80px", resize: "vertical", fontFamily: "inherit" }}
            placeholder="Tell your friends a little about yourself (optional)"
            value={bio}
            maxLength={160}
            onChange={(e) => setBio(e.target.value)}
          />
          <p style={styles.helper}>{bio.length}/160</p>

          <button
            style={{ ...styles.primary, marginTop: "6px" }}
            type="submit"
            disabled={loading || uploading}
          >
            {loading ? "Saving..." : isOnboarding ? "Continue" : "Save Changes"}
          </button>
        </form>

        {message && <p style={styles.message}>{message}</p>}

        {!isOnboarding && onCancel && (
          <button style={styles.secondary} onClick={onCancel}>
            Cancel
          </button>
        )}
      </main>
    </div>
  );
}
