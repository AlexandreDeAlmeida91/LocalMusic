// Lossless normalization for MPEG-1 Layer III files with a complete Info/Xing
// frame (FFmpeg/LAME layout). Unsupported layouts are left unchanged.
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));
const u32 = (b, i) => (b[i] * 0x1000000 + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]) >>> 0;
const put32 = (b, i, n) => { b[i] = n >>> 24; b[i + 1] = n >>> 16; b[i + 2] = n >>> 8; b[i + 3] = n; };
function frame(b, i) {
  if (i + 4 > b.length || b[i] !== 255 || (b[i + 1] & 254) !== 250) return null;
  // MPEG-1 Layer III; CRC-protected frames are not rewritten.
  if ((b[i + 1] & 1) !== 1) return null;
  const rate = [44100, 48000, 32000][(b[i + 2] >> 2) & 3];
  const bitrate = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320][b[i + 2] >> 4];
  if (!rate || !bitrate) return null;
  return { rate, mono: (b[i + 3] >> 6) === 3, size: Math.floor(144000 * bitrate / rate) + ((b[i + 2] >> 1) & 1) };
}
function tag(metadata) {
  const chunks = [];
  for (const [key, value] of [['TIT2', metadata.title], ['TPE1', metadata.artist], ['TALB', metadata.album]]) {
    if (!value) continue;
    const text = String(value).slice(0, 4096);
    const chunk = new Uint8Array(10 + 3 + text.length * 2 + 2);
    for (let i = 0; i < 4; i++) chunk[i] = key.charCodeAt(i);
    put32(chunk, 4, chunk.length - 10);
    chunk[10] = 1; chunk[11] = 255; chunk[12] = 254;
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); chunk[13 + i * 2] = c; chunk[14 + i * 2] = c >> 8; }
    chunks.push(chunk);
  }
  const size = chunks.reduce((n, c) => n + c.length, 0);
  const result = new Uint8Array(size + 10);
  result.set([73,68,51,3,0,0,(size >> 21) & 127,(size >> 14) & 127,(size >> 7) & 127,size & 127]);
  let offset = 10;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export function normalizeMp3(input, metadata = {}) {
  const unchanged = reason => ({ changed: false, reason });
  let start = 0, end = input.length;
  if (ascii(input, 0, 3) === 'ID3') {
    if (![3,4].includes(input[3]) || input.length < 10 || input.subarray(6,10).some(v => v > 127)) return unchanged('Métadonnées non prises en charge.');
    start = 10 + input[6] * 2097152 + input[7] * 16384 + input[8] * 128 + input[9];
    if (input[3] === 4 && (input[5] & 16)) start += 10;
  }
  if (end >= 128 && ascii(input, end - 128, 3) === 'TAG') end -= 128;
  const first = frame(input, start);
  if (!first || first.mono || start + first.size > end) return unchanged('Format MP3 non pris en charge par cette réparation.');
  const info = start + 36;
  if (!['Info','Xing'].includes(ascii(input, info, 4)) || u32(input, info + 4) !== 15 || first.size < 192) return unchanged('En-tête Info/Xing compatible absent.');
  if (!/^(Lavc|Lavf|LAME)/.test(ascii(input, info + 120, 9))) return unchanged('En-tête d’encodeur non reconnu.');
  let cursor = start + first.size, count = 0;
  while (cursor < end) {
    const next = frame(input, cursor);
    if (!next || next.rate !== first.rate || next.mono !== first.mono || cursor + next.size > end) return unchanged('Structure MP3 irrégulière ; original conservé.');
    cursor += next.size; count++;
  }
  if (!count || u32(input, info + 8) !== count || u32(input, info + 12) !== end - start) return unchanged('Index MP3 incohérent ; original conservé.');
  const audio = new Uint8Array(input.subarray(start, end));
  // The first frame is metadata only. Preserve the complete compressed audio
  // frames and the existing gapless delay/padding, counts and seek table.
  audio[3] = 0;
  if (ascii(audio, 156, 4) !== 'LAME') {
    audio.fill(0, 156, 165);
    audio.set([76,97,118,102], 156);
  }
  let crc = 0;
  for (let i = 0; i < 190; i++) {
    crc ^= audio[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  audio[190] = crc >> 8; audio[191] = crc & 255;
  const id3 = tag(metadata);
  const bytes = new Uint8Array(id3.length + audio.length);
  bytes.set(id3); bytes.set(audio, id3.length);
  const delay = (audio[177] << 4) | (audio[178] >> 4);
  const padding = ((audio[178] & 15) << 8) | audio[179];
  return { changed: true, bytes, duration: (count * 1152 - delay - padding) / first.rate, audioStart: id3.length + first.size };
}
