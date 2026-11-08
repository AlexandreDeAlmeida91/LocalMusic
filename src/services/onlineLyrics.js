// All requests run on the phone. Never infer a match from the title alone.
export const key = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cjk = /[\u3040-\u30ff\u3400-\u9fff]/;
const decode = s => String(s || '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const v = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : +n; return v <= 0x10ffff ? String.fromCodePoint(v) : ''; }).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const plain = s => decode(String(s || '').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,''));
export function lyricIdentity(metadata = {}) {
  let title = String(metadata.title || '').replace(/\s*[\[(](?:official\s*)?(?:music\s*)?(?:video|audio|lyrics?|visualizer|hd|4k)[^\])]*[\])]/gi,'').trim();
  let artist = String(metadata.artist || '').replace(/\s*-\s*Topic$/i,'').trim();
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length === 2) [artist,title] = parts;
  if (/^(youtube|soundcloud|artiste inconnu|unknown artist)$/i.test(artist)) artist = '';
  return { title, artist };
}
export function exactRecord(record, q) {
  return !!key(q.artist) && !!key(q.title) && key(record.trackName) === key(q.title) && key(record.artistName) === key(q.artist);
}
export function validatedText(text) {
  text = String(text || '').trim();
  return text.length >= 20 && text.length <= 60000 && !cjk.test(text) ? text : null;
}
let lrclibNext = 0;
async function request(url, signal) {
  const lrclib = url.startsWith('https://lrclib.net/');
  if (lrclib && Date.now() < lrclibNext) throw new Error('Service temporairement limité');
  if (lrclib) lrclibNext = Date.now() + 500;
  const controller = new AbortController();
  const stop = () => controller.abort();
  if (signal?.aborted) throw new Error('Annulé');
  signal?.addEventListener('abort',stop);
  const timer = setTimeout(stop, 10000);
  try {
    const r = await fetch(url,{signal:controller.signal,headers:{Accept:'application/json,text/html', 'User-Agent':'PeakMusic/1.8.0'}});
    if (lrclib && (r.status === 429 || r.status === 503)) {
      const retry = r.headers?.get?.('Retry-After');
      lrclibNext = Date.now() + (Number(retry) > 0 ? Number(retry)*1000 : Math.max(60000, Date.parse(retry)-Date.now() || 0));
    }
    if (!r.ok) throw new Error(`Service indisponible (${r.status})`);
    const body = await r.text();
    if (body.length > 2000000) throw new Error('Réponse trop volumineuse');
    return body;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort',stop); }
}
export async function findOnlineLyrics(metadata, signal) {
  const q = lyricIdentity(metadata);
  if (!q.title || !q.artist) return {status:'Titre ou artiste à préciser'};
  let responded = false, japanese = cjk.test(q.title);
  try {
    const data = JSON.parse(await request(`https://lrclib.net/api/search?track_name=${encodeURIComponent(q.title)}&artist_name=${encodeURIComponent(q.artist)}`,signal));
    if (!Array.isArray(data)) throw new Error('Réponse invalide');
    responded = true;
    const exact = data.filter(r => exactRecord(r,q));
    const choices = exact.map(r => ({r,text:String(r.plainLyrics || r.syncedLyrics || '').replace(/^\s*(?:\[\d+:\d+(?:[.:]\d+)?\])+\s?/gm,'').trim()}));
    japanese ||= choices.some(c => cjk.test(c.text));
    const valid = choices.filter(c => validatedText(c.text));
    if (valid.length && new Set(valid.map(c=>c.text)).size === 1) return {text:valid[0].text,source:'LRCLIB',sourceUrl:`https://lrclib.net/api/get/${valid[0].r.id}`,status:'Paroles disponibles'};
    if (exact.length && exact.every(r=>r.instrumental === true)) return {status:'Instrumental'};
  } catch { if (signal?.aborted) return {status:'Recherche interrompue'}; }
  // AnimeSongLyrics supplies romanized Japanese text, only with exact artist + title.
  try {
    const html = await request(`https://www.animesonglyrics.com/results?q=${encodeURIComponent(q.artist+' '+q.title)}`,signal);
    responded = true;
    const links = [...html.matchAll(/<a\b[^>]*href=["'](https:\/\/(?:www\.)?animesonglyrics\.com\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    for (const [,url,body] of links.filter(([, ,b]) => { const h = ' '+key(plain(b))+' '; return h.includes(' '+key(q.title)+' ') && h.includes(' '+key(q.artist)+' '); }).slice(0,2)) {
      const u = new URL(decode(url));
      if (!/^\/[^/]+\/[^/]+\/?$/.test(u.pathname) || u.search) continue;
      const page = await request(u.href,signal);
      const heading = plain(page.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]).replace(/\s+lyrics\s*$/i,'');
      if (key(heading) !== key(q.artist+' '+q.title)) continue;
      const text = [...page.matchAll(/<div\b[^>]*class=["'][^"']*\bromaji-single-line\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map(m=>plain(m[1])).filter(l=>!/^\[thanks for visiting/i.test(l)).join('\n');
      if (validatedText(text)) return {text,source:'AnimeSongLyrics · rōmaji',sourceUrl:u.href,status:'Paroles disponibles · rōmaji'};
    }
  } catch { if (signal?.aborted) return {status:'Recherche interrompue'}; }
  return {status:responded ? (japanese ? 'Rōmaji introuvable' : 'Paroles introuvables') : 'Services de paroles indisponibles'};
}
