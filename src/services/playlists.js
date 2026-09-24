import * as FileSystem from 'expo-file-system/legacy';

const ROOT_DIR = `${FileSystem.documentDirectory}LocalMusic/`;
const PLAYLISTS_FILE = `${ROOT_DIR}playlists.json`;

async function ensureStorage() {
  const info = await FileSystem.getInfoAsync(ROOT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ROOT_DIR, { intermediates: true });
  }
}

export async function loadPlaylists() {
  await ensureStorage();

  try {
    const info = await FileSystem.getInfoAsync(PLAYLISTS_FILE);
    if (!info.exists) return [];

    const raw = await FileSystem.readAsStringAsync(PLAYLISTS_FILE);
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePlaylists(playlists) {
  await ensureStorage();
  await FileSystem.writeAsStringAsync(
    PLAYLISTS_FILE,
    JSON.stringify(playlists, null, 2)
  );
}
