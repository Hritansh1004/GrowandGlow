import { useState, type FormEvent } from "react";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";

interface SignupProps {
  email: string;
  password: string;
  setEmail: (val: string) => void;
  setPassword: (val: string) => void;
  signup: (e: FormEvent) => void;
  loading: boolean;
  message: string;
  setMessage: (val: string) => void;
  setPage: (page: string) => void;
  styles: AppStyles;
}

export default function Signup({
  email,
  password,
  setEmail,
  setPassword,
  signup,
  loading,
  message,
  setMessage,
  setPage,
  styles,
}: SignupProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/Logo.png" : theme === "light" ? "/Logo2.png" : "/Logo1.png";

  const passwordStrength =
    password.length === 0
      ? ""
      : password.length < 6
      ? "Too short"
      : password.length < 10
      ? "Okay"
      : "Strong";

  return (
    <div style={styles.page}>
      <main style={styles.authCard}>
        <img src={logoSrc} alt="Grow & Glow logo" style={styles.logo} />
        <p style={styles.eyebrow}>GROW & GLOW</p>
        <h1 style={styles.authTitle}>Create your account</h1>
        <p style={styles.cardText}>Start your study journey.</p>

        <form onSubmit={signup} style={{ textAlign: "left" }}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label style={styles.label}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              style={{ ...styles.input, paddingRight: "70px" }}
              type={showPassword ? "text" : "password"}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
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

          {passwordStrength && (
            <p
              style={{
                fontSize: "12px",
                margin: "-6px 0 12px",
                color:
                  passwordStrength === "Strong"
                    ? "#63d8c7"
                    : passwordStrength === "Okay"
                    ? "#e8c468"
                    : "#ff8f8f",
                fontWeight: 700,
              }}
            >
              {passwordStrength}
            </p>
          )}

          <button style={styles.primary} type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {message && <p style={styles.message}>{message}</p>}

        <button
          style={styles.secondary}
          onClick={() => {
            setMessage("");
            setPage("home");
          }}
        >
          Back
        </button>
      </main>
    </div>
  );
}
