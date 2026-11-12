import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { readId3Metadata } from './id3';
import { createNormalizedAudio } from './audioRepair';
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

  // A manually selected cover takes priority over the embedded ID3 cover,
  // which is kept for restoration if the custom cover is removed.
  let customArtworkPath = relativeLocalPath(originalSong.customArtworkPath);
  if (customArtworkPath && !(await fileExists(customArtworkPath))) {
    customArtworkPath = null;
    migrated = true;
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
    customArtworkPath !== (originalSong.customArtworkPath || null) ||
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
      customArtworkPath: customArtworkPath || null,
      lyricsPath: lyricsPath || null,

      // Runtime-only resolved paths. Custom cover wins over ID3 cover.
      uri: resolveLocalPath(audioPath),
      artworkUri: (customArtworkPath || artworkPath)
        ? resolveLocalPath(customArtworkPath || artworkPath)
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
      .flatMap((song) => [song.fileName, song.originalAudioPath?.split('/').pop()])
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
    if (!/\.(mp3|m4a)$/.test(lower)) continue;

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
        customArtworkPath: null,
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
      ) || null,
    customArtworkPath: relativeLocalPath(song.customArtworkPath) || null
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

  // Existing installations also release tracked originals after loading.
  await cleanupNormalizedOriginals(sorted);
  return sorted;
}

export async function saveLibrary(songs) {
  await ensureStorage();

  await writeJsonAtomic(
    LIBRARY_FILE,
    songs.map(toStoredSong)
  );
  // Delete only after the corrected path has been committed successfully.
  await cleanupNormalizedOriginals(songs);
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

    let repaired = null;
    const normalizedName = `${id}-normalized.${extension}`;
    const normalizedPath = `Music/${normalizedName}`;
    if (['mp3', 'm4a'].includes(extension)) {
      repaired = await createNormalizedAudio(destination, resolveLocalPath(normalizedPath), metadata);
    }

    imported.push({
      id,
      audioPath: repaired?.changed ? normalizedPath : audioPath,
      audioRepairVersion: repaired?.changed ? 1 : null,
      originalAudioPath: repaired?.changed ? audioPath : null,
      duration: repaired?.duration,
      artworkPath,
      customArtworkPath: null,
      lyricsPath: null,

      fileName: repaired?.changed ? normalizedName : fileName,
      originalName:
        asset.name || fileName,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      addedAt: new Date().toISOString(),

      // Runtime-only resolved paths.
      uri: repaired?.changed ? repaired.uri : destination,
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
    song.originalAudioPath,
    song.artworkPath,
    song.customArtworkPath,
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

// Native imports arrive in the app cache, then move into the same durable library
// as manually imported files. Commit metadata before exposing the song in the UI.
export async function commitDownloadedSong(download, songs) {
  await ensureStorage();
  const duplicate = songs.find(song => (download.sourceKey && song.sourceKey === download.sourceKey) ||
    (download.youtubeID && song.youtubeID === download.youtubeID));
  const duplicateInfo = duplicate?.uri ? await FileSystem.getInfoAsync(duplicate.uri) : null;
  if (duplicateInfo?.exists && !duplicateInfo.isDirectory && duplicateInfo.size > 0) {
    await FileSystem.deleteAsync(download.uri, { idempotent: true });
    return { songs, song: duplicate, duplicate: true };
  }
  if (!['mp3', 'm4a'].includes(download.extension) ||
      !download.uri?.startsWith(FileSystem.cacheDirectory)) {
    throw new Error('Le moteur a renvoyé un fichier non valide.');
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const fileName = `${id}.${download.extension}`;
  const audioPath = `Music/${fileName}`;
  const uri = resolveLocalPath(audioPath);
  const song = {
    id: duplicate?.id || id, fileName, audioPath, uri,
    originalName: `${download.title}.${download.extension}`,
    title: download.title, artist: download.artist, album: '',
    duration: download.duration, sourceKey: download.sourceKey,
    sourceUrl: download.sourceUrl, youtubeID: download.youtubeID,
    artworkPath: null, artworkUri: null, customArtworkPath: null,
    lyricsPath: null, lyricsUri: null, addedAt: new Date().toISOString()
  };
  if (['mp3', 'm4a'].includes(download.extension)) {
    const normalizedPath = `Music/${id}-normalized.${download.extension}`;
    const repaired = await createNormalizedAudio(download.uri, resolveLocalPath(normalizedPath), song);
    if (repaired.changed) {
      song.audioPath = normalizedPath;
      song.uri = repaired.uri;
      song.fileName = `${id}-normalized.${download.extension}`;
      song.originalAudioPath = audioPath;
      song.audioRepairVersion = 1;
      song.duration = repaired.duration;
    }
  }
  if (duplicate) {
    for (const key of ['title', 'artist', 'album', 'artworkPath', 'artworkUri', 'customArtworkPath', 'lyricsPath', 'lyricsUri', 'addedAt']) {
      if (duplicate[key] != null) song[key] = duplicate[key];
    }
  }
  let importedArtwork = null;
  if (!song.artworkUri && !song.customArtworkPath) {
    importedArtwork = await downloadSongArtwork(download.artworkCandidates, id);
    if (importedArtwork) {
      song.artworkPath = importedArtwork.path;
      song.artworkUri = resolveLocalPath(importedArtwork.path);
      song.artworkSource = importedArtwork.source;
    }
  }
  const merged = [...songs.filter(item => item.id !== duplicate?.id), song].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
  try {
    await FileSystem.moveAsync({ from: download.uri, to: uri });
    await saveLibrary(merged);
  } catch (error) {
    if (importedArtwork) await FileSystem.deleteAsync(resolveLocalPath(importedArtwork.path), { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(uri, { idempotent: true });
    if (song.uri !== uri) await FileSystem.deleteAsync(song.uri, { idempotent: true });
    throw error;
  }
  return { songs: merged, song, duplicate: false };
}

export async function repairStoredSong(song, currentSongsOrGetter) {
  const getSongs = typeof currentSongsOrGetter === 'function' ? currentSongsOrGetter : () => currentSongsOrGetter;
  let currentSongs = getSongs();
  if (song.audioRepairVersion === 1) return { songs: currentSongs, song, changed: false, reason: 'Ce morceau a déjà été normalisé.' };
  const extension = (song.audioPath || song.uri || '').match(/\.(mp3|m4a)$/i)?.[1]?.toLowerCase();
  if (!extension) throw new Error('Cette réparation concerne les fichiers MP3 et M4A.');
  const audioPath = `Music/${song.id}-repair-${Date.now()}.${extension}`;
  const result = await createNormalizedAudio(song.uri, resolveLocalPath(audioPath), song);
  if (!result.changed) return { ...result, songs: currentSongs, song };
  currentSongs = getSongs();
  const latest = currentSongs.find(item => item.id === song.id);
  if (!latest || latest.uri !== song.uri) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error('Le morceau a changé pendant la réparation. Réessaie.');
  }
  const updated = { ...latest, audioPath, uri: result.uri, fileName: audioPath.split('/').pop(), originalAudioPath: song.originalAudioPath || song.audioPath, audioRepairVersion: 1, duration: result.duration };
  const songs = currentSongs.map(item => item.id === song.id ? updated : item);
  try { await saveLibrary(songs); }
  catch (error) { await FileSystem.deleteAsync(result.uri, { idempotent: true }); throw error; }
  return { changed: true, songs, song: updated };
}

// Artwork is optional: an unavailable image must never fail an audio import.
export async function downloadSongArtwork(candidates, id) {
  const domains = {spotify: ['scdn.co'], soundcloud: ['sndcdn.com'], youtube: ['ytimg.com']};
  for (const candidate of (Array.isArray(candidates) ? candidates : []).slice(0, 3)) {
    let url;
    try {
      url = new URL(candidate.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !domains[candidate.source]?.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) continue;
    } catch { continue; }
    const base = `Artwork/${String(id).replace(/[^a-zA-Z0-9_-]/g,'_')}-online`;
    const temporary = resolveLocalPath(base + '.tmp');
    let task, timer, cancelled = false;
    try {
      const cancel = () => { cancelled = true; task?.cancelAsync().catch(() => {}); };
      task = FileSystem.createDownloadResumable(url.href, temporary, {}, progress => {
        if (progress.totalBytesWritten > 8_000_000 || progress.totalBytesExpectedToWrite > 8_000_000) cancel();
      });
      timer = setTimeout(cancel, 12000);
      const result = await task.downloadAsync();
      clearTimeout(timer);
      const headers = Object.fromEntries(Object.entries(result?.headers || {}).map(([k,v]) => [k.toLowerCase(),v]));
      const type = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const extension = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];
      const info = await FileSystem.getInfoAsync(temporary);
      if (cancelled || result?.status !== 200 || !extension || !info.exists || !info.size || info.size > 8_000_000) throw new Error('Invalid artwork');
      const path = base + '.' + extension;
      await FileSystem.moveAsync({from: temporary, to: resolveLocalPath(path)});
      return {path, source: candidate.source};
    } catch { /* Try the explicitly allowed fallback, then keep the placeholder. */ }
    finally {
      clearTimeout(timer);
      await FileSystem.deleteAsync(temporary, {idempotent:true}).catch(() => {});
    }
  }
  return null;
}

// Only tracked originals of successfully normalized songs are eligible.
// Keep the metadata pointer as a recovery exclusion, even after deletion.
export async function cleanupNormalizedOriginals(songs) {
  const safePath = value => {
    const path = relativeLocalPath(value);
    return typeof path === 'string' && /^Music\/[a-zA-Z0-9_-]+\.(mp3|m4a)$/i.test(path) ? path : null;
  };
  const active = new Set(songs.flatMap(song => [safePath(song.audioPath), safePath(song.uri), safePath(song.fileName ? `Music/${song.fileName}` : null)]).filter(Boolean));
  for (const song of songs) {
    if (song.audioRepairVersion !== 1 || !Number.isFinite(song.duration) || song.duration <= 0) continue;
    const original = safePath(song.originalAudioPath), corrected = safePath(song.audioPath);
    if (!original || !corrected || original === corrected || active.has(original)) continue;
    if (!/-(normalized|repair-[0-9]+)\.(mp3|m4a)$/i.test(corrected)) continue;
    try {
      const info = await FileSystem.getInfoAsync(resolveLocalPath(corrected));
      if (!info.exists || info.isDirectory || !Number.isFinite(info.size) || info.size <= 0) continue;
      await FileSystem.deleteAsync(resolveLocalPath(original), {idempotent:true});
    } catch { /* Retry on the next load/save; cleanup never fails the library. */ }
  }
}
