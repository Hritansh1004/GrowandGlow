import { SVGProps } from "react";

// Cute pastel-flat preset avatars for the profile picture picker. Each one
// is a self-contained circular illustration (background + face), sized via
// the standard width/height/viewBox pattern so they drop into the same
// picker grid at any size. AVATAR_PRESETS at the bottom is what Profile.tsx
// should actually map over — each entry's `id` is what gets saved as the
// profile's avatar_url (as a small local reference, e.g. "preset:bunny"),
// so the exact same face renders back correctly next time.

export function BunnyAvatar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="64" height="64" viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="48" fill="#FFE1EC" />
      <ellipse cx="38" cy="22" rx="8" ry="18" fill="#FFFFFF" stroke="#F6A9C4" strokeWidth="2" />
      <ellipse cx="62" cy="22" rx="8" ry="18" fill="#FFFFFF" stroke="#F6A9C4" strokeWidth="2" />
      <ellipse cx="38" cy="24" rx="3.5" ry="10" fill="#F9C7DA" />
      <ellipse cx="62" cy="24" rx="3.5" ry="10" fill="#F9C7DA" />
      <ellipse cx="50" cy="58" rx="30" ry="26" fill="#FFFFFF" />
      <circle cx="39" cy="54" r="4" fill="#4A4453" />
      <circle cx="61" cy="54" r="4" fill="#4A4453" />
      <circle cx="30" cy="64" r="5" fill="#FBC4D4" opacity="0.8" />
      <circle cx="70" cy="64" r="5" fill="#FBC4D4" opacity="0.8" />
      <ellipse cx="50" cy="62" rx="3" ry="2.2" fill="#F498B6" />
      <path d="M50 64 Q46 70 42 67" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 64 Q54 70 58 67" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function CatAvatar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="64" height="64" viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="48" fill="#E8E1FF" />
      <path d="M28 30 L38 12 L44 32 Z" fill="#C9B8FF" />
      <path d="M72 30 L62 12 L56 32 Z" fill="#C9B8FF" />
      <ellipse cx="50" cy="58" rx="30" ry="26" fill="#F4EFFF" />
      <path d="M36 52 Q39 48 42 52" stroke="#4A4453" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M58 52 Q61 48 64 52" stroke="#4A4453" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="27" cy="63" r="5" fill="#D8C6FF" opacity="0.8" />
      <circle cx="73" cy="63" r="5" fill="#D8C6FF" opacity="0.8" />
      <path d="M50 60 L46 65 L54 65 Z" fill="#B79CF5" />
      <path d="M50 65 Q47 70 42 68" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 65 Q53 70 58 68" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M14 58 L28 60" stroke="#B79CF5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 66 L28 65" stroke="#B79CF5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M86 58 L72 60" stroke="#B79CF5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M86 66 L72 65" stroke="#B79CF5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PandaAvatar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="64" height="64" viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="48" fill="#DFF6EA" />
      <circle cx="30" cy="24" r="11" fill="#4A4453" />
      <circle cx="70" cy="24" r="11" fill="#4A4453" />
      <ellipse cx="50" cy="58" rx="30" ry="26" fill="#FFFFFF" />
      <ellipse cx="38" cy="52" rx="9" ry="11" fill="#4A4453" />
      <ellipse cx="62" cy="52" rx="9" ry="11" fill="#4A4453" />
      <circle cx="38" cy="53" r="3" fill="#FFFFFF" />
      <circle cx="62" cy="53" r="3" fill="#FFFFFF" />
      <ellipse cx="50" cy="64" rx="4" ry="3" fill="#4A4453" />
      <path d="M50 67 Q45 72 40 69" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 67 Q55 72 60 69" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="27" cy="66" r="4.5" fill="#B9E8CE" opacity="0.9" />
      <circle cx="73" cy="66" r="4.5" fill="#B9E8CE" opacity="0.9" />
    </svg>
  );
}

export function BearAvatar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="64" height="64" viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="48" fill="#FFEBDD" />
      <circle cx="28" cy="24" r="10" fill="#E8B99A" />
      <circle cx="72" cy="24" r="10" fill="#E8B99A" />
      <ellipse cx="50" cy="58" rx="30" ry="26" fill="#F6D9C2" />
      <circle cx="39" cy="53" r="3.6" fill="#4A4453" />
      <circle cx="61" cy="53" r="3.6" fill="#4A4453" />
      <ellipse cx="50" cy="63" rx="10" ry="8" fill="#FFF4E8" />
      <ellipse cx="50" cy="63" rx="3.5" ry="2.6" fill="#4A4453" />
      <path d="M50 65 Q46 70 41 67" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 65 Q54 70 59 67" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="29" cy="63" r="5" fill="#F3B999" opacity="0.7" />
      <circle cx="71" cy="63" r="5" fill="#F3B999" opacity="0.7" />
    </svg>
  );
}

export function FoxAvatar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="64" height="64" viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="48" fill="#FFE9D6" />
      <path d="M26 30 L34 10 L42 30 Z" fill="#F5A15C" />
      <path d="M74 30 L66 10 L58 30 Z" fill="#F5A15C" />
      <path d="M30 24 L34 14 L38 25 Z" fill="#FFFFFF" />
      <path d="M70 24 L66 14 L62 25 Z" fill="#FFFFFF" />
      <path d="M50 34 C28 34 20 54 26 68 C32 80 68 80 74 68 C80 54 72 34 50 34 Z" fill="#F7AD6E" />
      <path d="M50 46 C40 46 36 60 40 70 C44 78 56 78 60 70 C64 60 60 46 50 46 Z" fill="#FFF4E8" />
      <path d="M36 52 Q39 48 42 52" stroke="#4A4453" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      <path d="M58 52 Q61 48 64 52" stroke="#4A4453" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      <path d="M50 60 L46 66 L54 66 Z" fill="#4A4453" />
      <path d="M50 66 Q47 70 43 68" stroke="#4A4453" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M50 66 Q53 70 57 68" stroke="#4A4453" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function UnicornAvatar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="64" height="64" viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="48" fill="#F0E8FF" />
      <path d="M48 8 L54 30 L44 28 Z" fill="#FFD9EC" stroke="#F5A9D0" strokeWidth="1.5" />
      <path d="M30 20 Q22 16 24 8 Q32 12 34 20 Z" fill="#B6E4FF" />
      <path d="M38 20 Q34 12 40 6 Q46 12 44 22 Z" fill="#FFD9EC" />
      <path d="M62 20 Q66 12 60 6 Q54 12 56 22 Z" fill="#D6C2FF" />
      <ellipse cx="32" cy="24" rx="9" ry="16" fill="#FFFFFF" stroke="#E4D3FF" strokeWidth="2" />
      <ellipse cx="68" cy="24" rx="9" ry="16" fill="#FFFFFF" stroke="#E4D3FF" strokeWidth="2" />
      <ellipse cx="50" cy="58" rx="29" ry="25" fill="#FFFFFF" />
      <circle cx="39" cy="54" r="4" fill="#4A4453" />
      <circle cx="61" cy="54" r="4" fill="#4A4453" />
      <circle cx="29" cy="64" r="4.5" fill="#F5C6DE" opacity="0.8" />
      <circle cx="71" cy="64" r="4.5" fill="#F5C6DE" opacity="0.8" />
      <ellipse cx="50" cy="62" rx="3" ry="2.2" fill="#E699C4" />
      <path d="M50 64 Q46 69 41 67" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 64 Q54 69 59 67" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function StrawberryAvatar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="64" height="64" viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="48" fill="#FFE3E3" />
      <path d="M50 18 L40 10 L46 22 L34 16 L42 26 Z" fill="#8FD19E" />
      <path d="M50 18 L60 10 L54 22 L66 16 L58 26 Z" fill="#8FD19E" />
      <path d="M50 28 C28 28 22 52 32 70 C38 82 62 82 68 70 C78 52 72 28 50 28 Z" fill="#FF8FA3" />
      <circle cx="38" cy="46" r="2" fill="#FFE3E3" />
      <circle cx="50" cy="42" r="2" fill="#FFE3E3" />
      <circle cx="62" cy="46" r="2" fill="#FFE3E3" />
      <circle cx="33" cy="58" r="2" fill="#FFE3E3" />
      <circle cx="50" cy="62" r="2" fill="#FFE3E3" />
      <circle cx="67" cy="58" r="2" fill="#FFE3E3" />
      <circle cx="41" cy="58" r="3.4" fill="#4A4453" />
      <circle cx="59" cy="58" r="3.4" fill="#4A4453" />
      <circle cx="30" cy="66" r="4.5" fill="#FFB6C7" opacity="0.9" />
      <circle cx="70" cy="66" r="4.5" fill="#FFB6C7" opacity="0.9" />
      <path d="M50 68 Q45 73 40 70" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 68 Q55 73 60 70" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function FlowerAvatar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="64" height="64" viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="48" fill="#FFF6D9" />
      <g fill="#FFD1E3">
        <ellipse cx="50" cy="24" rx="12" ry="16" />
        <ellipse cx="50" cy="76" rx="12" ry="16" />
        <ellipse cx="24" cy="50" rx="16" ry="12" />
        <ellipse cx="76" cy="50" rx="16" ry="12" />
      </g>
      <g fill="#FFE1EC">
        <ellipse cx="32" cy="32" rx="11" ry="14" transform="rotate(-45 32 32)" />
        <ellipse cx="68" cy="32" rx="11" ry="14" transform="rotate(45 68 32)" />
        <ellipse cx="32" cy="68" rx="11" ry="14" transform="rotate(45 32 68)" />
        <ellipse cx="68" cy="68" rx="11" ry="14" transform="rotate(-45 68 68)" />
      </g>
      <circle cx="50" cy="50" r="20" fill="#FFF1B8" />
      <circle cx="42" cy="47" r="3.6" fill="#4A4453" />
      <circle cx="58" cy="47" r="3.6" fill="#4A4453" />
      <circle cx="34" cy="54" r="4" fill="#FFC98F" opacity="0.8" />
      <circle cx="66" cy="54" r="4" fill="#FFC98F" opacity="0.8" />
      <path d="M50 53 Q45 58 40 55" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 53 Q55 58 60 55" stroke="#4A4453" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export interface AvatarPreset {
  id: string;
  label: string;
  Component: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

// Profile.tsx should map over this to render the picker grid, and save
// `preset:${id}` (e.g. "preset:bunny") as the profile's avatar_url when
// the user picks one instead of uploading a photo.
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "bunny", label: "Bunny", Component: BunnyAvatar },
  { id: "cat", label: "Cat", Component: CatAvatar },
  { id: "panda", label: "Panda", Component: PandaAvatar },
  { id: "bear", label: "Bear", Component: BearAvatar },
  { id: "fox", label: "Fox", Component: FoxAvatar },
  { id: "unicorn", label: "Unicorn", Component: UnicornAvatar },
  { id: "strawberry", label: "Strawberry", Component: StrawberryAvatar },
  { id: "flower", label: "Flower", Component: FlowerAvatar },
];

// Given a profile's stored avatar_url, returns the matching preset's
// component if it's a "preset:xxx" reference, otherwise null (meaning
// it's a real uploaded photo URL and should be rendered as an <img>).
export function getAvatarPreset(avatarUrl?: string | null): AvatarPreset | null {
  if (!avatarUrl || !avatarUrl.startsWith("preset:")) return null;
  const id = avatarUrl.replace("preset:", "");
  return AVATAR_PRESETS.find((p) => p.id === id) || null;
}
