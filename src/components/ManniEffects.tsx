// src/components/ManniEffects.tsx
//
// MANNI MODE ONLY — shared decorative/animation layer.
// Nothing here is imported by Light/Dark Mode code paths, so this file
// cannot affect Light or Dark Mode behavior or appearance.
// Rule 3: zero emojis — every visual here is pure SVG via Icons.tsx.

import { CSSProperties, ReactNode, useState } from "react";
import {
  HeartIcon,
  SparkleIcon,
  StarIcon,
  BowIcon,
  CloudIcon,
  RibbonIcon,
} from "./Icons";

/* ---------------------------------------------------------------
   Keyframes. Plain <style> tag, scoped by unique class/animation
   names (manni-*) so it can never collide with or leak into
   Light/Dark styling. Safe to mount on multiple pages — each page
   unmounts its own copy on navigation.
--------------------------------------------------------------- */
function ManniKeyframes() {
  return (
    <style>{`
      @keyframes manni-float-up {
        0%   { transform: translateY(0) scale(1); opacity: 0; }
        10%  { opacity: 0.85; }
        85%  { opacity: 0.45; }
        100% { transform: translateY(-150px) scale(0.85); opacity: 0; }
      }
      @keyframes manni-twinkle {
        0%, 100% { opacity: 0.3; transform: scale(0.85); }
        50%      { opacity: 1; transform: scale(1.1); }
      }
      @keyframes manni-burst-rise {
        0%   { transform: translateY(0) scale(0.6); opacity: 0; }
        15%  { opacity: 1; }
        100% { transform: translateY(-95px) scale(1); opacity: 0; }
      }
      @keyframes manni-pop-in {
        0%   { transform: scale(0.4); opacity: 0; }
        60%  { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      .manni-pressable {
        transition: transform 120ms ease, box-shadow 120ms ease;
      }
      .manni-pressable.manni-pressed {
        transform: scale(0.97);
      }
    `}</style>
  );
}

/* ---------------------------------------------------------------
   Ambient background — slow-drifting hearts/sparkles/stars behind
   page content. Deterministic layout (no Math.random) so it doesn't
   jump around on every re-render. Lightweight: CSS animation only,
   no JS animation loop, so it stays cheap on low-end Android phones
   per the spec's performance requirement.
--------------------------------------------------------------- */
interface AmbientPiece {
  id: number;
  left: string;
  size: number;
  delay: number;
  duration: number;
  kind: "heart" | "sparkle" | "star";
}

function buildAmbientPieces(count: number): AmbientPiece[] {
  const kinds: AmbientPiece["kind"][] = ["heart", "sparkle", "star"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${6 + ((i * 97) % 88)}%`,
    size: 10 + ((i * 7) % 10),
    delay: (i * 1.7) % 9,
    duration: 9 + ((i * 3) % 6),
    kind: kinds[i % kinds.length],
  }));
}

const ALL_AMBIENT_PIECES = buildAmbientPieces(9);

export function ManniAmbientBackground({
  density = "normal",
}: {
  density?: "low" | "normal";
}) {
  const pieces = density === "low" ? ALL_AMBIENT_PIECES.slice(0, 5) : ALL_AMBIENT_PIECES;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <ManniKeyframes />
      {pieces.map((p) => {
        const Icon = p.kind === "heart" ? HeartIcon : p.kind === "sparkle" ? SparkleIcon : StarIcon;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: p.left,
              bottom: "-20px",
              color: "rgba(244, 143, 177, 0.32)",
              animation: `manni-float-up ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          >
            <Icon width={p.size} height={p.size} />
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------
   Corner decoration — a small twinkling bow/heart/sparkle tucked
   into a card corner. Purely decorative, aria-hidden, never blocks
   taps (pointerEvents: none).
--------------------------------------------------------------- */
type DecorKind = "bow" | "heart" | "sparkle" | "star" | "ribbon" | "cloud";

const DECOR_ICON_MAP: Record<DecorKind, (props: any) => JSX.Element> = {
  bow: BowIcon,
  heart: HeartIcon,
  sparkle: SparkleIcon,
  star: StarIcon,
  ribbon: RibbonIcon,
  cloud: CloudIcon,
};

export function ManniCornerDecor({
  kind = "bow",
  color = "#F48FB1",
  corner = "bottom-right",
  size = 18,
  style,
}: {
  kind?: DecorKind;
  color?: string;
  corner?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  size?: number;
  style?: CSSProperties;
}) {
  const Icon = DECOR_ICON_MAP[kind];
  const pos: CSSProperties =
    corner === "top-right"
      ? { top: 10, right: 12 }
      : corner === "top-left"
      ? { top: 10, left: 12 }
      : corner === "bottom-left"
      ? { bottom: 10, left: 12 }
      : { bottom: 10, right: 12 };
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        color,
        opacity: 0.55,
        animation: "manni-twinkle 3.2s ease-in-out infinite",
        pointerEvents: "none",
        ...pos,
        ...style,
      }}
    >
      <Icon width={size} height={size} />
    </span>
  );
}

/* ---------------------------------------------------------------
   Press-to-lift wrapper — "Cards should lift slightly on press,
   glow softly, feel responsive." Pure CSS transform + local state,
   no external animation library.
--------------------------------------------------------------- */
export function useManniPress() {
  const [pressed, setPressed] = useState(false);
  return {
    pressed,
    handlers: {
      onPointerDown: () => setPressed(true),
      onPointerUp: () => setPressed(false),
      onPointerLeave: () => setPressed(false),
      onPointerCancel: () => setPressed(false),
    },
  };
}

export function ManniPressable({
  children,
  style,
  glowColor = "rgba(244, 143, 177, 0.35)",
  onClick,
  ...rest
}: {
  children: ReactNode;
  style?: CSSProperties;
  glowColor?: string;
  onClick?: () => void;
  [key: string]: any;
}) {
  const { pressed, handlers } = useManniPress();
  return (
    <div
      className={`manni-pressable${pressed ? " manni-pressed" : ""}`}
      onClick={onClick}
      style={{
        ...style,
        boxShadow: pressed ? `0 6px 22px ${glowColor}` : style?.boxShadow,
        cursor: onClick ? "pointer" : style?.cursor,
      }}
      {...handlers}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   Completion celebration — "hearts float upward, sparkles burst"
   for task/session completion. Self-contained: renders nothing when
   show=false, so callers can mount it unconditionally and just flip
   a boolean. Auto-visual-only — caller is responsible for turning
   `show` back off (e.g. after a timeout) so it can replay next time.
--------------------------------------------------------------- */
export function ManniCelebrationBurst({ show }: { show: boolean }) {
  if (!show) return null;
  const pieces = Array.from({ length: 7 }, (_, i) => i);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 5,
      }}
    >
      <ManniKeyframes />
      {pieces.map((i) => {
        const Icon = i % 2 === 0 ? HeartIcon : SparkleIcon;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${8 + i * 12}%`,
              bottom: "18%",
              color: i % 2 === 0 ? "#FF6B8B" : "#F8C8DC",
              animation: `manni-burst-rise ${1 + (i % 3) * 0.2}s ease-out ${i * 0.06}s 1`,
            }}
          >
            <Icon width={14 + (i % 3) * 3} height={14 + (i % 3) * 3} />
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------
   Ribbon-style achievement/status pill — "Sparkling streak
   indicators... ribbon-style achievements."
--------------------------------------------------------------- */
export function ManniRibbonBadge({
  label,
  color = "#F48FB1",
}: {
  label: string;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        borderRadius: "999px",
        background: "rgba(244, 143, 177, 0.16)",
        color,
        fontSize: "10px",
        fontWeight: 800,
        letterSpacing: "0.5px",
        animation: "manni-pop-in 320ms ease",
      }}
    >
      <RibbonIcon width={12} height={12} />
      {label}
    </span>
  );
}