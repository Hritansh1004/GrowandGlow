import { useEffect, useState } from "react";
import { AppStyles } from "../hooks/useStyles";
import { AlarmItem } from "../hooks/useAlarms";
import AlarmSelector from "./AlarmSelector";
import ColorSelector from "./ColorSelector";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";

export interface PeriodFormValues {
  name: string;
  category: string;
  isBreak: boolean;
  startTime: string;
  endTime: string;
  alarmId: string | null;
  color: string | null;
}

interface PeriodFormModalProps {
  open: boolean;
  title: string;
  initialValues?: Partial<PeriodFormValues>;
  allAlarms: AlarmItem[];
  onPreviewAlarm?: (id: string) => void;
  onSave: (values: PeriodFormValues) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
  errorMessage?: string;
  styles: AppStyles;
  // Room-building context sometimes doesn't need a "Category/Subject"
  // field distinct from the name — leave true unless a caller opts out.
  showCategoryField?: boolean;
}

const DEFAULTS: PeriodFormValues = {
  name: "",
  category: "",
  isBreak: false,
  startTime: "",
  endTime: "",
  alarmId: null,
  color: null,
};

// No hardcoded clock defaults (e.g. a fixed "09:00") — that showed the
// same stale time no matter what time it actually was, which is exactly
// the "default values that don't match reality" problem being fixed here.
// Instead, a brand-new period defaults to the current real time, rounded
// up to the next 5 minutes, with a 45-minute end time — so tapping the
// time field opens the native picker already sitting near "now" instead
// of always jumping to 9 AM.
function getDefaultStartTime(): string {
  const now = new Date();
  let hours = now.getHours();
  let minutes = Math.ceil(now.getMinutes() / 5) * 5;
  if (minutes >= 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutesToTime(time: string, addMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = ((h * 60 + m + addMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Shared Add/Edit period form used identically by TemplateBuilder.tsx
// (personal timetable templates) and the Room Routine builder inside
// StudyRoom.tsx. Extracted so the two never drift into looking or
// behaving like different products — one editor, two data destinations.
export default function PeriodFormModal({
  open,
  title,
  initialValues,
  allAlarms,
  onPreviewAlarm,
  onSave,
  onCancel,
  saving = false,
  errorMessage = "",
  styles,
  showCategoryField = true,
}: PeriodFormModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const [values, setValues] = useState<PeriodFormValues>({ ...DEFAULTS, ...initialValues });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (open) {
      if (initialValues && (initialValues.startTime || initialValues.endTime)) {
        // Editing an existing period — keep its real saved times, never
        // overwrite with a computed default.
        setValues({ ...DEFAULTS, ...initialValues });
      } else {
        // Adding a brand-new period — default to the actual current time,
        // not a fixed clock value.
        const start = getDefaultStartTime();
        setValues({
          ...DEFAULTS,
          ...initialValues,
          startTime: start,
          endTime: addMinutesToTime(start, 45),
        });
      }
      setLocalError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues?.name, initialValues?.startTime, initialValues?.endTime]);

  if (!open) return null;

  function update<K extends keyof PeriodFormValues>(key: K, value: PeriodFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");

    if (!values.name.trim()) {
      setLocalError("Please enter a period name.");
      return;
    }
    if (!values.startTime || !values.endTime) {
      setLocalError("Start and end time are both required.");
      return;
    }
    if (values.endTime <= values.startTime) {
      setLocalError("End time must be later than start time.");
      return;
    }

    await onSave({
      ...values,
      name: values.name.trim(),
      category: values.category.trim(),
    });
  }

  const combinedError = localError || errorMessage;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4, 7, 8, 0.75)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 500,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: colors.card,
          borderTop: `1px solid ${colors.border}`,
          borderTopLeftRadius: "26px",
          borderTopRightRadius: "26px",
          padding: "26px 20px calc(30px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: "20px", color: colors.text }}>{title}</h2>

        <form onSubmit={handleSubmit}>
          {/* TYPE SELECTOR */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => update("isBreak", false)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "12px",
                border: !values.isBreak ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                background: !values.isBreak ? colors.accentDim : colors.cardAlt,
                color: !values.isBreak ? colors.accent : colors.textDim,
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Study Period
            </button>
            <button
              type="button"
              onClick={() => update("isBreak", true)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "12px",
                border: values.isBreak ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                background: values.isBreak ? colors.accentDim : colors.cardAlt,
                color: values.isBreak ? colors.accent : colors.textDim,
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Break
            </button>
          </div>

          <label style={{ ...styles.label, color: colors.textDim }}>Period Name</label>
          <input
            style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
            type="text"
            placeholder="e.g. Physics Problem Solving, Lunch Break"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />

          {showCategoryField && !values.isBreak && (
            <>
              <label style={{ ...styles.label, color: colors.textDim }}>Subject</label>
              <input
                style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                type="text"
                placeholder="e.g. Physics, History"
                value={values.category}
                onChange={(e) => update("category", e.target.value)}
              />
            </>
          )}

          <div style={styles.plannerTwoColumn}>
            <div>
              <label style={{ ...styles.label, color: colors.textDim }}>Start Time</label>
              <input
                style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                type="time"
                value={values.startTime}
                onChange={(e) => update("startTime", e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ ...styles.label, color: colors.textDim }}>End Time</label>
              <input
                style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                type="time"
                value={values.endTime}
                onChange={(e) => update("endTime", e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <AlarmSelector
              allAlarms={allAlarms}
              value={values.alarmId}
              onChange={(val) => update("alarmId", val)}
              onPreview={onPreviewAlarm}
              styles={styles}
              label="COMPLETION ALARM"
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <ColorSelector
              value={values.color}
              onChange={(val) => update("color", val)}
              styles={styles}
              label="PERIOD COLOR"
            />
          </div>

          {combinedError && (
            <p style={{ color: colors.danger, fontSize: "13px", fontWeight: 700, margin: "0 0 12px" }}>
              {combinedError}
            </p>
          )}

          <button
            style={{ ...styles.primary, background: colors.accent, color: colors.accentText }}
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Period"}
          </button>

          <button
            type="button"
            style={{ ...styles.secondary, marginTop: "10px", background: colors.cardAlt, color: colors.textDim, border: `1px solid ${colors.border}` }}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}