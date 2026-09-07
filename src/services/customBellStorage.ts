import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '../lib/supabaseClient';

const BUCKET = 'custom-audio';
const MAP_KEY = 'custom_bell_local_files';

interface LocalBellMap {
  [alarmId: string]: {
    fileName: string;
    cachedAt: string;
  };
}

async function getMap(): Promise<LocalBellMap> {
  const { value } = await Preferences.get({ key: MAP_KEY });
  return value ? JSON.parse(value) : {};
}

async function saveMap(map: LocalBellMap): Promise<void> {
  await Preferences.set({ key: MAP_KEY, value: JSON.stringify(map) });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Filesystem.writeFile wants raw base64 — strip the "data:...;base64," prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Downloads (if not already cached) the given custom alarm's audio file to
// local device storage, so a future native alarm can play it even with no
// network and even if the app is fully closed. Returns the local filename
// (relative to Directory.Data) to hand to the native plugin, or null if the
// download failed — callers should fall back to a builtin bell in that case,
// same as everywhere else in the app.
export async function ensureCustomBellDownloaded(alarmId: string): Promise<string | null> {
  const map = await getMap();
  if (map[alarmId]) {
    return map[alarmId].fileName;
  }

  try {
    const { data, error } = await supabase
      .from('alarms')
      .select('storage_path')
      .eq('id', alarmId)
      .maybeSingle();

    if (error || !data?.storage_path) return null;

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.storage_path, 300);

    if (signError || !signed?.signedUrl) return null;

    const response = await fetch(signed.signedUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    const base64Data = await blobToBase64(blob);

    const extension = data.storage_path.split('.').pop() || 'mp3';
    const fileName = `custom_bell_${alarmId}.${extension}`;

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    map[alarmId] = { fileName, cachedAt: new Date().toISOString() };
    await saveMap(map);

    return fileName;
  } catch (err) {
    console.warn('Custom bell download failed:', err);
    return null;
  }
}

// Returns the local filename for an already-downloaded custom bell without
// triggering a fresh download — used at the moment we actually schedule a
// native alarm, once Half B (the native plugin) exists to consume it.
export async function getCachedCustomBellFileName(alarmId: string): Promise<string | null> {
  const map = await getMap();
  return map[alarmId]?.fileName || null;
}
