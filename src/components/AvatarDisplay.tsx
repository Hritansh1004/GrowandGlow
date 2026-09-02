import { getAvatarPreset } from "./AvatarPresets";

// Shared read-only avatar renderer used anywhere a person's face needs to
// show up — Dashboard, Friends, Study Room roster, invite lists, etc.
// Mirrors the same preset/photo/initial-fallback logic Profile.tsx uses
// for picking an avatar, just without the picker UI. Keeping this in one
// place means avatar rendering only has to be fixed once, everywhere.
interface AvatarDisplayProps {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  radius?: "circle" | "rounded";
  background?: string;
  color?: string;
  border?: string;
}

export default function AvatarDisplay({
  avatarUrl,
  name,
  size = 36,
  radius = "circle",
  background = "rgba(99, 216, 199, 0.12)",
  color = "#63d8c7",
  border,
}: AvatarDisplayProps) {
  const preset = getAvatarPreset(avatarUrl);
  const hasPhoto = Boolean(avatarUrl) && !preset;
  const borderRadius = radius === "circle" ? "50%" : "12px";

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background,
        border: border || "none",
        flexShrink: 0,
      }}
    >
      {preset ? (
        <preset.Component width={size} height={size} />
      ) : hasPhoto ? (
        <img
          src={avatarUrl as string}
          alt={name ? `${name}'s avatar` : "Avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{ fontWeight: 800, color, fontSize: `${Math.round(size * 0.4)}px` }}>
          {(name || "?").trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </div>
  );
}