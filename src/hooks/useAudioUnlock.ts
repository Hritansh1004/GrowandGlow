import { useEffect } from "react";
import { unlockAudioPlayback } from "../lib/alarmSounds";

// Mount this ONCE, at the top of App.tsx, regardless of page/login state.
// Listens for the very first genuine user interaction anywhere in the app
// (a real tap satisfies the browser's autoplay-permission requirement),
// unlocks audio playback, then removes itself — this runs exactly once
// per page load, not once per period completion.
//
// This is the actual fix for "no bell ever plays automatically": without
// this, the shared AudioContext (built-in tones) and the browser's
// autoplay tracking (custom uploaded sounds) both stay locked until some
// direct click happens to trigger a sound — which the "Test" button in
// Settings and the AlarmSelector preview button do, which is exactly why
// manual previews always worked while automatic period-completion bells
// never did.
export default function useAudioUnlock() {
  useEffect(() => {
    let unlocked = false;

    function handleFirstInteraction() {
      if (unlocked) return;
      unlocked = true;

      unlockAudioPlayback();

      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    }

    window.addEventListener("pointerdown", handleFirstInteraction, { once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { once: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);
}
