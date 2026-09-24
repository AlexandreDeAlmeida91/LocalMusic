import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const ROOT_DIR = `${FileSystem.documentDirectory}LocalMusic/`;
const COVERS_DIR = `${ROOT_DIR}PlaylistCovers/`;
const PLAYLISTS_FILE = `${ROOT_DIR}playlists.json`;

async function ensureStorage() {
  for (const directory of [ROOT_DIR, COVERS_DIR]) {
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
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

function extensionForAsset(asset) {
  const lower = (asset.name || '').toLowerCase();
  if (lower.endsWith('.png') || asset.mimeType === 'image/png') return 'png';
  return 'jpg';
}

export async function pickPlaylistCover(playlistId, oldCoverUri = null) {
  await ensureStorage();

  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/png', 'image/jpeg'],
    multiple: false,
    copyToCacheDirectory: true
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const extension = extensionForAsset(asset);
  const destination =
    `${COVERS_DIR}${playlistId}-${Date.now()}.${extension}`;

  await FileSystem.copyAsync({
    from: asset.uri,
    to: destination
  });

  if (
    oldCoverUri &&
    oldCoverUri.startsWith(COVERS_DIR) &&
    oldCoverUri !== destination
  ) {
    try {
      await FileSystem.deleteAsync(oldCoverUri, { idempotent: true });
    } catch {
      // Non-blocking.
    }
  }

  return destination;
}

export async function deletePlaylistCover(uri) {
  if (!uri || !uri.startsWith(COVERS_DIR)) return;

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Non-blocking.
  }
}
