import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  LYRICS_DIR,
  ROOT_DIR,
  ensureDirectories,
  relativeLocalPath,
  resolveLocalPath
} from './storage';

async function ensureStorage() {
  await ensureDirectories([
    ROOT_DIR,
    LYRICS_DIR
  ]);
}

export async function pickAndStoreLyrics(
  songId,
  oldLyricsUri = null
) {
  await ensureStorage();

  const result =
    await DocumentPicker.getDocumentAsync({
      type: 'text/plain',
      multiple: false,
      copyToCacheDirectory: true
    });

  if (
    result.canceled ||
    !result.assets?.length
  ) {
    return null;
  }

  const asset = result.assets[0];
  const fileName =
    (asset.name || '').toLowerCase();

  if (
    fileName &&
    !fileName.endsWith('.txt')
  ) {
    throw new Error(
      'Choisis un fichier de paroles au format .txt.'
    );
  }

  const relativePath =
    `Lyrics/${songId}.txt`;

  const destination =
    resolveLocalPath(relativePath);

  await FileSystem.deleteAsync(
    destination,
    { idempotent: true }
  );

  await FileSystem.copyAsync({
    from: asset.uri,
    to: destination
  });

  const oldRelative =
    relativeLocalPath(oldLyricsUri);

  if (
    oldRelative &&
    oldRelative !== relativePath
  ) {
    await FileSystem.deleteAsync(
      resolveLocalPath(oldRelative),
      { idempotent: true }
    );
  }

  // Runtime URI; saveLibrary() persists Lyrics/<id>.txt instead.
  return destination;
}

export async function readLyrics(value) {
  if (!value) return '';

  try {
    const uri = resolveLocalPath(value);
    const info =
      await FileSystem.getInfoAsync(uri);

    if (!info.exists) return '';

    const text =
      await FileSystem.readAsStringAsync(uri);

    return text
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  } catch {
    return '';
  }
}

export async function deleteLyrics(value) {
  const relative =
    relativeLocalPath(value);

  if (!relative) return;

  try {
    await FileSystem.deleteAsync(
      resolveLocalPath(relative),
      { idempotent: true }
    );
  } catch {
    // Non-blocking.
  }
}
