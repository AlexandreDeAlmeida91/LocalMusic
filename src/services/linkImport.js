import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import {
  parseMusicLink, spotifyMetadata, youtubeCandidates, rankCandidates,
  automaticCandidate, soundcloudTrack, soundcloudFormats, embeddedJSON, validateSoundcloudTrack, readableImportError
} from './linkParsing';

const engine = requireOptionalNativeModule('PeakImport');
let soundcloudClientID = null;
let soundcloudClientExpires = 0;
// The mobile SoundCloud site serves a different React page without sc_hydration.
// Request the desktop page consistently, including when following shared links.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

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

export async function requestText(url, signal, onResponse, request = {}) {
  signal?.throwIfAborted?.();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 25000);
  try {
    const response = await fetch(url, { ...request, signal: controller.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...(request.headers || {}) } });
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
  const hydration = embeddedJSON(html, 'window.__sc_hydration =');
  const pageClient = hydration?.find?.(entry => entry.hydratable === 'apiClient')?.data?.id;
  if (/^[a-zA-Z0-9]{32}$/.test(pageClient || '')) {
    soundcloudClientID = pageClient;
    soundcloudClientExpires = Date.now() + 5 * 60 * 1000;
    return pageClient;
  }
  if (soundcloudClientID && Date.now() < soundcloudClientExpires) return soundcloudClientID;
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["'](https:\/\/[^"']+)["']/gi)]
    .map(m => m[1]).filter(url => { try { trustedURL(url, ['sndcdn.com']); return true; } catch { return false; } });
  for (const url of scripts.reverse().slice(0, 6)) {
    const js = await requestText(url, signal);
    const id = js.match(/client_id\s*:\s*"([a-zA-Z0-9]{32})"/)?.[1];
    if (id) {
      soundcloudClientID = id;
      soundcloudClientExpires = Date.now() + 5 * 60 * 1000;
      return id;
    }
  }
  throw new Error('SoundCloud n’a pas fourni les données de son lecteur. La page peut être bloquée ou demander une vérification dans Safari.');
}

async function youtubeMatches(metadata, signal, status) {
  status(`Recherche YouTube : ${metadata.artist} — ${metadata.title}`);
  const query = encodeURIComponent(`${metadata.artist} ${metadata.title} official audio`);
  return rankCandidates(youtubeCandidates(await requestText(`https://www.youtube.com/results?search_query=${query}`, signal)), metadata);
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
    const ranked = await youtubeMatches(metadata, signal, status);
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
  const metadata = { title: track.title, artist: track.user?.username || 'SoundCloud', duration: track.duration / 1000 };
  if (!formats.length) {
    const explanation = 'Ce morceau SoundCloud ne propose pas de flux complet compatible. Tu peux choisir une version YouTube à la place.';
    let ranked;
    try { ranked = await youtubeMatches(metadata, signal, status); }
    catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(`${explanation} La recherche YouTube a également échoué : ${readableImportError(error)}`);
    }
    if (!ranked.length) throw new Error('Aucun flux SoundCloud compatible et aucune version YouTube trouvée pour ce morceau.');
    // Automatically select only a confident, unambiguous match.
    return { ...link, sourceKey: `soundcloud:${track.id}`, metadata, candidates: ranked.slice(0, 8), videoID: automaticCandidate(ranked)?.id || null, matchReason: explanation };
  }
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
  return youtubeFallback({ ...link, sourceKey: `soundcloud:${track.id}`, metadata }, signal, status);
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


// Expand public playlist pages before queue processing. Never silently claim
// completeness: embeds and public pages may expose only part of a collection.
export async function expandImportLinks(rawLinks, signal, status) {
  const output = [], warnings = [];
  const walk = (value, visit) => {
    if (!value || typeof value !== 'object') return;
    visit(value);
    Object.values(value).forEach(child => {
      if (Array.isArray(child)) child.forEach(v => walk(v, visit));
      else if (child && typeof child === 'object') walk(child, visit);
    });
  };
  for (const raw of rawLinks) {
    signal?.throwIfAborted();
    try {
      let link = parseMusicLink(raw);
      if (link.provider === 'redirect') {
        let destination;
        await requestText(link.url, signal, r => { destination = r.url; });
        link = parseMusicLink(destination);
      }
      if (!link.playlist) { output.push(link.url); continue; }
      status('Lecture de la playlist…');
      const url = link.provider === 'spotify' ? `https://open.spotify.com/embed/playlist/${link.id}` : link.url;
      const html = await requestText(url, signal);
      const found = [];
      let partial = false;
      if (link.provider === 'youtube') {
        let data = embeddedJSON(html, 'var ytInitialData =') || embeddedJSON(html, 'ytInitialData =');
        const config = embeddedJSON(html, 'ytcfg.set(');
        const tokens = new Set();
        for (let page = 0; page < 100; page++) {
          let token;
          walk(data, node => {
            if (node.playlistVideoRenderer?.videoId && node.playlistVideoRenderer.isPlayable !== false)
              found.push(`https://www.youtube.com/watch?v=${node.playlistVideoRenderer.videoId}`);
            if (node.continuationItemRenderer) token = node.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
          });
          if (!token) break;
          if (!config?.INNERTUBE_CONTEXT || tokens.has(token) || page === 99) { partial = true; break; }
          tokens.add(token);
          try {
            data = JSON.parse(await requestText('https://www.youtube.com/youtubei/v1/browse', signal, undefined, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ context: config.INNERTUBE_CONTEXT, continuation: token })
            }));
          } catch (error) { if (signal?.aborted) throw error; partial = true; break; }
        }
      } else if (link.provider === 'spotify') {
        // Embed trackList is a bounded public view; warn instead of pretending
        // it represents a full authenticated playlist.
        const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
        const data = match ? JSON.parse(match[1]) : null;
        walk(data, node => {
          const uri = node.uri || node.track?.uri;
          if (typeof uri === 'string' && /^spotify:track:[A-Za-z0-9]{22}$/.test(uri))
            found.push(`https://open.spotify.com/track/${uri.split(':')[2]}`);
        });
        partial = true;
      } else {
        const hydration = embeddedJSON(html, 'window.__sc_hydration =');
        const playlist = hydration?.find?.(v => v.hydratable === 'playlist')?.data;
        if (playlist?.tracks) {
          for (let track of playlist.tracks) {
            signal?.throwIfAborted();
            if (!track.permalink_url && track.id) {
              track = JSON.parse(await requestText(`https://api-v2.soundcloud.com/tracks/${encodeURIComponent(track.id)}?client_id=${await clientID(html, signal)}`, signal));
            }
            if (track.permalink_url) found.push(parseMusicLink(track.permalink_url).url);
            else partial = true;
          }
          if (playlist.track_count > playlist.tracks.length) partial = true;
        }
      }
      const unique = [...new Set(found)];
      if (!unique.length) throw new Error('Playlist inaccessible ou aucun morceau lisible sur la page publique.');
      output.push(...unique);
      if (partial) warnings.push(`${link.provider} : ${unique.length} morceaux accessibles ; la liste publique peut être incomplète.`);
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.push(`${raw} : ${readableImportError(error)}`);
    }
  }
  return { links: [...new Set(output)], warnings };
}

export async function youtubeFallback(prepared, signal, status) {
  if (!prepared.metadata?.title || !prepared.metadata?.artist) throw new Error('Impossible de rechercher une autre version sans titre et artiste.');
  const ranked = (await youtubeMatches(prepared.metadata, signal, status)).filter(c => c.id !== prepared.videoID);
  if (!ranked.length) throw new Error('Aucune autre version YouTube trouvée.');
  return { ...prepared, mediaURL: undefined, candidates: ranked.slice(0, 8), videoID: automaticCandidate(ranked)?.id || null, matchReason: 'La source initiale est indisponible. Choisis une version YouTube.' };
}
