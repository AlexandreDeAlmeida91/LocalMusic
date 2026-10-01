import * as FileSystem from 'expo-file-system/legacy';

export const ROOT_DIR = `${FileSystem.documentDirectory}LocalMusic/`;
export const MUSIC_DIR = `${ROOT_DIR}Music/`;
export const ARTWORK_DIR = `${ROOT_DIR}Artwork/`;
export const LYRICS_DIR = `${ROOT_DIR}Lyrics/`;
export const PLAYLIST_COVERS_DIR = `${ROOT_DIR}PlaylistCovers/`;

const OLD_ROOT_MARKER = '/Documents/LocalMusic/';

export async function ensureDirectories(directories) {
  for (const directory of directories) {
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directory, {
        intermediates: true
      });
    }
  }
}

export function relativeLocalPath(value) {
  if (!value || typeof value !== 'string') return null;

  if (value.startsWith(ROOT_DIR)) {
    return value.slice(ROOT_DIR.length);
  }

  // iOS may change the application-container UUID after an update.
  // Keep only the stable path below Documents/LocalMusic/.
  const normalized = value.replace(/\\/g, '/');
  const markerIndex = normalized.indexOf(OLD_ROOT_MARKER);

  if (markerIndex >= 0) {
    return normalized.slice(
      markerIndex + OLD_ROOT_MARKER.length
    );
  }

  if (normalized.startsWith('LocalMusic/')) {
    return normalized.slice('LocalMusic/'.length);
  }

  // Already stored as a relative LocalMusic path.
  if (
    !normalized.includes('://') &&
    !normalized.startsWith('/')
  ) {
    return normalized.replace(/^\/+/, '');
  }

  return null;
}

export function resolveLocalPath(value) {
  if (!value || typeof value !== 'string') return null;

  const relative = relativeLocalPath(value);
  if (relative) {
    return `${ROOT_DIR}${relative}`;
  }

  // Keep non-LocalMusic URLs/data URIs unchanged when necessary.
  return value;
}

export async function fileExists(value) {
  const uri = resolveLocalPath(value);
  if (!uri) return false;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

async function readJsonFile(uri) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return null;

  const raw = await FileSystem.readAsStringAsync(uri);
  return JSON.parse(raw);
}

export async function readJsonWithBackup(uri, fallbackValue) {
  try {
    const parsed = await readJsonFile(uri);
    if (parsed !== null) return parsed;
  } catch {
    // Try the last known-good backup.
  }

  try {
    const parsedBackup = await readJsonFile(`${uri}.bak`);
    if (parsedBackup !== null) return parsedBackup;
  } catch {
    // Fall through to the caller's safe fallback.
  }

  return fallbackValue;
}

export async function writeJsonAtomic(uri, value) {
  const tempUri = `${uri}.tmp`;
  const backupUri = `${uri}.bak`;
  const serialized = JSON.stringify(value, null, 2);

  await FileSystem.deleteAsync(tempUri, { idempotent: true });
  await FileSystem.writeAsStringAsync(tempUri, serialized);

  const currentInfo = await FileSystem.getInfoAsync(uri);

  if (currentInfo.exists) {
    await FileSystem.deleteAsync(backupUri, { idempotent: true });
    await FileSystem.copyAsync({
      from: uri,
      to: backupUri
    });
  }

  await FileSystem.deleteAsync(uri, { idempotent: true });
  await FileSystem.moveAsync({
    from: tempUri,
    to: uri
  });
}
