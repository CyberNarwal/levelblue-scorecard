/**
 * Minimal ZIP writer, enough to rebuild an Office package.
 *
 * Only two things are ever written: parts copied out of the original archive
 * with their compressed bytes untouched, and the handful of small XML parts we
 * generate, which are stored uncompressed. That combination means no DEFLATE
 * encoder is needed - the expensive half of ZIP writing - while a 4 MB deck
 * grows by only the few kilobytes of XML we actually added.
 *
 * Nothing here uses a Node API, because this runs in the viewer's browser.
 */

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a ZIP archive.
 *
 * Each entry is either `{ name, text }` / `{ name, data }` for something we are
 * creating, or `{ name, raw }` where `raw` came from `readZipEntries` and is
 * written back byte for byte.
 */
export function writeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    let method;
    let crc;
    let compressed;
    let uncompressedSize;

    if (entry.raw) {
      ({ method, crc, uncompressedSize } = entry.raw);
      compressed = entry.raw.bytes;
    } else {
      const data = entry.data ?? encoder.encode(entry.text);
      method = 0;
      crc = crc32(data);
      compressed = data;
      uncompressedSize = data.length;
    }

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true); // time and date are left at zero: an Office
    lv.setUint16(12, 0, true); // package carries its own dates in docProps.
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, uncompressedSize, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local, compressed);

    const entryHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(entryHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, uncompressedSize, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    entryHeader.set(nameBytes, 46);
    central.push(entryHeader);

    offset += local.length + compressed.length;
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...parts, ...central, end];
  const total = all.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
