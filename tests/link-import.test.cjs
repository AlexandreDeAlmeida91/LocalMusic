const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('@babel/core');

function load(relative, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const source = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')]
  }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), source)(
    name => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unmocked dependency: ${name}`);
    }, module, module.exports, ...Object.values(globals)
  );
  return module.exports;
}
const p = load('src/services/linkParsing.js');
const id = 'abcdefghijk';
const spotifyID = '1234567890123456789012';
const spotifyHTML = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { state: { data: { entity: {
  type: 'track', id: spotifyID, name: 'Northern Lights', artists: [{ name: 'Test Artist' }], duration: 180000,
  audioPreview: { url: 'https://example.invalid/preview.mp3' }
} } } } } })}</script>`;
function searchHTML(candidates) {
  return `var ytInitialData = ${JSON.stringify({ contents: candidates.map(c => ({ videoRenderer: {
    videoId: c.id, title: { runs: [{ text: c.title }] }, ownerText: { runs: [{ text: c.artist }] },
    lengthText: { simpleText: c.time }
  } })) })};`;
}
const target = { title: 'Northern Lights', artist: 'Test Artist', duration: 180 };

test('normalizes YouTube, Spotify locale and SoundCloud links', () => {
  assert.equal(p.parseMusicLink(`https://youtu.be/${id}?si=share`).sourceKey, `youtube:${id}`);
  assert.equal(p.parseMusicLink(`https://music.youtube.com/watch?v=${id}&list=anything`).id, id);
  assert.equal(p.parseMusicLink(`https://youtube.com/shorts/${id}`).id, id);
  assert.equal(p.parseMusicLink(`https://open.spotify.com/intl-fr/track/${spotifyID}?si=x`).id, spotifyID);
  assert.equal(p.parseMusicLink('https://soundcloud.com/artist/song?si=share').url, 'https://soundcloud.com/artist/song');
  assert.equal(p.parseMusicLink('https://on.soundcloud.com/abc').provider, 'redirect');
});
test('rejects spoofed hosts, credentials, unsupported playlists and malformed IDs', () => {
  for (const url of ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://youtube.com@evil.test/watch?v=abcdefghijk',
    'file:///private/file', 'https://open.spotify.com/playlist/123', 'https://youtube.com/playlist',
    'https://soundcloud.com/artist/reposts', 'https://youtu.be/short', 'https://localhost/watch?v=abcdefghijk']) {
    assert.throws(() => p.parseMusicLink(url));
  }
});
test('reads nested JSON without executing script strings', () => {
  const html = 'marker = {"a":"braces } [ and \\\"quotes","b":[{"x":1}]}; throw new Error("NEVER RUN");';
  assert.deepEqual(p.embeddedJSON(html, 'marker ='), { a: 'braces } [ and \\"quotes'.replace('\\"', '"'), b: [{ x: 1 }] });
  assert.equal(p.embeddedJSON('marker = broken', 'marker ='), null);
});
test('extracts Spotify identity and duration, never its audio preview', () => {
  const data = p.spotifyMetadata(spotifyHTML, spotifyID);
  assert.equal(data.title, 'Northern Lights');
  assert.equal(data.duration, 180);
  assert.equal(data.artist, 'Test Artist');
  assert.equal(data.audioPreview, undefined);
  assert.throws(() => p.spotifyMetadata(spotifyHTML, 'wrong-id'));
});
test('search parsing deduplicates videos and ignores live streams without duration', () => {
  const html = searchHTML([
    { id, title: 'Northern Lights', artist: 'Test Artist', time: '3:00' },
    { id, title: 'duplicate', time: '3:00' },
    { id: 'zzzzzzzzzzz', title: 'Live now', time: '' }
  ]);
  const results = p.youtubeCandidates(html);
  assert.equal(results.length, 1);
  assert.equal(results[0].duration, 180);
  assert.throws(() => p.youtubeCandidates('<html>captcha</html>'));
});
test('only an unambiguous title, artist and duration match imports automatically', () => {
  const candidates = [
    { id, title: 'Test Artist — Northern Lights (Official Audio)', artist: 'Test Artist', duration: 181 },
    { id: 'bbbbbbbbbbb', title: 'Northern Lights live', artist: 'Test Artist', duration: 180 },
    { id: 'ccccccccccc', title: 'Northern Lights', artist: 'Another Artist', duration: 180 }
  ];
  const ranked = p.rankCandidates(candidates, target);
  assert.equal(p.automaticCandidate(ranked).id, id);
  assert.equal(p.automaticCandidate(p.rankCandidates([candidates[0], { ...candidates[0], id: 'ddddddddddd' }], target)), null);
  assert.equal(p.automaticCandidate(p.rankCandidates([{ ...candidates[0], duration: 30 }], target)), null);
});
test('SoundCloud excludes previews, protected streams and truncated tracks', () => {
  const fmt = { url: 'https://api-v2.soundcloud.com/media/file', preset: 'mp3_0_128k', duration: 180000, format: { protocol: 'progressive', mime_type: 'audio/mpeg' } };
  const track = { duration: 180000, media: { transcodings: [fmt, { ...fmt, snipped: true }, { ...fmt, duration: 30000 }, { ...fmt, format: { ...fmt.format, protocol: 'encrypted-hls' } }] } };
  assert.deepEqual(p.soundcloudFormats(track), [fmt]);
  assert.throws(() => p.soundcloudTrack('window.__sc_hydration = [{"hydratable":"sound","data":{"id":1,"title":"Test","policy":"SNIP"}}];'));
});

test('current SoundCloud AAC streams and MONETIZE tracks are accepted without accepting previews', () => {
  const aac = { url: 'https://api-v2.soundcloud.com/media/file', preset: 'aac_160k', duration: 180000, format: { protocol: 'hls', mime_type: 'audio/mp4; codecs="mp4a.40.2"' } };
  const track = { id: 1, title: 'Synthetic track', kind: 'track', policy: 'MONETIZE', duration: 180000, media: { transcodings: [aac] } };
  assert.equal(p.validateSoundcloudTrack(track), track);
  assert.deepEqual(p.soundcloudFormats(track), [aac]);
  assert.throws(() => p.validateSoundcloudTrack({ ...track, policy: 'SNIP' }));
});

function libraryMock({ failSave = false, repair = false } = {}) {
  const files = new Map([['file:///cache/PeakImports/new.m4a', 'audio bytes']]);
  let stored = null;
  const f = {
    cacheDirectory: 'file:///cache/',
    getInfoAsync: async uri => ({ exists: files.has(uri), size: files.get(uri)?.length || 0 }),
    moveAsync: async ({ from, to }) => { if (!files.has(from)) throw new Error('Missing'); files.set(to, files.get(from)); files.delete(from); },
    deleteAsync: async uri => files.delete(uri)
  };
  const storage = {
    ROOT_DIR: 'file:///documents/LocalMusic/', MUSIC_DIR: 'file:///documents/LocalMusic/Music/',
    ensureDirectories: async () => {}, relativeLocalPath: value => value,
    resolveLocalPath: value => `file:///documents/LocalMusic/${value}`,
    writeJsonAtomic: async (_, value) => { if (failSave) throw new Error('Disk full'); stored = value; }
  };
  const library = load('src/services/library.js', { 'expo-file-system/legacy': f, 'expo-document-picker': {}, './id3': {}, './audioRepair': { createNormalizedAudio: async (source, destination) => { if (!repair) return { changed: false }; files.set(destination, 'normalized audio'); return { changed: true, uri: destination, duration: 541.176 }; } }, './storage': storage });
  return { library, files, stored: () => stored };
}
const download = { uri: 'file:///cache/PeakImports/new.m4a', extension: 'm4a', title: 'Test song', artist: 'Test artist', duration: 180, sourceKey: 'youtube:abcdefghijk', youtubeID: id, sourceUrl: 'https://youtube.com/watch?v=abcdefghijk' };
test('commit retains existing songs and saves relative paths for offline playback', async () => {
  const m = libraryMock();
  const existing = [{ id: 'old', title: 'Old song', audioPath: 'Music/old.mp3' }];
  const result = await m.library.commitDownloadedSong(download, existing);
  assert.equal(result.songs.length, 2);
  assert.equal(result.songs.find(s => s.id === 'old'), existing[0]);
  assert.match(result.song.audioPath, /^Music\/.*\.m4a$/);
  assert.equal(m.files.get(result.song.uri), 'audio bytes');
  assert.equal(m.stored().find(s => s.id === result.song.id).uri, undefined);
});
test('Spotify and YouTube importing the same video do not create a second file', async () => {
  const m = libraryMock();
  const old = { id: 'old', title: 'Song', youtubeID: id, sourceKey: 'spotify:123', uri: 'file:///documents/old.m4a' };
  m.files.set(old.uri, 'existing');
  const result = await m.library.commitDownloadedSong(download, [old]);
  assert.equal(result.duplicate, true);
  assert.equal(result.song, old);
  assert.equal(m.files.size, 1);
});
test('storage failure rolls back the new audio and does not alter the collection', async () => {
  const m = libraryMock({ failSave: true });
  const existing = [{ id: 'old', title: 'Old song' }];
  await assert.rejects(m.library.commitDownloadedSong(download, existing), /Disk full/);
  assert.equal(existing.length, 1);
  assert.equal(m.stored(), null);
  assert.equal(m.files.size, 0);
});
test('native module missing fails clearly before network access', async () => {
  const service = load('src/services/linkImport.js', {
    'expo': { requireOptionalNativeModule: () => null },
    'expo-file-system/legacy': {}, './linkParsing': p
  });
  await assert.rejects(service.prepareMusicLink(`https://youtu.be/${id}`), /nouvelle version iOS/);
});
test('Spotify preparation performs metadata and YouTube search without a conversion server', async () => {
  const requests = [];
  const native = {};
  const service = load('src/services/linkImport.js', {
    'expo': { requireOptionalNativeModule: () => native },
    'expo-file-system/legacy': {}, './linkParsing': p
  }, { fetch: async url => {
    requests.push(url);
    return { ok: true, url, text: async () => url.includes('spotify.com') ? spotifyHTML : searchHTML([{ id, title: 'Test Artist Northern Lights Official Audio', artist: 'Test Artist', time: '3:00' }]) };
  } });
  const prepared = await service.prepareMusicLink(`https://open.spotify.com/track/${spotifyID}`, new AbortController().signal, () => {});
  assert.equal(prepared.videoID, id);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(url => new URL(url).hostname), ['open.spotify.com', 'www.youtube.com']);
});
test('short audio is removed before it can enter the library', async () => {
  const removed = [];
  const service = load('src/services/linkImport.js', {
    'expo': { requireOptionalNativeModule: () => ({ youtube: async () => ({ ...download, duration: '30' }) }) },
    'expo-file-system/legacy': { deleteAsync: async uri => removed.push(uri) }, './linkParsing': p
  });
  await assert.rejects(service.downloadPrepared({ videoID: id, metadata: { duration: 180 } }, 'job'), /plus court/);
  assert.deepEqual(removed, [download.uri]);
});

function soundcloudService(responder) {
  return load('src/services/linkImport.js', {
    expo: { requireOptionalNativeModule: () => ({}) },
    'expo-file-system/legacy': {}, './linkParsing': p
  }, { fetch: responder });
}
const scTrack = { id: 42, title: target.title, user: { username: target.artist }, kind: 'track', policy: 'MONETIZE', duration: 180000 };
const scFormat = { url: 'https://api-v2.soundcloud.com/media/file', preset: 'mp3_0_128k', duration: 180000, format: { protocol: 'progressive', mime_type: 'audio/mpeg' } };
function scHTML(track, client = 'a'.repeat(32)) {
  return 'window.__sc_hydration = ' + JSON.stringify([{ hydratable: 'sound', data: track }, { hydratable: 'apiClient', data: { id: client } }]) + ';';
}
function response(url, body) { return { ok: true, url, text: async () => body }; }
test('SoundCloud short links use desktop pages and canonicalize mobile redirects', async () => {
  const requests = [];
  const service = soundcloudService(async (url, options) => {
    requests.push(url);
    assert.doesNotMatch(options.headers['User-Agent'], /iPhone|Mobile/);
    if (url.includes('on.soundcloud')) return response('https://m.soundcloud.com/artist/song?ref=share', 'mobile page');
    if (url.includes('api-v2')) return response(url, JSON.stringify({ url: 'https://cf-media.sndcdn.com/audio.mp3' }));
    assert.equal(url, 'https://soundcloud.com/artist/song');
    return response(url, scHTML({ ...scTrack, media: { transcodings: [scFormat] } }));
  });
  const result = await service.prepareMusicLink('https://on.soundcloud.com/abc', undefined, () => {});
  assert.equal(result.mode, 'direct');
  assert.equal(result.sourceKey, 'soundcloud:42');
  assert.equal(requests.length, 3);
});
test('protected SoundCloud offers YouTube selection without requesting protected media', async () => {
  const requests = [];
  const service = soundcloudService(async url => {
    requests.push(url);
    assert.ok(!url.includes('api-v2'));
    return response(url, url.includes('youtube.com') ? searchHTML([{ id, title: 'Test Artist Northern Lights Official Audio', artist: target.artist, time: '3:00' }]) :
      scHTML({ ...scTrack, media: { transcodings: [{ ...scFormat, format: { protocol: 'ctr-encrypted-hls', mime_type: 'audio/mp4' } }] } }));
  });
  const result = await service.prepareMusicLink('https://soundcloud.com/artist/song', undefined, () => {});
  assert.equal(result.videoID, id);
  assert.equal(result.mediaURL, undefined);
  assert.equal(result.candidates[0].id, id);
  assert.match(result.matchReason, /choisir une version YouTube/);
  assert.equal(requests.length, 2);
});
test('fresh SoundCloud page client replaces cached client', async () => {
  let client = 'a'.repeat(32);
  const service = soundcloudService(async url => {
    if (url.includes('api-v2')) {
      assert.equal(new URL(url).searchParams.get('client_id'), client);
      return response(url, JSON.stringify({ url: 'https://cf-media.sndcdn.com/audio.mp3' }));
    }
    return response(url, scHTML({ ...scTrack, media: { transcodings: [scFormat] } }, client));
  });
  await service.prepareMusicLink('https://soundcloud.com/artist/song', undefined, () => {});
  client = 'b'.repeat(32);
  await service.prepareMusicLink('https://soundcloud.com/artist/song2', undefined, () => {});
});
test('native error presentation preserves cause and removes Expo internals', () => {
  assert.equal(p.readableImportError(new Error('UnexpectedException: Téléchargement refusé (403). (at ExpoModulesCore/ConcurrentFunctionDefinition.swift:90)')), 'Téléchargement refusé (403).');
  assert.equal(p.readableImportError(new Error('Disque plein')), 'Disque plein');
});

test('expands YouTube playlist continuation and deduplicates tracks', async () => {
  const first = { contents: [{ playlistVideoRenderer: { videoId: id } }, { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'next' } } } }] };
  let calls = 0;
  const service = soundcloudService(async (url, opts) => {
    calls++;
    if (opts.method === 'POST') {
      assert.equal(JSON.parse(opts.body).continuation, 'next');
      return response(url, JSON.stringify({ contents: [{ playlistVideoRenderer: { videoId: id } }, { playlistVideoRenderer: { videoId: 'bbbbbbbbbbb' } }] }));
    }
    return response(url, 'var ytInitialData = ' + JSON.stringify(first) + '; ytcfg.set({"INNERTUBE_CONTEXT":{"client":{"clientName":"WEB"}}});');
  });
  const result = await service.expandImportLinks(['https://youtube.com/playlist?list=PLabc'], undefined, () => {});
  assert.equal(result.links.length, 2);
  assert.equal(result.warnings.length, 0);
  assert.equal(calls, 2);
});
test('Spotify embed expansion warns about incomplete public views', async () => {
  const service = soundcloudService(async url => response(url, '<script id="__NEXT_DATA__">' + JSON.stringify({ trackList: [{ uri: `spotify:track:${spotifyID}` }] }) + '</script>'));
  const result = await service.expandImportLinks([`https://open.spotify.com/playlist/${spotifyID}`], undefined, () => {});
  assert.equal(result.links[0], `https://open.spotify.com/track/${spotifyID}`);
  assert.equal(result.warnings.length, 1);
});
test('SoundCloud playlist resolves missing track details', async () => {
  const service = soundcloudService(async url => response(url, url.includes('api-v2') ? JSON.stringify({ permalink_url: 'https://soundcloud.com/artist/song' }) : 'window.__sc_hydration = ' + JSON.stringify([{ hydratable: 'playlist', data: { track_count: 1, tracks: [{ id: 1 }] } }, { hydratable: 'apiClient', data: { id: 'a'.repeat(32) } }]) + ';'));
  const result = await service.expandImportLinks(['https://soundcloud.com/artist/sets/collection'], undefined, () => {});
  assert.deepEqual(result.links, ['https://soundcloud.com/artist/song']);
  assert.equal(result.warnings.length, 0);
});

test('mobile AbortSignal without throwIfAborted accepts a single video', async () => {
  const service = soundcloudService(async () => { throw new Error('Unexpected network'); });
  const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
  const result = await service.expandImportLinks(['https://youtu.be/Bpaf6Dm9iRc'], signal, () => {});
  assert.deepEqual(result.links, ['https://www.youtube.com/watch?v=Bpaf6Dm9iRc']);
});
test('mobile AbortSignal without throwIfAborted still cancels before networking', async () => {
  const service = soundcloudService(async () => { throw new Error('Unexpected network'); });
  const signal = { aborted: true, addEventListener() {}, removeEventListener() {} };
  await assert.rejects(service.expandImportLinks(['https://youtu.be/Bpaf6Dm9iRc'], signal, () => {}), { name: 'AbortError' });
  await assert.rejects(service.requestText('https://www.youtube.com', signal), { name: 'AbortError' });
});

test('repair keeps song identity, metadata and original while committing a new path', async () => {
  const m = libraryMock({ repair: true });
  const original = { id: 'old', uri: 'file:///documents/LocalMusic/Music/old.mp3', audioPath: 'Music/old.mp3', title: 'Song', lyricsPath: 'Lyrics/old.txt', artworkPath: 'Artwork/old.jpg' };
  m.files.set(original.uri, 'original audio');
  const result = await m.library.repairStoredSong(original, () => [original]);
  assert.equal(result.song.id, original.id);
  assert.equal(result.song.lyricsPath, original.lyricsPath);
  assert.equal(result.song.artworkPath, original.artworkPath);
  assert.equal(m.files.get(original.uri), 'original audio');
  assert.equal(m.files.get(result.song.uri), 'normalized audio');
  assert.equal(result.song.originalAudioPath, original.audioPath);
  assert.equal(m.stored()[0].audioRepairVersion, 1);
});
test('repair metadata failure discards the new copy and keeps the original', async () => {
  const m = libraryMock({ repair: true, failSave: true });
  const original = { id: 'old', uri: 'file:///documents/LocalMusic/Music/old.mp3', audioPath: 'Music/old.mp3' };
  m.files.set(original.uri, 'original audio');
  const before = new Map(m.files);
  await assert.rejects(m.library.repairStoredSong(original,[original]), /Disk full/);
  assert.deepEqual(m.files,before);
});

test('M4A repair preserves extension and original, and does not normalize twice', async () => {
  const m = libraryMock({ repair: true });
  const original = { id: 'aac', uri: 'file:///documents/LocalMusic/Music/aac.m4a', audioPath: 'Music/aac.m4a', title: 'AAC' };
  m.files.set(original.uri, 'original AAC');
  const result = await m.library.repairStoredSong(original, [original]);
  assert.match(result.song.uri, /\.m4a$/);
  assert.equal(result.song.originalAudioPath, original.audioPath);
  assert.equal(m.files.get(original.uri), 'original AAC');
  const again = await m.library.repairStoredSong(result.song, result.songs);
  assert.equal(again.changed, false);
});

test('downloaded M4A is normalized before commit and original retained', async () => {
  const m = libraryMock({ repair: true });
  const uri = 'file:///cache/new.m4a';
  m.files.set(uri, 'original AAC');
  const result = await m.library.commitDownloadedSong({ uri, extension: 'm4a', title: 'AAC', sourceKey: 'youtube:aac' }, []);
  assert.match(result.song.uri, /-normalized\.m4a$/);
  assert.equal(result.song.audioRepairVersion, 1);
  assert.equal(m.files.get('file:///documents/LocalMusic/' + result.song.originalAudioPath), 'original AAC');
});

test('M4A bridge reports a stale IPA and forwards native failures', async () => {
  const mocks = { 'expo-file-system': {}, 'expo-file-system/legacy': {}, './mp3Normalize': {} };
  const stale = load('src/services/audioRepair.js', { ...mocks, expo: { requireOptionalNativeModule: () => ({}) } });
  await assert.rejects(stale.createNormalizedAudio('source.m4a', 'copy.m4a', {}), /nouvelle IPA/);
  const failing = load('src/services/audioRepair.js', { ...mocks, expo: { requireOptionalNativeModule: () => ({ normalizeM4a: async () => { throw new Error('Read failed'); } }) } });
  await assert.rejects(failing.createNormalizedAudio('source.m4a', 'copy.m4a', {}), /Read failed/);
});

test('SoundCloud current AAC CDN prepares direct HLS without YouTube fallback', async () => {
  const service = soundcloudService(async url => {
    assert.ok(!url.includes('youtube.com'), 'must not search YouTube');
    if (url.includes('api-v2')) return response(url, JSON.stringify({ url: 'https://playback.media-streaming.soundcloud.cloud/track/aac_160k/playlist.m3u8' }));
    return response(url, scHTML({ ...scTrack, media: { transcodings: [{ ...scFormat, preset: 'aac_160k', format: { protocol: 'hls', mime_type: 'audio/mp4; codecs="mp4a.40.2"' } }] } }));
  });
  const result = await service.prepareMusicLink('https://soundcloud.com/artist/song', undefined, () => {});
  assert.equal(result.mode, 'hls-aac');
  assert.equal(new URL(result.mediaURL).hostname, 'playback.media-streaming.soundcloud.cloud');
  assert.equal(result.videoID, undefined);
});

test('SoundCloud lookalike CDN is still refused', async () => {
  const service = soundcloudService(async url => {
    if (url.includes('api-v2')) return response(url, JSON.stringify({ url: 'https://playback.media-streaming.soundcloud.cloud.evil.example/audio.m3u8' }));
    if (url.includes('youtube.com')) return response(url, searchHTML([{ id, title: 'Test Artist Northern Lights Official Audio', artist: target.artist, time: '3:00' }]));
    return response(url, scHTML({ ...scTrack, media: { transcodings: [scFormat] } }));
  });
  const result = await service.prepareMusicLink('https://soundcloud.com/artist/song', undefined, () => {});
  assert.equal(result.mediaURL, undefined);
});

const likesHTML = scHTML({}).replace('"hydratable":"sound","data":{}', '"hydratable":"user","data":{"id":123}');
test('SoundCloud likes URLs expand all pages, deduplicate, and skip liked playlists', async () => {
  assert.equal(p.parseMusicLink('https://m.soundcloud.com/person/likes?si=abc').likes, true);
  let pages = 0;
  const service = soundcloudService(async url => {
    if (!url.includes('api-v2')) return response(url, likesHTML);
    pages++;
    assert.equal(new URL(url).searchParams.get('client_id'), 'a'.repeat(32));
    return response(url, JSON.stringify(pages === 1 ? {
      collection: [{ track: { permalink_url: 'https://soundcloud.com/a/one' } }, { playlist: {} }],
      next_href: 'https://api-v2.soundcloud.com/users/123/likes?offset=next'
    } : { collection: [{ track: { permalink_url: 'https://soundcloud.com/a/one' } }, { track: { permalink_url: 'https://soundcloud.com/b/two' } }], next_href: null }));
  });
  const result = await service.expandImportLinks(['https://soundcloud.com/person/likes'], undefined, () => {});
  assert.equal(pages, 2);
  assert.deepEqual(result.links, ['https://soundcloud.com/a/one', 'https://soundcloud.com/b/two']);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /1 éléments/);
});
test('SoundCloud likes retains fetched tracks with warning on pagination failure', async () => {
  const service = soundcloudService(async url => {
    if (!url.includes('api-v2')) return response(url, likesHTML);
    if (url.includes('offset')) throw new Error('Network error');
    return response(url, JSON.stringify({ collection: [{ track: { permalink_url: 'https://soundcloud.com/a/one' } }], next_href: 'https://api-v2.soundcloud.com/users/123/likes?offset=next' }));
  });
  const result = await service.expandImportLinks(['https://soundcloud.com/person/likes'], undefined, () => {});
  assert.equal(result.links.length, 1);
  assert.match(result.warnings[0], /incomplète/);
});
test('SoundCloud likes rejects external pagination without sending client ID', async () => {
  const service = soundcloudService(async url => {
    assert.ok(!url.includes('evil.example'));
    if (!url.includes('api-v2')) return response(url, likesHTML);
    return response(url, JSON.stringify({ collection: [{ track: { permalink_url: 'https://soundcloud.com/a/one' } }], next_href: 'https://evil.example/users/123/likes' }));
  });
  const result = await service.expandImportLinks(['https://soundcloud.com/person/likes'], undefined, () => {});
  assert.equal(result.links.length, 1);
  assert.match(result.warnings[0], /incomplète/);
});

test('early duplicate detection canonicalizes source links, includes fallback video and checks local file', async () => {
  const service = load('src/services/importDedup.js', { './linkParsing': p,
    'expo-file-system/legacy': { getInfoAsync: async uri => ({ exists: uri !== 'missing', size: uri === 'empty' ? 0 : 100 }) } });
  const song = { uri: 'present', sourceUrl: 'https://soundcloud.com/artist/song?si=old', sourceKey: 'soundcloud:42', youtubeID: id };
  assert.equal(await service.findExistingImport([song], 'https://m.soundcloud.com/artist/song?si=new'), song);
  assert.equal(await service.findExistingImport([song], { sourceKey: 'soundcloud:42' }), song);
  assert.equal(await service.findExistingImport([song], `https://youtu.be/${id}`), song);
  assert.equal(await service.findExistingImport([{ ...song, uri: 'missing' }], song.sourceUrl), null);
  assert.equal(await service.findExistingImport([{ ...song, uri: 'empty' }], song.sourceUrl), null);
  assert.equal(await service.findExistingImport([{ uri: 'present', title: 'Same title' }], song.sourceUrl), null);
});
test('reimport restores missing audio while preserving playlist song ID and artwork', async () => {
  const m = libraryMock();
  const missing = { id: 'keep-id', uri: 'file:///documents/missing.m4a', sourceKey: download.sourceKey, title: 'My title', artworkPath: 'Artwork/custom.jpg' };
  const result = await m.library.commitDownloadedSong(download, [missing]);
  assert.equal(result.duplicate, false);
  assert.equal(result.songs.length, 1);
  assert.equal(result.song.id, 'keep-id');
  assert.equal(result.song.artworkPath, 'Artwork/custom.jpg');
  assert.equal(result.song.title, 'My title');
  assert.equal(m.files.get(result.song.uri), 'audio bytes');
});
