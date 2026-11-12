import {findOnlineLyrics as find, searchLyricsChoices as search, lyricIdentity, key} from './onlineLyrics';
import {CACHE_DIR, beginCacheWork} from './cacheStorage';
import {ensureDirectories, readJsonWithBackup, writeJsonAtomic} from './storage';
import {serialQueue} from './workQueue';
const serial = serialQueue();
const path = `${CACHE_DIR}lyrics.json`;
let lastRequest = 0;
async function cached(id, signal, force, work) {
  return serial(async () => {
    if (signal?.aborted) throw new Error('Recherche annulée');
    const finish = beginCacheWork();
    try {
      const stored = await readJsonWithBackup(path, []);
      const entries = Array.isArray(stored) ? stored : [];
      const hit = entries.find(e => e.id === id && e.expires > Date.now());
      if (hit && !force) return hit.value;
      // Serialize requests so two import workers do not trigger the rate limiter.
      const delay = Math.max(0, 550 - (Date.now() - lastRequest));
      if (delay) await new Promise(resolve => setTimeout(resolve,delay));
      if (signal?.aborted) throw new Error('Recherche annulée');
      lastRequest = Date.now();
      const value = await work();
      if (signal?.aborted) throw new Error('Recherche annulée');
      const successful = Array.isArray(value) ? value.length > 0 : !!value.text;
      // Cache genuine misses, never cancellation or service failures.
      if (Array.isArray(value) || successful || /introuvable|Instrumental/.test(value.status || '')) {
        const expires = Date.now() + (successful ? 30 : 1) * 86400000;
        await ensureDirectories([CACHE_DIR]);
        await writeJsonAtomic(path,[{id,value,expires},...entries.filter(e=>e.id!==id && e.expires>Date.now())].slice(0,60)).catch(()=>{});
      }
      return value;
    } finally { finish(); }
  });
}
export function findOnlineLyrics(metadata, signal, force=false) {
  const q=lyricIdentity(metadata);
  return cached(`auto:${key(q.artist)}|${key(q.title)}`,signal,force,()=>find(metadata,signal));
}
export function searchLyricsChoices(title,artist,signal,force=false) {
  return cached(`choices:${key(artist)}|${key(title)}`,signal,force,()=>search(title,artist,signal));
}
