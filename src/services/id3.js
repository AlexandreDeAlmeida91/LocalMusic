import * as FileSystem from 'expo-file-system/legacy';

const MAX_TAG_BYTES = 8 * 1024 * 1024;

function base64ToBytes(base64) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    const part = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...part);
  }

  return globalThis.btoa(binary);
}

function synchsafeToInt(bytes, offset) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function uint32ToInt(bytes, offset) {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function latin1(bytes) {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function utf8(bytes) {
  try {
    return decodeURIComponent(
      Array.from(bytes)
        .map((b) => `%${b.toString(16).padStart(2, '0')}`)
        .join('')
    );
  } catch {
    return latin1(bytes);
  }
}

function utf16(bytes, bigEndian = false) {
  let offset = 0;
  let be = bigEndian;

  if (bytes.length >= 2) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      be = true;
      offset = 2;
    } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      be = false;
      offset = 2;
    }
  }

  let out = '';
  for (let i = offset; i + 1 < bytes.length; i += 2) {
    const code = be
      ? (bytes[i] << 8) | bytes[i + 1]
      : bytes[i] | (bytes[i + 1] << 8);

    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

function cleanText(value) {
  return value.replace(/\u0000/g, '').trim();
}

function decodeTextFrame(frame) {
  if (!frame.length) return null;

  const encoding = frame[0];
  const payload = frame.subarray(1);

  switch (encoding) {
    case 0:
      return cleanText(latin1(payload));
    case 1:
      return cleanText(utf16(payload));
    case 2:
      return cleanText(utf16(payload, true));
    case 3:
      return cleanText(utf8(payload));
    default:
      return null;
  }
}

function findTerminator(bytes, start, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i + 2;
    }
    return bytes.length;
  }

  for (let i = start; i < bytes.length; i += 1) {
    if (bytes[i] === 0) return i + 1;
  }
  return bytes.length;
}

function parseArtwork(frame) {
  if (!frame.length) return null;

  const encoding = frame[0];
  let cursor = 1;

  let mimeEnd = cursor;
  while (mimeEnd < frame.length && frame[mimeEnd] !== 0) mimeEnd += 1;
  const mime = latin1(frame.subarray(cursor, mimeEnd)) || 'image/jpeg';
  cursor = Math.min(mimeEnd + 1, frame.length);

  // Picture type byte.
  cursor = Math.min(cursor + 1, frame.length);

  // Description (null terminated, encoding-aware).
  cursor = findTerminator(frame, cursor, encoding);
  if (cursor >= frame.length) return null;

  const imageBytes = frame.subarray(cursor);
  if (!imageBytes.length) return null;

  const normalizedMime =
    mime === 'image/jpg' ? 'image/jpeg' :
    mime.startsWith('image/') ? mime :
    'image/jpeg';

  return `data:${normalizedMime};base64,${bytesToBase64(imageBytes)}`;
}

export async function readId3Metadata(uri, fallbackTitle) {
  const fallback = {
    title: fallbackTitle,
    artist: 'Artiste inconnu',
    album: 'Album inconnu',
    artworkUri: null
  };

  try {
    const headerBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 10
    });

    const header = base64ToBytes(headerBase64);

    if (
      header.length < 10 ||
      header[0] !== 0x49 ||
      header[1] !== 0x44 ||
      header[2] !== 0x33
    ) {
      return fallback;
    }

    const versionMajor = header[3];
    if (versionMajor !== 3 && versionMajor !== 4) {
      return fallback;
    }

    const tagSize = synchsafeToInt(header, 6);
    const bytesToRead = Math.min(tagSize + 10, MAX_TAG_BYTES);

    const tagBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: bytesToRead
    });

    const bytes = base64ToBytes(tagBase64);
    let cursor = 10;

    let title = null;
    let artist = null;
    let album = null;
    let artworkUri = null;

    while (cursor + 10 <= bytes.length) {
      const id = String.fromCharCode(
        bytes[cursor],
        bytes[cursor + 1],
        bytes[cursor + 2],
        bytes[cursor + 3]
      );

      if (!/^[A-Z0-9]{4}$/.test(id)) break;

      const size =
        versionMajor === 4
          ? synchsafeToInt(bytes, cursor + 4)
          : uint32ToInt(bytes, cursor + 4);

      if (!size || cursor + 10 + size > bytes.length) break;

      const frame = bytes.subarray(cursor + 10, cursor + 10 + size);

      if (id === 'TIT2') title = decodeTextFrame(frame) || title;
      if (id === 'TPE1') artist = decodeTextFrame(frame) || artist;
      if (id === 'TALB') album = decodeTextFrame(frame) || album;
      if (id === 'APIC' && !artworkUri) artworkUri = parseArtwork(frame);

      cursor += 10 + size;
    }

    return {
      title: title || fallback.title,
      artist: artist || fallback.artist,
      album: album || fallback.album,
      artworkUri
    };
  } catch {
    return fallback;
  }
}
