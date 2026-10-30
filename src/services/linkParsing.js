// Pure parsers: no network, file access or evaluation of page scripts.
export function parseMusicLink(raw) {
  let url;
  try { url = new URL(String(raw).trim()); } catch { throw new Error('Colle un lien complet YouTube, SoundCloud ou Spotify.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw new Error('Ce lien n’est pas pris en charge.');
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? parts[0] : parts[0] === 'watch' ? url.searchParams.get('v') : ['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : null;
    if (!/^[\w-]{11}$/.test(id || '')) throw new Error('Utilise le lien d’un morceau ou d’une vidéo YouTube, pas celui d’une playlist.');
    return { provider: 'youtube', id, sourceKey: `youtube:${id}`, url: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host === 'open.spotify.com') {
    if (/^intl-[a-z-]+$/i.test(parts[0])) parts.shift();
    if (parts[0] !== 'track' || !/^[a-zA-Z0-9]{22}$/.test(parts[1] || '')) throw new Error('Utilise un lien Spotify vers un morceau individuel.');
    return { provider: 'spotify', id: parts[1], sourceKey: `spotify:${parts[1]}`, url: `https://open.spotify.com/track/${parts[1]}` };
  }
  if (['on.soundcloud.com', 'spotify.link'].includes(host)) {
    url.protocol = 'https:';
    return { provider: 'redirect', url: url.href };
  }
  if (['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(host)) {
    if (parts.length !== 2 || ['sets', 'tracks', 'likes', 'reposts', 'albums'].includes(parts[1])) throw new Error('Utilise un lien SoundCloud vers un morceau individuel.');
    const clean = `https://soundcloud.com/${parts.join('/')}`;
    return { provider: 'soundcloud', url: clean, sourceKey: clean };
  }
  throw new Error('Seuls les liens YouTube, SoundCloud et Spotify sont acceptés.');
}

export function embeddedJSON(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  let start = at + marker.length;
  while (start < html.length && !['{', '['].includes(html[start])) start++;
  if (start >= html.length || start - at > 100) return null;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      if (--depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; } }
    }
  }
  return null;
}

export function spotifyMetadata(html, expectedID) {
  const match = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  let data;
  try { data = JSON.parse(match?.[1] || 'null'); } catch { /* handled below */ }
  const entity = data?.props?.pageProps?.state?.data?.entity;
  const artist = entity?.artists?.map((a) => a.name).filter(Boolean).join(', ');
  if (entity?.type !== 'track' || entity.id !== expectedID || !entity.name || !artist) {
    throw new Error('Spotify ne fournit pas le titre et l’artiste de ce morceau. Réessaie avec son lien YouTube.');
  }
  return { title: entity.name, artist, artists: entity.artists.map(a => a.name), duration: Number(entity.duration) / 1000 || null };
}

function text(value) { return value?.simpleText || value?.runs?.map(r => r.text).join('') || ''; }
function seconds(value) {
  const pieces = value.split(':').map(Number);
  return pieces.length > 1 && pieces.every(Number.isFinite) ? pieces.reduce((n, part) => n * 60 + part, 0) : null;
}

export function youtubeCandidates(html) {
  const data = embeddedJSON(html, 'var ytInitialData =') || embeddedJSON(html, 'window["ytInitialData"] =') || embeddedJSON(html, 'ytInitialData =');
  if (!data) throw new Error('La recherche YouTube est indisponible ou bloquée. Tu peux essayer un lien YouTube direct.');
  const found = [], seen = new Set(), stack = [data];
  let visited = 0;
  while (stack.length && visited++ < 50000) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    const v = node.videoRenderer;
    if (v && /^[\w-]{11}$/.test(v.videoId || '') && !seen.has(v.videoId)) {
      const duration = seconds(text(v.lengthText));
      if (duration) {
        seen.add(v.videoId);
        const verifiedArtist = (v.ownerBadges || []).some(b => b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED_ARTIST');
        found.push({ id: v.videoId, title: text(v.title), artist: text(v.ownerText || v.longBylineText), duration, verifiedArtist });
      }
    }
    for (const child of Object.values(node)) if (child && typeof child === 'object') stack.push(child);
  }
  return found.slice(0, 20);
}

export function normalized(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function rankCandidates(candidates, target) {
  const title = normalized(target.title), artists = (target.artists || [target.artist]).map(normalized);
  const versions = ['live', 'remix', 'cover', 'sped up', 'slowed', 'instrumental', 'karaoke'];
  return candidates.map(candidate => {
    const haystack = ` ${normalized(candidate.title + ' ' + candidate.artist)} `;
    const titleMatch = haystack.includes(` ${title} `);
    const artistMatch = artists.every(artist => artist && haystack.includes(` ${artist} `));
    const delta = target.duration ? Math.abs(candidate.duration - target.duration) : Infinity;
    const differentVersion = versions.some(v => haystack.includes(` ${v} `) && !(` ${title} `).includes(` ${v} `));
    const score = (titleMatch ? 4 : 0) + (artistMatch ? 3 : 0) + (delta <= 6 ? 3 : delta <= 15 ? 1 : 0) - (differentVersion ? 5 : 0) + (candidate.verifiedArtist && artistMatch ? 2 : 0);
    return { ...candidate, score, confident: titleMatch && artistMatch && delta <= 6 && !differentVersion };
  }).sort((a, b) => b.score - a.score);
}
export function automaticCandidate(ranked) {
  return ranked[0]?.confident && (!ranked[1] || ranked[0].score - ranked[1].score >= 2) ? ranked[0] : null;
}

export function soundcloudTrack(html) {
  const hydration = embeddedJSON(html, 'window.__sc_hydration =');
  const track = hydration?.find?.(entry => entry.hydratable === 'sound')?.data;
  return validateSoundcloudTrack(track);
}
export function validateSoundcloudTrack(track) {
  if (!track?.id || !track?.title) throw new Error('SoundCloud ne fournit pas les informations de ce morceau.');
  if (track.kind && track.kind !== 'track') throw new Error('Ce lien SoundCloud ne correspond pas à un morceau.');
  if (track.policy && !['ALLOW', 'MONETIZE'].includes(track.policy)) throw new Error('Ce morceau SoundCloud est limité, privé ou indisponible dans ta région.');
  return track;
}
export function soundcloudFormats(track) {
  return (track.media?.transcodings || []).filter(t =>
    !t.snipped && !/preview|encrypted/i.test(t.url || '') &&
    ['progressive', 'hls'].includes(t.format?.protocol) &&
    (t.format?.mime_type === 'audio/mpeg' || (t.format?.protocol === 'hls' && /^audio\/mp4;\s*codecs="mp4a\.40\.2"$/.test(t.format?.mime_type || ''))) &&
    (!track.duration || !t.duration || t.duration >= track.duration - 3000)
  ).sort((a, b) => {
    const bitrate = t => Number(t.preset?.match(/(\d+)k$/)?.[1] || 128);
    return bitrate(b) - bitrate(a) || Number(b.format.protocol === 'progressive') - Number(a.format.protocol === 'progressive');
  });
}

export function readableImportError(error) {
  return String(error?.message || 'Import impossible.')
    .replace(/^(?:UnexpectedException|Exception|Error):\s*/i, '')
    .replace(/\s*\(at\s+ExpoModulesCore\/[\s\S]*?\)\s*$/, '')
    .trim();
}
