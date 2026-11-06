import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { normalizeMp3 } from './mp3Normalize';

// Writes a NEW file only. The caller commits its path after durable metadata save.
export async function createNormalizedMp3(source, destination, metadata) {
  const input = new File(source);
  if (!input.exists || input.size > 64 * 1024 * 1024) return { changed: false, reason: 'Réparation limitée aux MP3 de 64 Mo maximum.' };
  const result = normalizeMp3(await input.bytes(), metadata);
  if (!result.changed) return result;
  try {
    new File(destination).write(result.bytes);
    const info = await FileSystem.getInfoAsync(destination);
    if (!info.exists || info.size !== result.bytes.length) throw new Error('Écriture du MP3 réparé incomplète.');
    return { changed: true, uri: destination, duration: result.duration };
  } catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
    throw error;
  }
}
