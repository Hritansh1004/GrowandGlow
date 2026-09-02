import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BUILTIN_ALARMS, DEFAULT_BUILTIN_ID, playBuiltinAlarm, isBuiltinAlarmId } from "../lib/alarmSounds";

const BUCKET = "custom-audio";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export interface AlarmItem {
  id: string;
  name: string;
  group: "Default Sounds" | "My Sounds";
  audioUrl?: string;
}

export interface CustomAlarmRow {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  is_builtin: boolean;
  audio_data?: string;
  created_at?: string;
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .slice(-80);
}

export default function useAlarms(userId: string | undefined | null) {
  const [customAlarms, setCustomAlarms] = useState<CustomAlarmRow[]>([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);
  const [alarmsMessage, setAlarmsMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadCustomAlarms = useCallback(async () => {
    if (!userId) {
      setCustomAlarms([]);
      setAlarmsLoading(false);
      return;
    }

    setAlarmsLoading(true);

    let localAlarms: CustomAlarmRow[] = [];
    try {
      const saved = localStorage.getItem(`benchmate_custom_audio_${userId}`);
      if (saved) {
        localAlarms = JSON.parse(saved);
      }
    } catch {}

    try {
      const { data, error } = await supabase
        .from("alarms")
        .select("*")
        .eq("user_id", userId)
        .eq("is_builtin", false)
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        // Merge with local alarms if any exist
        const combined = [...data];
        for (const loc of localAlarms) {
          if (!combined.some((c) => c.id === loc.id)) {
            combined.push(loc);
          }
        }
        setCustomAlarms(combined);
      } else {
        setCustomAlarms(localAlarms);
      }
    } catch {
      setCustomAlarms(localAlarms);
    } finally {
      setAlarmsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCustomAlarms();
  }, [loadCustomAlarms]);

  /* =======================================================
     COMBINED LIST FOR SELECTORS
  ======================================================= */

  const allAlarms: AlarmItem[] = [
    ...BUILTIN_ALARMS.map((a) => ({ id: a.id, name: a.name, group: "Default Sounds" as const })),
    ...customAlarms.map((a) => ({ id: a.id, name: a.name, group: "My Sounds" as const })),
  ];

  /* =======================================================
     UPLOAD
  ======================================================= */

  async function uploadAlarm(file: File, displayName?: string) {
    if (!userId) {
      return { success: false, error: "You are not logged in." };
    }

    if (!file) {
      return { success: false, error: "Choose an audio file first." };
    }

    if (file.size > MAX_FILE_BYTES) {
      return { success: false, error: "Audio file is too large. Max size is 10MB." };
    }

    setUploading(true);
    setAlarmsMessage("");

    const cleanName = (displayName || file.name.replace(/\.[^/.]+$/, "")).trim() || "My Custom Bell";
    const path = `${userId}/${Date.now()}_${sanitizeFileName(file.name)}`;

    // Read file to Base64 Data URL for guaranteed immediate playback & fallback
    const fileBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });

    const localId = `alarm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const localRow: CustomAlarmRow = {
      id: localId,
      user_id: userId,
      name: cleanName,
      storage_path: fileBase64 || path,
      audio_data: fileBase64,
      is_builtin: false,
      created_at: new Date().toISOString(),
    };

    let uploadedToCloud = false;
    let cloudRow: CustomAlarmRow | null = null;

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });

      if (!uploadError) {
        const { data: dbData, error: insertError } = await supabase
          .from("alarms")
          .insert({
            user_id: userId,
            name: cleanName,
            storage_path: path,
            is_builtin: false,
          })
          .select()
          .single();

        if (!insertError && dbData) {
          uploadedToCloud = true;
          cloudRow = { ...dbData, audio_data: fileBase64 };
        }
      }
    } catch {}

    const finalRow = cloudRow || localRow;

    setCustomAlarms((prev) => {
      const updated = [...prev, finalRow];
      try {
        localStorage.setItem(`benchmate_custom_audio_${userId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setUploading(false);
    setAlarmsMessage(
      uploadedToCloud
        ? "Bell sound uploaded and synced to cloud!"
        : "Bell sound uploaded and saved locally!"
    );

    return { success: true, data: finalRow };
  }

  /* =======================================================
     RENAME
  ======================================================= */

  async function renameAlarm(alarmId: string, newName: string) {
    if (!userId) return { success: false };

    const cleanName = newName.trim();
    if (!cleanName) return { success: false, error: "Name cannot be empty." };

    try {
      await supabase
        .from("alarms")
        .update({ name: cleanName })
        .eq("id", alarmId)
        .eq("user_id", userId);
    } catch {}

    setCustomAlarms((prev) => {
      const updated = prev.map((a) => (a.id === alarmId ? { ...a, name: cleanName } : a));
      try {
        localStorage.setItem(`benchmate_custom_audio_${userId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    return { success: true };
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function deleteAlarm(alarmId: string) {
    if (!userId) return { success: false };

    const target = customAlarms.find((a) => a.id === alarmId);
    if (!target) return { success: false, error: "Sound not found." };

    try {
      await supabase.from("alarms").delete().eq("id", alarmId).eq("user_id", userId);
      if (target.storage_path && !target.storage_path.startsWith("data:")) {
        await supabase.storage.from(BUCKET).remove([target.storage_path]);
      }
    } catch {}

    setCustomAlarms((prev) => {
      const updated = prev.filter((a) => a.id !== alarmId);
      try {
        localStorage.setItem(`benchmate_custom_audio_${userId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    return { success: true };
  }

  /* =======================================================
     PLAYBACK
  ======================================================= */

  async function playAlarm(alarmId: string | null | undefined) {
    if (!alarmId || isBuiltinAlarmId(alarmId)) {
      playBuiltinAlarm(alarmId || DEFAULT_BUILTIN_ID);
      return;
    }

    const target = customAlarms.find((a) => a.id === alarmId);
    if (!target) {
      playBuiltinAlarm(DEFAULT_BUILTIN_ID);
      return;
    }

    // 1. Direct Base64 / data URL playback
    if (target.audio_data && target.audio_data.startsWith("data:audio")) {
      try {
        const audio = new Audio(target.audio_data);
        audio.play().catch(() => playBuiltinAlarm(DEFAULT_BUILTIN_ID));
        return;
      } catch {
        playBuiltinAlarm(DEFAULT_BUILTIN_ID);
        return;
      }
    }

    if (target.storage_path && target.storage_path.startsWith("data:audio")) {
      try {
        const audio = new Audio(target.storage_path);
        audio.play().catch(() => playBuiltinAlarm(DEFAULT_BUILTIN_ID));
        return;
      } catch {
        playBuiltinAlarm(DEFAULT_BUILTIN_ID);
        return;
      }
    }

    // 2. Supabase Storage Signed URL
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(target.storage_path, 60);

      if (!error && data?.signedUrl) {
        const audio = new Audio(data.signedUrl);
        audio.play().catch(() => playBuiltinAlarm(DEFAULT_BUILTIN_ID));
        return;
      }
      playBuiltinAlarm(DEFAULT_BUILTIN_ID);
    } catch {
      playBuiltinAlarm(DEFAULT_BUILTIN_ID);
    }
  }

  return {
    customAlarms,
    allAlarms,
    alarmsLoading,
    alarmsMessage,
    uploading,

    setAlarmsMessage,
    loadCustomAlarms,
    uploadAlarm,
    renameAlarm,
    deleteAlarm,
    playAlarm,
  };
}

