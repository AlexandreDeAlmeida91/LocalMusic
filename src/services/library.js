import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { readId3Metadata } from './id3';

const MUSIC_DIR = `${FileSystem.documentDirectory}LocalMusic/`;
const LIBRARY_FILE = `${FileSystem.documentDirectory}LocalMusic/library.json`;

async function ensureStorage() {
  const info = await FileSystem.getInfoAsync(MUSIC_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MUSIC_DIR, { intermediates: true });
  }
}

export async function loadLibrary() {
  await ensureStorage();

  try {
    const info = await FileSystem.getInfoAsync(LIBRARY_FILE);
    if (!info.exists) return [];

    const raw = await FileSystem.readAsStringAsync(LIBRARY_FILE);
    const songs = JSON.parse(raw);

    const existing = [];
    for (const song of songs) {
      const fileInfo = await FileSystem.getInfoAsync(song.uri);
      if (fileInfo.exists) existing.push(song);
    }

    return existing.sort((a, b) =>
      a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
    );
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

    imported.push({
      id,
      uri: destination,
      fileName,
      originalName: asset.name || fileName,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      artworkUri: metadata.artworkUri,
      addedAt: new Date().toISOString()
    });
  }

  return imported;
}

export async function deleteSongFile(song) {
  try {
    const info = await FileSystem.getInfoAsync(song.uri);
    if (info.exists) {
      await FileSystem.deleteAsync(song.uri, { idempotent: true });
    }
  } catch {
    // Suppression de la bibliothèque quand même.
  }
}
