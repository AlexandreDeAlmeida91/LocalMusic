import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { readId3Metadata } from './id3';

const ROOT_DIR = `${FileSystem.documentDirectory}LocalMusic/`;
const MUSIC_DIR = `${ROOT_DIR}Music/`;
const ARTWORK_DIR = `${ROOT_DIR}Artwork/`;
const LIBRARY_FILE = `${ROOT_DIR}library.json`;

async function ensureStorage() {
  for (const directory of [ROOT_DIR, MUSIC_DIR, ARTWORK_DIR]) {
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
  }
}

function dataUriParts(uri) {
  if (typeof uri !== 'string') return null;

  const match = uri.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/s);
  if (!match) return null;

  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  return {
    mime,
    base64: match[2],
    extension: mime === 'image/png' ? 'png' : 'jpg'
  };
}

async function persistArtworkDataUri(uri, songId) {
  const parts = dataUriParts(uri);
  if (!parts) return uri || null;

  const destination = `${ARTWORK_DIR}${songId}.${parts.extension}`;

  try {
    await FileSystem.writeAsStringAsync(destination, parts.base64, {
      encoding: FileSystem.EncodingType.Base64
    });
    return destination;
  } catch {
    return null;
  }
}

export async function loadLibrary() {
  await ensureStorage();

  try {
    const info = await FileSystem.getInfoAsync(LIBRARY_FILE);
    if (!info.exists) return [];

    const raw = await FileSystem.readAsStringAsync(LIBRARY_FILE);
    const songs = JSON.parse(raw);

    let migrated = false;
    const existing = [];

    for (const originalSong of songs) {
      const fileInfo = await FileSystem.getInfoAsync(originalSong.uri);
      if (!fileInfo.exists) continue;

      let song = originalSong;

      // V1/V1.2 stored ID3 artwork as a data URI. RNTP/iOS Now Playing works
      // more reliably with a real local file URL, so migrate it once.
      if (song.artworkUri?.startsWith('data:')) {
        const artworkUri = await persistArtworkDataUri(song.artworkUri, song.id);
        song = { ...song, artworkUri };
        migrated = true;
      }

      existing.push(song);
    }

    const sorted = existing.sort((a, b) =>
      a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
    );

    if (migrated || sorted.length !== songs.length) {
      await saveLibrary(sorted);
    }

    return sorted;
  } catch {
    return [];
  }
}

export async function saveLibrary(songs) {
  await ensureStorage();
  await FileSystem.writeAsStringAsync(
    LIBRARY_FILE,
    JSON.stringify(songs, null, 2)
  );
}

function safeExtension(name) {
  const match = name?.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() || 'mp3';
}

function titleFromFileName(name) {
  return (name || 'Morceau')
    .replace(/\.[^/.]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

export async function pickAndImportSongs() {
  await ensureStorage();

  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/mpeg',
    multiple: true,
    copyToCacheDirectory: true
  });

  if (result.canceled) return [];

  const imported = [];

  for (const asset of result.assets) {
    const extension = safeExtension(asset.name);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const fileName = `${id}.${extension}`;
    const destination = `${MUSIC_DIR}${fileName}`;

    await FileSystem.copyAsync({
      from: asset.uri,
      to: destination
    });

    const metadata = await readId3Metadata(
      destination,
      titleFromFileName(asset.name)
    );

    const artworkUri = metadata.artworkUri
      ? await persistArtworkDataUri(metadata.artworkUri, id)
      : null;

    imported.push({
      id,
      uri: destination,
      fileName,
      originalName: asset.name || fileName,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      artworkUri,
      addedAt: new Date().toISOString()
    });
  }

  return imported;
}

export async function deleteSongFile(song) {
  for (const uri of [song.uri, song.artworkUri]) {
    if (!uri || !uri.startsWith(FileSystem.documentDirectory)) continue;

    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {
      // Library deletion still succeeds if a local file was already gone.
    }
  }
}
