import { AlarmItem } from "../hooks/useAlarms";
import { AppStyles } from "../hooks/useStyles";
import { PlayIcon } from "./Icons";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";

interface AlarmSelectorProps {
  allAlarms?: AlarmItem[];
  value?: string | null;
  onChange: (val: string | null) => void;
  onPreview?: (val: string) => void;
  disabled?: boolean;
  styles: AppStyles;
  label?: string;
}

export default function AlarmSelector({
  allAlarms = [],
  value,
  onChange,
  onPreview,
  disabled,
  styles,
  label = "ALARM",
}: AlarmSelectorProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const grouped = allAlarms.reduce<Record<string, AlarmItem[]>>((acc, alarm) => {
    if (!acc[alarm.group]) acc[alarm.group] = [];
    acc[alarm.group].push(alarm);
    return acc;
  }, {});

  return (
    <div>
      {label && <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "8px" }}>{label}</p>}

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <select
          style={{
            ...styles.input,
            marginBottom: 0,
            flex: 1,
            background: colors.cardAlt,
            border: `1px solid ${colors.border}`,
            color: colors.text,
          }}
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        >
          <option value="">Use default alarm tone</option>
          {Object.entries(grouped).map(([groupName, alarms]) => (
            <optgroup key={groupName} label={groupName}>
              {alarms.map((alarm) => (
                <option key={alarm.id} value={alarm.id}>
                  {alarm.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <button
          type="button"
          onClick={() => value && onPreview && onPreview(value)}
          disabled={!value || disabled}
          style={{
            width: "48px",
            height: "48px",
            flexShrink: 0,
            borderRadius: "12px",
            border: `1px solid ${colors.border}`,
            background: value ? colors.accentDim : colors.cardAlt,
            color: value ? colors.accent : colors.textDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: value ? "pointer" : "default",
          }}
          aria-label="Preview sound"
        >
          <PlayIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

