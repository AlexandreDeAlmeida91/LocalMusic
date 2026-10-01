import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { readId3Metadata } from './id3';
import {
  ARTWORK_DIR,
  LYRICS_DIR,
  MUSIC_DIR,
  ROOT_DIR,
  ensureDirectories,
  fileExists,
  readJsonWithBackup,
  relativeLocalPath,
  resolveLocalPath,
  writeJsonAtomic
} from './storage';

const LIBRARY_FILE = `${ROOT_DIR}library.json`;

async function ensureStorage() {
  await ensureDirectories([
    ROOT_DIR,
    MUSIC_DIR,
    ARTWORK_DIR,
    LYRICS_DIR
  ]);
}

function dataUriParts(uri) {
  if (typeof uri !== 'string') return null;

  const match = uri.match(
    /^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/s
  );
  if (!match) return null;

  const mime =
    match[1] === 'image/jpg'
      ? 'image/jpeg'
      : match[1];

  return {
    mime,
    base64: match[2],
    extension: mime === 'image/png' ? 'png' : 'jpg'
  };
}

async function persistArtworkDataUri(uri, songId) {
  const parts = dataUriParts(uri);
  if (!parts) return null;

  const relativePath =
    `Artwork/${songId}.${parts.extension}`;
  const destination = `${ROOT_DIR}${relativePath}`;

  try {
    await FileSystem.writeAsStringAsync(
      destination,
      parts.base64,
      {
        encoding: FileSystem.EncodingType.Base64
      }
    );

    return {
      artworkPath: relativePath,
      artworkUri: destination
    };
  } catch {
    return null;
  }
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

function songIdFromFileName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '');
}

async function firstExistingArtwork(songId) {
  try {
    const files = await FileSystem.readDirectoryAsync(
      ARTWORK_DIR
    );

    const match = files.find((name) =>
      name.startsWith(`${songId}.`)
    );

    return match ? `Artwork/${match}` : null;
  } catch {
    return null;
  }
}

async function lyricsPathForSong(songId) {
  const path = `Lyrics/${songId}.txt`;
  return (await fileExists(path)) ? path : null;
}

async function hydrateSong(originalSong) {
  let migrated = false;

  let audioPath =
    relativeLocalPath(
      originalSong.audioPath || originalSong.uri
    ) ||
    (originalSong.fileName
      ? `Music/${originalSong.fileName}`
      : null);

  if (!audioPath || !(await fileExists(audioPath))) {
    if (originalSong.fileName) {
      const fallbackPath =
        `Music/${originalSong.fileName}`;

      if (await fileExists(fallbackPath)) {
        audioPath = fallbackPath;
        migrated = true;
      }
    }
  }

  if (!audioPath || !(await fileExists(audioPath))) {
    return {
      song: null,
      migrated
    };
  }

  let artworkPath =
    relativeLocalPath(
      originalSong.artworkPath ||
      (
        originalSong.artworkUri?.startsWith('data:')
          ? null
          : originalSong.artworkUri
      )
    );

  if (originalSong.artworkUri?.startsWith('data:')) {
    const persisted = await persistArtworkDataUri(
      originalSong.artworkUri,
      originalSong.id
    );

    if (persisted) {
      artworkPath = persisted.artworkPath;
    }

    migrated = true;
  }

  if (
    artworkPath &&
    !(await fileExists(artworkPath))
  ) {
    artworkPath = null;
    migrated = true;
  }

  if (!artworkPath) {
    const discovered =
      await firstExistingArtwork(originalSong.id);

    if (discovered) {
      artworkPath = discovered;
      migrated = true;
    }
  }

  let lyricsPath =
    relativeLocalPath(
      originalSong.lyricsPath ||
      originalSong.lyricsUri
    );

  if (
    lyricsPath &&
    !(await fileExists(lyricsPath))
  ) {
    lyricsPath = null;
    migrated = true;
  }

  if (!lyricsPath) {
    const discoveredLyrics =
      await lyricsPathForSong(originalSong.id);

    if (discoveredLyrics) {
      lyricsPath = discoveredLyrics;
      migrated = true;
    }
  }

  if (
    audioPath !== originalSong.audioPath ||
    artworkPath !== originalSong.artworkPath ||
    lyricsPath !== originalSong.lyricsPath ||
    originalSong.uri ||
    originalSong.artworkUri ||
    originalSong.lyricsUri
  ) {
    migrated = true;
  }

  return {
    migrated,
    song: {
      ...originalSong,
      audioPath,
      artworkPath: artworkPath || null,
      lyricsPath: lyricsPath || null,

      // Runtime-only resolved paths.
      uri: resolveLocalPath(audioPath),
      artworkUri: artworkPath
        ? resolveLocalPath(artworkPath)
        : null,
      lyricsUri: lyricsPath
        ? resolveLocalPath(lyricsPath)
        : null
    }
  };
}

async function recoverOrphanSongs(existingSongs) {
  const knownFileNames = new Set(
    existingSongs
      .map((song) => song.fileName)
      .filter(Boolean)
  );

  let files = [];
  try {
    files = await FileSystem.readDirectoryAsync(
      MUSIC_DIR
    );
  } catch {
    return [];
  }

  const recovered = [];

  for (const fileName of files) {
    if (knownFileNames.has(fileName)) continue;

    const lower = fileName.toLowerCase();
    if (!lower.endsWith('.mp3')) continue;

    const id = songIdFromFileName(fileName);
    const audioPath = `Music/${fileName}`;
    const uri = resolveLocalPath(audioPath);

    try {
      const metadata = await readId3Metadata(
        uri,
        titleFromFileName(fileName)
      );

      let artworkPath =
        await firstExistingArtwork(id);

      if (!artworkPath && metadata.artworkUri) {
        const persisted =
          await persistArtworkDataUri(
            metadata.artworkUri,
            id
          );
        artworkPath =
          persisted?.artworkPath || null;
      }

      const lyricsPath =
        await lyricsPathForSong(id);

      recovered.push({
        id,
        audioPath,
        artworkPath: artworkPath || null,
        lyricsPath: lyricsPath || null,

        fileName,
        originalName: fileName,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        addedAt: new Date().toISOString(),

        // Runtime-only resolved paths.
        uri,
        artworkUri: artworkPath
          ? resolveLocalPath(artworkPath)
          : null,
        lyricsUri: lyricsPath
          ? resolveLocalPath(lyricsPath)
          : null
      });
    } catch {
      // Keep scanning other files.
    }
  }

  return recovered;
}

function toStoredSong(song) {
  const {
    uri,
    artworkUri,
    lyricsUri,
    ...rest
  } = song;

  return {
    ...rest,
    audioPath:
      relativeLocalPath(
        song.audioPath || uri
      ) || rest.audioPath || null,
    artworkPath:
      relativeLocalPath(
        song.artworkPath || artworkUri
      ) || null,
    lyricsPath:
      relativeLocalPath(
        song.lyricsPath || lyricsUri
      ) || null
  };
}

export async function loadLibrary() {
  await ensureStorage();

  const parsed = await readJsonWithBackup(
    LIBRARY_FILE,
    []
  );

  const storedSongs = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.songs)
      ? parsed.songs
      : [];

  let migrated = !Array.isArray(parsed);
  const hydrated = [];

  for (const storedSong of storedSongs) {
    const result = await hydrateSong(storedSong);

    if (result.migrated) migrated = true;
    if (result.song) hydrated.push(result.song);
  }

  // Important recovery path:
  // older versions could erase library.json entries after an iOS
  // container UUID change while leaving the MP3 files on disk.
  const recovered =
    await recoverOrphanSongs(hydrated);

  if (recovered.length) {
    hydrated.push(...recovered);
    migrated = true;
  }

  const sorted = hydrated.sort((a, b) =>
    a.title.localeCompare(
      b.title,
      'fr',
      { sensitivity: 'base' }
    )
  );

  if (
    migrated ||
    sorted.length !== storedSongs.length
  ) {
    await saveLibrary(sorted);
  }

  return sorted;
}

export async function saveLibrary(songs) {
  await ensureStorage();

  await writeJsonAtomic(
    LIBRARY_FILE,
    songs.map(toStoredSong)
  );
}

export async function pickAndImportSongs() {
  await ensureStorage();

  const result =
    await DocumentPicker.getDocumentAsync({
      type: 'audio/mpeg',
      multiple: true,
      copyToCacheDirectory: true
    });

  if (result.canceled) return [];

  const imported = [];

  for (const asset of result.assets) {
    const extension =
      safeExtension(asset.name);

    const id =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;

    const fileName = `${id}.${extension}`;
    const audioPath = `Music/${fileName}`;
    const destination =
      resolveLocalPath(audioPath);

    await FileSystem.copyAsync({
      from: asset.uri,
      to: destination
    });

    const metadata = await readId3Metadata(
      destination,
      titleFromFileName(asset.name)
    );

    let artworkPath = null;

    if (metadata.artworkUri) {
      const persisted =
        await persistArtworkDataUri(
          metadata.artworkUri,
          id
        );

      artworkPath =
        persisted?.artworkPath || null;
    }

    imported.push({
      id,
      audioPath,
      artworkPath,
      lyricsPath: null,

      fileName,
      originalName:
        asset.name || fileName,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      addedAt: new Date().toISOString(),

      // Runtime-only resolved paths.
      uri: destination,
      artworkUri: artworkPath
        ? resolveLocalPath(artworkPath)
        : null,
      lyricsUri: null
    });
  }

  return imported;
}

export async function deleteSongFile(song) {
  const paths = [
    song.audioPath || song.uri,
    song.artworkPath || song.artworkUri,
    song.lyricsPath || song.lyricsUri
  ];

  for (const value of paths) {
    const relative =
      relativeLocalPath(value);

    if (!relative) continue;

    try {
      const uri = resolveLocalPath(relative);
      const info =
        await FileSystem.getInfoAsync(uri);

      if (info.exists) {
        await FileSystem.deleteAsync(uri, {
          idempotent: true
        });
      }
    } catch {
      // Metadata deletion still succeeds if a file
      // was already missing.
    }
  }
}
