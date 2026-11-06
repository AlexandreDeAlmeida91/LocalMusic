import * as FileSystem from 'expo-file-system/legacy';
import { parseMusicLink } from './linkParsing';

function canonical(raw) {
  try { return parseMusicLink(raw).url; } catch { return null; }
}
export function matchesImport(song, candidate) {
  const item = typeof candidate === 'string' ? { url: candidate } : candidate;
  const url = canonical(item.url);
  let parsed;
  try { parsed = parseMusicLink(item.url); } catch { /* ID matching still works */ }
  const key = item.sourceKey || parsed?.sourceKey;
  const videoID = item.videoID || (parsed?.provider === 'youtube' ? parsed.id : null);
  return Boolean((url && canonical(song.sourceUrl) === url) ||
    (key && song.sourceKey === key) || (videoID && song.youtubeID === videoID));
}
export async function findExistingImport(songs, candidate) {
  for (const song of songs) {
    if (!matchesImport(song, candidate) || !song.uri) continue;
    const info = await FileSystem.getInfoAsync(song.uri);
    if (info.exists && !info.isDirectory && info.size > 0) return song;
  }
  return null;
}
