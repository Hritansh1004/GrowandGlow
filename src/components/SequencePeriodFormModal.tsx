import { useEffect, useState } from "react";
import { AppStyles } from "../hooks/useStyles";
import { AlarmItem } from "../hooks/useAlarms";
import AlarmSelector from "./AlarmSelector";
import ColorSelector from "./ColorSelector";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";

export interface SequenceBlockFormValues {
  name: string;
  category: string;
  isBreak: boolean;
  // Kept as a string (not a number) so the field can start genuinely
  // blank ("") instead of defaulting to 0 or any placeholder duration.
  // Converted to a number only at save time.
  durationMinutes: string;
  alarmId: string | null;
  color: string | null;
}

interface SequencePeriodFormModalProps {
  open: boolean;
  title: string;
  initialValues?: Partial<SequenceBlockFormValues>;
  allAlarms: AlarmItem[];
  onPreviewAlarm?: (id: string) => void;
  onSave: (values: SequenceBlockFormValues) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
  errorMessage?: string;
  styles: AppStyles;
  // Room-building context sometimes doesn't need a "Category/Subject"
  // field distinct from the name — leave true unless a caller opts out.
  showCategoryField?: boolean;
}

// Strictly zero defaults: a brand-new block always starts with an empty
// name, empty duration, and no color/alarm selected. Unlike Routine's
// PeriodFormModal (which reasonably defaults clock time to "now"),
// Sequence has no such reasonable numeric default — 25 minutes for one
// person is 5 minutes for another — so the duration field must be left
// truly blank until the user types a value.
const DEFAULTS: SequenceBlockFormValues = {
  name: "",
  category: "",
  isBreak: false,
  durationMinutes: "",
  alarmId: null,
  color: null,
};

// Shared Add/Edit block form for the Sequence system, mirroring
// PeriodFormModal.tsx (used identically by SequenceBuilder.tsx for
// personal sequence templates and, per Standing Rule 18, the Custom
// Study Room's Sequence tab) so both surfaces behave identically.
export default function SequencePeriodFormModal({
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
}: SequencePeriodFormModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const [values, setValues] = useState<SequenceBlockFormValues>({ ...DEFAULTS, ...initialValues });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (open) {
      // Whether adding or editing, just take whatever was passed in —
      // there is no computed default to fall back to for a new block,
      // unlike clock-time periods. A brand-new block's initialValues
      // will simply be empty, which is exactly what DEFAULTS already is.
      setValues({ ...DEFAULTS, ...initialValues });
      setLocalError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues?.name, initialValues?.durationMinutes]);

  if (!open) return null;

  function update<K extends keyof SequenceBlockFormValues>(key: K, value: SequenceBlockFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");

    if (!values.name.trim()) {
      setLocalError("Please enter a block name.");
      return;
    }

    const durationTrimmed = values.durationMinutes.trim();
    if (!durationTrimmed) {
      setLocalError("Please enter a duration.");
      return;
    }

    const durationNumber = Number(durationTrimmed);
    if (!Number.isFinite(durationNumber) || durationNumber <= 0) {
      setLocalError("Duration must be a whole number of minutes greater than 0.");
      return;
    }

    await onSave({
      ...values,
      name: values.name.trim(),
      category: values.category.trim(),
      durationMinutes: String(Math.round(durationNumber)),
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
              Study Block
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

          <label style={{ ...styles.label, color: colors.textDim }}>Block Name</label>
          <input
            style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
            type="text"
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
                value={values.category}
                onChange={(e) => update("category", e.target.value)}
              />
            </>
          )}

          <label style={{ ...styles.label, color: colors.textDim }}>Duration (minutes)</label>
          <input
            style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={values.durationMinutes}
            onChange={(e) => update("durationMinutes", e.target.value)}
            required
          />

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
              label="BLOCK COLOR"
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
            {saving ? "Saving..." : "Save Block"}
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
