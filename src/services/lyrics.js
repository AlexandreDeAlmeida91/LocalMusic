import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const ROOT_DIR = `${FileSystem.documentDirectory}LocalMusic/`;
const LYRICS_DIR = `${ROOT_DIR}Lyrics/`;

async function ensureStorage() {
  for (const directory of [ROOT_DIR, LYRICS_DIR]) {
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
  }
}

export async function pickAndStoreLyrics(songId, oldLyricsUri = null) {
  await ensureStorage();

  const result = await DocumentPicker.getDocumentAsync({
    type: 'text/plain',
    multiple: false,
    copyToCacheDirectory: true
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const fileName = (asset.name || '').toLowerCase();

  if (fileName && !fileName.endsWith('.txt')) {
    throw new Error('Choisis un fichier de paroles au format .txt.');
  }

  const destination = `${LYRICS_DIR}${songId}.txt`;

  // copyAsync may fail if the destination already exists.
  await FileSystem.deleteAsync(destination, { idempotent: true });

  await FileSystem.copyAsync({
    from: asset.uri,
    to: destination
  });

  if (
    oldLyricsUri &&
    oldLyricsUri !== destination &&
    oldLyricsUri.startsWith(LYRICS_DIR)
  ) {
    await FileSystem.deleteAsync(oldLyricsUri, { idempotent: true });
  }

  return destination;
}

export async function readLyrics(uri) {
  if (!uri) return '';

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return '';

    const text = await FileSystem.readAsStringAsync(uri);
    return text
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  } catch {
    return '';
  }
}

export async function deleteLyrics(uri) {
  if (!uri || !uri.startsWith(LYRICS_DIR)) return;

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Non-blocking.
  }
}
