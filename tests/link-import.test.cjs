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
    'file:///private/file', 'https://open.spotify.com/playlist/123', 'https://youtube.com/playlist?list=123',
    'https://soundcloud.com/artist/sets/collection', 'https://youtu.be/short', 'https://localhost/watch?v=abcdefghijk']) {
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

function libraryMock({ failSave = false } = {}) {
  const files = new Map([['file:///cache/PeakImports/new.m4a', 'audio bytes']]);
  let stored = null;
  const f = {
    cacheDirectory: 'file:///cache/',
    getInfoAsync: async uri => ({ exists: files.has(uri) }),
    moveAsync: async ({ from, to }) => { if (!files.has(from)) throw new Error('Missing'); files.set(to, files.get(from)); files.delete(from); },
    deleteAsync: async uri => files.delete(uri)
  };
  const storage = {
    ROOT_DIR: 'file:///documents/LocalMusic/', MUSIC_DIR: 'file:///documents/LocalMusic/Music/',
    ensureDirectories: async () => {}, relativeLocalPath: value => value,
    resolveLocalPath: value => `file:///documents/LocalMusic/${value}`,
    writeJsonAtomic: async (_, value) => { if (failSave) throw new Error('Disk full'); stored = value; }
  };
  const library = load('src/services/library.js', { 'expo-file-system/legacy': f, 'expo-document-picker': {}, './id3': {}, './storage': storage });
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
  const old = { id: 'old', title: 'Song', youtubeID: id, sourceKey: 'spotify:123' };
  const result = await m.library.commitDownloadedSong(download, [old]);
  assert.equal(result.duplicate, true);
  assert.equal(result.song, old);
  assert.equal(m.files.size, 0);
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
