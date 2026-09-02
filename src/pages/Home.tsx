import { CalendarIcon, TimerCircleIcon, UsersIcon } from "../components/Icons";

interface HomeProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function Home({ onGetStarted, onLogin }: HomeProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 20% 0%, #0f1e1c 0%, #080d0f 55%)",
        color: "#f5f7f8",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 24px",
        boxSizing: "border-box",
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <main style={{ width: "100%", maxWidth: "440px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 14px 8px 8px",
            borderRadius: "999px",
            background: "rgba(88, 216, 196, 0.08)",
            border: "1px solid rgba(88, 216, 196, 0.18)",
            marginBottom: "36px",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "9px",
              background: "linear-gradient(135deg, #58d8c4, #319bd8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "15px",
              fontWeight: 900,
              color: "#071012",
            }}
          >
            G
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.5px",
              color: "#a9e8dc",
            }}
          >
            Grow & Glow
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(38px, 9vw, 56px)",
            lineHeight: "1.04",
            letterSpacing: "-2.2px",
            margin: "0 0 18px",
            fontWeight: 700,
          }}
        >
          Your study desk,
          <br />
          <span style={{ color: "#63d8c7" }}>built for focus.</span>
        </h1>

        <p
          style={{
            color: "#9ba8ad",
            lineHeight: "1.65",
            fontSize: "16px",
            maxWidth: "380px",
            margin: "0 0 36px",
          }}
        >
          A custom timetable, an accurate Pomodoro focus timer, real study history — and a room to study alongside friends, live.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            type="button"
            onClick={onGetStarted}
            style={{
              width: "100%",
              padding: "18px",
              borderRadius: "16px",
              border: "none",
              background: "#58d8c4",
              color: "#071012",
              fontSize: "16px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 12px 30px rgba(88, 216, 196, 0.18)",
            }}
          >
            Get Started
          </button>

          <button
            type="button"
            onClick={onLogin}
            style={{
              width: "100%",
              padding: "18px",
              borderRadius: "16px",
              border: "1px solid #24312f",
              background: "transparent",
              color: "#e8edef",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            I already have an account
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "22px",
            marginTop: "44px",
            flexWrap: "wrap",
          }}
        >
          {[
            { Icon: CalendarIcon, label: "Custom timetable" },
            { Icon: TimerCircleIcon, label: "Focus & Pomodoro" },
            { Icon: UsersIcon, label: "Study together" },
          ].map(({ Icon, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12.5px",
                color: "#7b878b",
                fontWeight: 600,
              }}
            >
              <Icon width={15} height={15} />
              {label}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
