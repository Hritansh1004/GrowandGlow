import { useState, type FormEvent } from "react";
import { AppStyles } from "../hooks/useStyles";

interface LoginProps {
  email: string;
  password: string;
  setEmail: (val: string) => void;
  setPassword: (val: string) => void;
  login: (e: FormEvent) => void;
  loading: boolean;
  message: string;
  setMessage: (val: string) => void;
  setPage: (page: string) => void;
  styles: AppStyles;
}

export default function Login({
  email,
  password,
  setEmail,
  setPassword,
  login,
  loading,
  message,
  setMessage,
  setPage,
  styles,
}: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={styles.page}>
      <main style={styles.authCard}>
        <div style={styles.logo}>G</div>
        <p style={styles.eyebrow}>GROW & GLOW</p>
        <h1 style={styles.authTitle}>Welcome back</h1>
        <p style={styles.cardText}>Log in to continue your study journey.</p>

        <form onSubmit={login} style={{ textAlign: "left" }}>
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
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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

          <div style={{ textAlign: "right", marginTop: "6px" }}>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setPage("forgot-password");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#63d8c7",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Forgot Password?
            </button>
          </div>

          <button
            style={{ ...styles.primary, marginTop: "10px" }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log In"}
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
