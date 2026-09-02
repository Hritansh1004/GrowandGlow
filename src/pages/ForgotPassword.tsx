import type { FormEvent } from "react";
import { AppStyles } from "../hooks/useStyles";
import { LockIcon, MailIcon, CheckIcon } from "../components/Icons";

interface ForgotPasswordProps {
  email: string;
  setEmail: (val: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
  message: string;
  emailSent: boolean;
  onBackToLogin: () => void;
  setPage: (page: string) => void;
  styles: AppStyles;
}

export default function ForgotPassword({
  email,
  setEmail,
  onSubmit,
  loading,
  message,
  emailSent,
  onBackToLogin,
  setPage,
  styles,
}: ForgotPasswordProps) {
  return (
    <div style={styles.page}>
      <main style={styles.authCard}>
        <div style={styles.logo}>
          <LockIcon width={22} height={22} />
        </div>
        <p style={styles.eyebrow}>BENCHMATE</p>
        <h1 style={styles.authTitle}>Reset your password</h1>

        {!emailSent && (
          <p style={styles.cardText}>
            Enter the email address on your account and we will send you a
            link to reset your password.
          </p>
        )}

        {!emailSent && (
          <form onSubmit={onSubmit} style={{ textAlign: "left" }}>
            <label style={styles.label}>Email</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...styles.input, paddingLeft: "38px" }}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
              <span
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "13px",
                  color: "#63d8c7",
                  display: "flex",
                }}
              >
                <MailIcon width={16} height={16} />
              </span>
            </div>

            <button
              style={{ ...styles.primary, marginTop: "10px" }}
              type="submit"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        {emailSent && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "rgba(99, 216, 199, 0.1)",
              border: "1px solid rgba(99, 216, 199, 0.3)",
            }}
          >
            <span style={{ color: "#63d8c7", marginTop: "2px" }}>
              <CheckIcon width={16} height={16} />
            </span>
            <p style={{ ...styles.cardText, margin: 0 }}>
              A password reset link has been sent to <strong>{email}</strong>.
              Open it on this device to continue.
            </p>
          </div>
        )}

        {message && <p style={styles.message}>{message}</p>}

        <button
          style={styles.secondary}
          onClick={() => {
            onBackToLogin();
            setPage("login");
          }}
        >
          Back to Log In
        </button>
      </main>
    </div>
  );
}