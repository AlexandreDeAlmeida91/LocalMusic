import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ARTWORK_DIR,
  ensureDirectories,
  relativeLocalPath,
  resolveLocalPath
} from './storage';

// Custom covers never overwrite the artwork extracted from ID3 tags.
// Filenames and JSON store only paths relative to Documents/LocalMusic/.
const CUSTOM_DIR = `${ARTWORK_DIR}Custom/`;

function imageExtension(asset) {
  const type = String(asset?.mimeType || '').toLowerCase();
  const name = String(asset?.fileName || asset?.name || asset?.uri || '').toLowerCase();

  if (type === 'image/png' || /\.png(?:\?|$)/.test(name)) return 'png';
  if (type === 'image/jpeg' || /\.jpe?g(?:\?|$)/.test(name)) return 'jpg';
  // iPhone photos may use HEIC; the Photos picker with allowsEditing
  // produces a normalized JPEG whenever possible.
  if (type === 'image/heic' || /\.heic(?:\?|$)/.test(name)) return 'heic';
  if (type === 'image/heif' || /\.heif(?:\?|$)/.test(name)) return 'heif';
  return null;
}

async function selectImage(source) {
  if (source === 'photos') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      allowsMultipleSelection: false
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0];
  }

  if (source === 'files') {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
      multiple: false,
      copyToCacheDirectory: true
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0];
  }

  throw new Error('Source de la pochette inconnue.');
}

// Return a relative path or null when the user cancels the picker.
export async function pickCustomSongArtwork(songId, source) {
  const asset = await selectImage(source);
  if (!asset) return null;

  const extension = imageExtension(asset);
  if (!extension) {
    throw new Error('Image non reconnue. Choisis un fichier JPG, PNG ou HEIC.');
  }

  await ensureDirectories([ARTWORK_DIR, CUSTOM_DIR]);

  const safeId = String(songId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const relative = `Artwork/Custom/${safeId}-${unique}.${extension}`;

  await FileSystem.copyAsync({
    from: asset.uri,
    to: resolveLocalPath(relative)
  });

  return relative;
}

export async function deleteCustomSongArtwork(path) {
  const relative = relativeLocalPath(path);
  // Never delete embedded ID3 artwork or any other file.
  if (!relative?.startsWith('Artwork/Custom/')) return;
  try {
    await FileSystem.deleteAsync(resolveLocalPath(relative), {
      idempotent: true
    });
  } catch {
    // A missing older cover does not affect the new one.
  }
}
