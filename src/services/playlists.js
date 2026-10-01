import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  PLAYLIST_COVERS_DIR,
  ROOT_DIR,
  ensureDirectories,
  fileExists,
  readJsonWithBackup,
  relativeLocalPath,
  resolveLocalPath,
  writeJsonAtomic
} from './storage';

const PLAYLISTS_FILE = `${ROOT_DIR}playlists.json`;

async function ensureStorage() {
  await ensureDirectories([
    ROOT_DIR,
    PLAYLIST_COVERS_DIR
  ]);
}

function extensionForAsset(asset) {
  const lower =
    (asset.name || '').toLowerCase();

  if (
    lower.endsWith('.png') ||
    asset.mimeType === 'image/png'
  ) {
    return 'png';
  }

  return 'jpg';
}

async function discoverCoverPath(playlistId) {
  try {
    const files =
      await FileSystem.readDirectoryAsync(
        PLAYLIST_COVERS_DIR
      );

    const matches = files
      .filter((name) =>
        name.startsWith(`${playlistId}-`)
      )
      .sort()
      .reverse();

    return matches.length
      ? `PlaylistCovers/${matches[0]}`
      : null;
  } catch {
    return null;
  }
}

async function hydratePlaylist(original) {
  let migrated = false;

  let coverPath =
    relativeLocalPath(
      original.coverPath ||
      original.coverUri
    );

  if (
    coverPath &&
    !(await fileExists(coverPath))
  ) {
    coverPath = null;
    migrated = true;
  }

  if (!coverPath) {
    const discovered =
      await discoverCoverPath(original.id);

    if (discovered) {
      coverPath = discovered;
      migrated = true;
    }
  }

  if (
    coverPath !== original.coverPath ||
    original.coverUri
  ) {
    migrated = true;
  }

  return {
    migrated,
    playlist: {
      ...original,
      songIds: Array.isArray(original.songIds)
        ? [...original.songIds]
        : [],
      coverPath: coverPath || null,

      // Runtime-only resolved path.
      coverUri: coverPath
        ? resolveLocalPath(coverPath)
        : null
    }
  };
}

function toStoredPlaylist(playlist) {
  const {
    coverUri,
    ...rest
  } = playlist;

  return {
    ...rest,
    songIds: Array.isArray(playlist.songIds)
      ? [...playlist.songIds]
      : [],
    coverPath:
      relativeLocalPath(
        playlist.coverPath || coverUri
      ) || null
  };
}

export async function loadPlaylists() {
  await ensureStorage();

  const parsed =
    await readJsonWithBackup(
      PLAYLISTS_FILE,
      []
    );

  const storedPlaylists =
    Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.playlists)
        ? parsed.playlists
        : [];

  let migrated = !Array.isArray(parsed);
  const playlists = [];

  for (const stored of storedPlaylists) {
    const result =
      await hydratePlaylist(stored);

    if (result.migrated) migrated = true;
    playlists.push(result.playlist);
  }

  if (migrated) {
    await savePlaylists(playlists);
  }

  return playlists;
}

export async function savePlaylists(playlists) {
  await ensureStorage();

  // songIds are the stable relationship between a playlist
  // and its songs. Their order is preserved exactly.
  await writeJsonAtomic(
    PLAYLISTS_FILE,
    playlists.map(toStoredPlaylist)
  );
}

export async function pickPlaylistCover(
  playlistId,
  oldCoverUri = null
) {
  await ensureStorage();

  const result =
    await DocumentPicker.getDocumentAsync({
      type: ['image/png', 'image/jpeg'],
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
  const extension =
    extensionForAsset(asset);

  const relativePath =
    `PlaylistCovers/${playlistId}-${Date.now()}.${extension}`;

  const destination =
    resolveLocalPath(relativePath);

  await FileSystem.copyAsync({
    from: asset.uri,
    to: destination
  });

  const oldRelative =
    relativeLocalPath(oldCoverUri);

  if (
    oldRelative &&
    oldRelative !== relativePath
  ) {
    try {
      await FileSystem.deleteAsync(
        resolveLocalPath(oldRelative),
        { idempotent: true }
      );
    } catch {
      // Non-blocking.
    }
  }

  // Existing UI consumes an absolute runtime URI.
  // savePlaylists() converts it back to a relative path.
  return destination;
}

export async function deletePlaylistCover(value) {
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
