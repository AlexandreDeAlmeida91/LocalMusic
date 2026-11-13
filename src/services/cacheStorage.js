import {requireOptionalNativeModule} from 'expo';
import * as FS from 'expo-file-system/legacy';
import {ROOT_DIR, ARTWORK_DIR} from './storage';
export const CACHE_DIR = `${FS.cacheDirectory}PeakCache/`;
export const IMPORT_CACHE = `${FS.cacheDirectory}PeakImports/`;
let active = 0;
let cleaning = false;
export function beginCacheWork() {
  if (cleaning) throw new Error('Une sauvegarde, restauration ou un nettoyage est en cours.');
  active++;
  let ended = false;
  return () => { if (!ended) { ended = true; active--; } };
}
export function beginExclusiveStorageWork() {
  if (active || cleaning) throw new Error('Attends la fin des imports et recherches avant la sauvegarde ou la restauration.');
  cleaning=true;
  let ended=false;
  return ()=>{if(!ended){ended=true;cleaning=false;}};
}
// File URIs must not have an extra slash: directories are inspected first.
async function bytes(uri) {
  const info = await FS.getInfoAsync(uri);
  if (!info.exists) return 0;
  if (!info.isDirectory) return info.size || 0;
  let total = 0;
  for (const name of await FS.readDirectoryAsync(uri)) total += await bytes(`${uri.replace(/\/$/,'')}/${name}`);
  return total;
}
export async function storageUsage() {
  const [audio, artwork, lyrics, cache, imports, background] = await Promise.all([
    bytes(`${ROOT_DIR}Music/`), bytes(ARTWORK_DIR), bytes(`${ROOT_DIR}Lyrics/`), bytes(CACHE_DIR), bytes(IMPORT_CACHE), bytes(`${FS.cacheDirectory}PeakBackgroundImports/`)
  ]);
  return {audio, artwork, lyrics, cache:cache + imports + background};
}
export async function clearAppCache() {
  if (active || cleaning) throw new Error('Attends la fin des imports ou des recherches avant de vider le cache.');
  cleaning = true;
  try {
    await requireOptionalNativeModule('PeakImport')?.clearBackgroundDownloads?.();
    await FS.deleteAsync(CACHE_DIR, {idempotent:true});
    await FS.deleteAsync(IMPORT_CACHE, {idempotent:true});
  } finally { cleaning = false; }
}
let startup;
export function cleanupStartup() {
  return startup ||= (async () => {
    await requireOptionalNativeModule('PeakBackup')?.recoverRestore?.();
    // Called before imports become available, once per process. Never delete Music.
    await FS.deleteAsync(IMPORT_CACHE, {idempotent:true}).catch(() => {});
    const info = await FS.getInfoAsync(ARTWORK_DIR);
    if (info.exists) for (const name of await FS.readDirectoryAsync(ARTWORK_DIR)) {
      if (/^[a-zA-Z0-9_-]+-online\.tmp$/.test(name)) await FS.deleteAsync(ARTWORK_DIR + name,{idempotent:true}).catch(() => {});
    }
  })();
}
