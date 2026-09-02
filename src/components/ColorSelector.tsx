import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";

interface ColorSelectorProps {
  value?: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
  styles: AppStyles;
  label?: string;
}

// Fixed hex palette, deliberately independent of light/dark theme (like
// the app's own accent colors) so a chosen period color looks the same
// regardless of which theme the viewer is in.
export const ROUTINE_COLOR_PRESETS = [
  { id: "teal", hex: "#58d8c4", name: "Teal" },
  { id: "blue", hex: "#5b9bf0", name: "Blue" },
  { id: "purple", hex: "#a78bfa", name: "Purple" },
  { id: "pink", hex: "#f472b6", name: "Pink" },
  { id: "orange", hex: "#f0a85d", name: "Orange" },
  { id: "yellow", hex: "#f0c665", name: "Yellow" },
  { id: "green", hex: "#6fcf7a", name: "Green" },
  { id: "red", hex: "#ff8f8f", name: "Red" },
];

export default function ColorSelector({
  value,
  onChange,
  disabled,
  styles,
  label = "COLOR",
}: ColorSelectorProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  return (
    <div>
      {label && <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "8px" }}>{label}</p>}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {/* DEFAULT / NO CUSTOM COLOR */}
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          title="Use default"
          aria-label="Use default color"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: !value ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
            background: colors.cardAlt,
            cursor: disabled ? "default" : "pointer",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: "8px",
              borderTop: `2px solid ${colors.textDim}`,
              transform: "rotate(45deg)",
            }}
          />
        </button>

        {ROUTINE_COLOR_PRESETS.map((preset) => {
          const isSelected = value === preset.hex;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.hex)}
              disabled={disabled}
              title={preset.name}
              aria-label={preset.name}
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                border: isSelected ? `2px solid ${colors.text}` : "1px solid rgba(0,0,0,0.15)",
                background: preset.hex,
                cursor: disabled ? "default" : "pointer",
                boxShadow: isSelected ? `0 0 0 3px ${colors.card}, 0 0 0 5px ${preset.hex}` : "none",
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}