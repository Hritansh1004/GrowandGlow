import { useState, type FormEvent } from "react";
import { AppStyles } from "../hooks/useStyles";
import { LockIcon } from "../components/Icons";

interface ResetPasswordProps {
  newPassword: string;
  confirmNewPassword: string;
  setNewPassword: (val: string) => void;
  setConfirmNewPassword: (val: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  loading: boolean;
  message: string;
  styles: AppStyles;
}

export default function ResetPassword({
  newPassword,
  confirmNewPassword,
  setNewPassword,
  setConfirmNewPassword,
  onSubmit,
  onCancel,
  loading,
  message,
  styles,
}: ResetPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={styles.page}>
      <main style={styles.authCard}>
        <div style={styles.logo}>
          <LockIcon width={22} height={22} />
        </div>
        <p style={styles.eyebrow}>BENCHMATE</p>
        <h1 style={styles.authTitle}>Set a new password</h1>
        <p style={styles.cardText}>
          Choose a new password for your account. You will stay logged in
          once it is saved.
        </p>

        <form onSubmit={onSubmit} style={{ textAlign: "left" }}>
          <label style={styles.label}>New password</label>
          <div style={{ position: "relative" }}>
            <input
              style={{ ...styles.input, paddingRight: "70px" }}
              type={showPassword ? "text" : "password"}
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute",
                right: "14px",
                top: "13px",
                background: "transparent",
                border: "none",
                color: "#63d8c7",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label style={styles.label}>Confirm new password</label>
          <input
            style={styles.input}
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your new password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />

          <button
            style={{ ...styles.primary, marginTop: "10px" }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save New Password"}
          </button>
        </form>

        {message && <p style={styles.message}>{message}</p>}

        <button style={styles.secondary} onClick={onCancel}>
          Cancel
        </button>
      </main>
    </div>
  );
}