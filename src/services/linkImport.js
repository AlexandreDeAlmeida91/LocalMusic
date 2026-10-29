import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import {
  parseMusicLink, spotifyMetadata, youtubeCandidates, rankCandidates,
  automaticCandidate, soundcloudTrack, soundcloudFormats, embeddedJSON, validateSoundcloudTrack
} from './linkParsing';

const engine = requireOptionalNativeModule('PeakImport');
let soundcloudClientID = null;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

export function assertImportEngine() {
  if (!engine) throw new Error('Installe la nouvelle version iOS compilée de Peak Music : le moteur ne fonctionne pas dans Expo Go ni dans une ancienne IPA.');
}
export function subscribeImportProgress(listener) { return engine?.addListener('onProgress', listener); }
export async function cancelNativeImport(jobID) { await engine?.cancel(jobID); }

function trustedURL(raw, domains) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !domains.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) {
    throw new Error('Le service a renvoyé une adresse non reconnue.');
  }
  return url;
}

export async function requestText(url, signal, onResponse) {
  signal?.throwIfAborted?.();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 25000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!response.ok) throw new Error(`Le service a refusé la requête (HTTP ${response.status}). Réessaie plus tard.`);
    onResponse?.(response);
    const result = await response.text();
    if (result.length > 8_000_000) throw new Error('La réponse du service est trop volumineuse.');
    return result;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('Le service met trop de temps à répondre. Réessaie.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function clientID(html, signal) {
  if (soundcloudClientID) return soundcloudClientID;
  const hydration = embeddedJSON(html, 'window.__sc_hydration =');
  const pageClient = hydration?.find?.(entry => entry.hydratable === 'apiClient')?.data?.id;
  if (/^[a-zA-Z0-9]{32}$/.test(pageClient || '')) {
    soundcloudClientID = pageClient;
    return pageClient;
  }
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["'](https:\/\/[^"']+)["']/gi)]
    .map(m => m[1]).filter(url => { try { trustedURL(url, ['sndcdn.com']); return true; } catch { return false; } });
  for (const url of scripts.reverse().slice(0, 6)) {
    const js = await requestText(url, signal);
    const id = js.match(/client_id\s*:\s*"([a-zA-Z0-9]{32})"/)?.[1];
    if (id) { soundcloudClientID = id; return id; }
  }
  throw new Error('Le lecteur SoundCloud a changé : impossible de récupérer le flux pour le moment.');
}

export async function prepareMusicLink(raw, signal, status) {
  assertImportEngine();
  let link = parseMusicLink(raw);
  if (link.provider === 'redirect') {
    status('Ouverture du lien partagé…');
    let destination;
    await requestText(link.url, signal, response => { destination = response.url; });
    link = parseMusicLink(destination);
    if (link.provider === 'redirect') throw new Error('Copie l’adresse complète du morceau depuis ton navigateur.');
  }
  if (link.provider === 'youtube') {
    status('Lecture des informations YouTube…');
    let metadata;
    try {
      const data = JSON.parse(await requestText(`https://www.youtube.com/oembed?url=${encodeURIComponent(link.url)}&format=json`, signal));
      metadata = { title: data.title, artist: data.author_name || 'YouTube' };
    } catch (error) { if (signal?.aborted) throw error; }
    return { ...link, videoID: link.id, metadata };
  }
  if (link.provider === 'spotify') {
    status('Lecture du titre et de l’artiste sur Spotify…');
    const metadata = spotifyMetadata(await requestText(`https://open.spotify.com/embed/track/${link.id}`, signal), link.id);
    status(`Recherche YouTube : ${metadata.artist} — ${metadata.title}`);
    const query = encodeURIComponent(`${metadata.artist} ${metadata.title} official audio`);
    const ranked = rankCandidates(youtubeCandidates(await requestText(`https://www.youtube.com/results?search_query=${query}`, signal)), metadata);
    if (!ranked.length) throw new Error('Aucune correspondance YouTube trouvée. Essaie un lien YouTube direct.');
    return { ...link, metadata, candidates: ranked.slice(0, 8), videoID: automaticCandidate(ranked)?.id || null };
  }
  status('Recherche du flux SoundCloud…');
  const html = await requestText(link.url, signal);
  const hydration = embeddedJSON(html, 'window.__sc_hydration =');
  const track = hydration?.some?.(entry => entry.hydratable === 'sound') ? soundcloudTrack(html) :
    validateSoundcloudTrack(JSON.parse(await requestText(
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(link.url)}&client_id=${await clientID(html, signal)}`, signal)));
  const formats = soundcloudFormats(track);
  if (!formats.length) throw new Error('Ce morceau ne propose pas de flux MP3 ou AAC complet compatible. Les extraits et les flux protégés ne sont pas importés.');
  const metadata = { title: track.title, artist: track.user?.username || 'SoundCloud', duration: track.duration / 1000 };
  let lastError;
  for (const format of formats) {
    try {
      const endpoint = trustedURL(format.url, ['soundcloud.com']);
      endpoint.searchParams.set('client_id', await clientID(html, signal));
      const data = JSON.parse(await requestText(endpoint.href, signal));
      const mediaURL = trustedURL(data.url, ['sndcdn.com', 'soundcloud.com']);
      if (/\/preview\/|\/(?:preview|playlist)\/0\/30\//i.test(mediaURL.pathname)) continue;
      const mode = format.format.protocol === 'hls' ? (format.format.mime_type.startsWith('audio/mp4') ? 'hls-aac' : 'hls-mp3') : 'direct';
      return { ...link, sourceKey: `soundcloud:${track.id}`, metadata, mediaURL: mediaURL.href, mode };
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      soundcloudClientID = null;
    }
  }
  throw lastError || new Error('Aucun flux SoundCloud complet disponible.');
}

export async function downloadPrepared(prepared, jobID) {
  assertImportEngine();
  const result = prepared.videoID ? await engine.youtube(prepared.videoID, jobID) : await engine.media(prepared.mediaURL, prepared.mode, jobID);
  const duration = Number(result.duration);
  const expected = prepared.metadata?.duration;
  if (expected && duration < expected - Math.max(10, expected * 0.05)) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error('Le fichier reçu est plus court que le morceau annoncé. Il n’a pas été ajouté.');
  }
  return {
    ...result, duration,
    title: prepared.metadata?.title || result.title || 'Morceau',
    artist: prepared.metadata?.artist || 'YouTube',
    sourceKey: prepared.sourceKey, sourceUrl: prepared.url,
    youtubeID: prepared.videoID || null
  };
}
