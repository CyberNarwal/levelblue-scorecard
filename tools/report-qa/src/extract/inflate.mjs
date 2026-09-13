/**
 * Raw DEFLATE decompression (RFC 1951) in plain JavaScript.
 *
 * Node has this in `zlib`, but importing `node:zlib` would stop the DOCX reader
 * running in a browser, and the standalone offline page needs to open Word files
 * with no server and no dependencies. This is the only piece of the pipeline
 * that needed platform-specific code, so it is the only piece reimplemented.
 *
 * The decoder follows the canonical-Huffman approach from Mark Adler's "puff"
 * reference implementation: walk the code lengths to build a count/symbol table,
 * then decode bit by bit. It is slower than zlib and does not care - a report is
 * a few hundred kilobytes and this runs once.
 *
 * Correctness is pinned against `zlib.inflateRawSync` in the test suite.
 */

const MAX_BITS = 15;

/** Length codes 257-285: base length and extra bits. */
const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];

/** Distance codes 0-29: base distance and extra bits. */
const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

/** The order in which code-length code lengths appear in a dynamic block. */
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** Bit reader, least-significant bit first, as DEFLATE requires. */
class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.position = 0;
    this.bitOffset = 0;
  }

  /** Read a single bit. */
  bit() {
    if (this.position >= this.bytes.length) throw new Error('Unexpected end of compressed data.');
    const value = (this.bytes[this.position] >> this.bitOffset) & 1;
    this.bitOffset += 1;
    if (this.bitOffset === 8) {
      this.bitOffset = 0;
      this.position += 1;
    }
    return value;
  }

  /** Read `count` bits as an unsigned integer. */
  bits(count) {
    let value = 0;
    for (let i = 0; i < count; i += 1) value |= this.bit() << i;
    return value;
  }

  /** Discard the rest of the current byte. */
  alignToByte() {
    if (this.bitOffset !== 0) {
      this.bitOffset = 0;
      this.position += 1;
    }
  }
}

/**
 * Build a canonical Huffman decoding table from a list of code lengths.
 * `count[n]` is how many codes have length n; `symbols` lists the symbols in
 * canonical order.
 */
function buildHuffman(lengths) {
  const count = new Int32Array(MAX_BITS + 1);
  for (const length of lengths) count[length] += 1;
  count[0] = 0;

  const offsets = new Int32Array(MAX_BITS + 2);
  for (let length = 1; length <= MAX_BITS; length += 1) {
    offsets[length + 1] = offsets[length] + count[length];
  }

  const symbols = new Int32Array(lengths.length);
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    if (lengths[symbol]) {
      symbols[offsets[lengths[symbol]]] = symbol;
      offsets[lengths[symbol]] += 1;
    }
  }
  return { count, symbols };
}

/** Decode one symbol by walking code lengths shortest-first. */
function decodeSymbol(reader, table) {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let length = 1; length <= MAX_BITS; length += 1) {
    code |= reader.bit();
    const available = table.count[length];
    if (code - first < available) return table.symbols[index + (code - first)];
    index += available;
    first = (first + available) << 1;
    code <<= 1;
  }
  throw new Error('Invalid Huffman code in compressed data.');
}

let fixedLiteralTable = null;
let fixedDistanceTable = null;

/** The fixed Huffman tables defined by the spec, built once. */
function fixedTables() {
  if (!fixedLiteralTable) {
    const literals = new Uint8Array(288);
    literals.fill(8, 0, 144);
    literals.fill(9, 144, 256);
    literals.fill(7, 256, 280);
    literals.fill(8, 280, 288);
    fixedLiteralTable = buildHuffman(literals);
    fixedDistanceTable = buildHuffman(new Uint8Array(30).fill(5));
  }
  return { literal: fixedLiteralTable, distance: fixedDistanceTable };
}

/** Read the two dynamic Huffman tables that precede a type-2 block. */
function dynamicTables(reader) {
  const literalCount = reader.bits(5) + 257;
  const distanceCount = reader.bits(5) + 1;
  const codeLengthCount = reader.bits(4) + 4;

  const codeLengths = new Uint8Array(19);
  for (let i = 0; i < codeLengthCount; i += 1) {
    codeLengths[CODE_LENGTH_ORDER[i]] = reader.bits(3);
  }
  const codeLengthTable = buildHuffman(codeLengths);

  // The literal and distance lengths are themselves Huffman-coded, with three
  // run-length escapes (16 repeats the previous, 17 and 18 repeat zero).
  const lengths = new Uint8Array(literalCount + distanceCount);
  let index = 0;
  while (index < lengths.length) {
    const symbol = decodeSymbol(reader, codeLengthTable);
    if (symbol < 16) {
      lengths[index] = symbol;
      index += 1;
    } else if (symbol === 16) {
      if (index === 0) throw new Error('Invalid code-length repeat at start of block.');
      const previous = lengths[index - 1];
      const repeat = 3 + reader.bits(2);
      for (let i = 0; i < repeat; i += 1) lengths[index + i] = previous;
      index += repeat;
    } else if (symbol === 17) {
      index += 3 + reader.bits(3);
    } else {
      index += 11 + reader.bits(7);
    }
  }
  if (index > lengths.length) throw new Error('Code lengths overflow the declared table size.');

  return {
    literal: buildHuffman(lengths.subarray(0, literalCount)),
    distance: buildHuffman(lengths.subarray(literalCount)),
  };
}

/** Output buffer that grows geometrically rather than per byte. */
class Output {
  constructor(initial = 1 << 16) {
    this.bytes = new Uint8Array(initial);
    this.length = 0;
  }

  ensure(extra) {
    if (this.length + extra <= this.bytes.length) return;
    let size = this.bytes.length * 2;
    while (size < this.length + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.bytes.subarray(0, this.length));
    this.bytes = grown;
  }

  push(byte) {
    this.ensure(1);
    this.bytes[this.length] = byte;
    this.length += 1;
  }

  /**
   * Copy `count` bytes from `distance` back in the output. The ranges may
   * overlap - that is how DEFLATE encodes runs - so this copies byte by byte
   * rather than using set().
   */
  copyBack(distance, count) {
    if (distance > this.length) throw new Error('Back-reference points before the start of the output.');
    this.ensure(count);
    let from = this.length - distance;
    for (let i = 0; i < count; i += 1) {
      this.bytes[this.length] = this.bytes[from];
      this.length += 1;
      from += 1;
    }
  }

  result() {
    return this.bytes.subarray(0, this.length);
  }
}

/**
 * Decompress a raw DEFLATE stream (no zlib or gzip header).
 * Accepts any array-like of bytes; returns a Uint8Array.
 */
export function inflateRaw(input) {
  const reader = new BitReader(input instanceof Uint8Array ? input : new Uint8Array(input));
  const output = new Output(Math.max(1 << 16, input.length * 4));

  for (;;) {
    const isFinal = reader.bit();
    const type = reader.bits(2);

    if (type === 0) {
      // Stored: length, its complement, then the bytes verbatim.
      reader.alignToByte();
      const length = reader.bytes[reader.position] | (reader.bytes[reader.position + 1] << 8);
      const check = reader.bytes[reader.position + 2] | (reader.bytes[reader.position + 3] << 8);
      if ((length ^ 0xFFFF) !== check) throw new Error('Stored block length check failed.');
      reader.position += 4;
      output.ensure(length);
      for (let i = 0; i < length; i += 1) output.push(reader.bytes[reader.position + i]);
      reader.position += length;
    } else if (type === 1 || type === 2) {
      const tables = type === 1 ? fixedTables() : dynamicTables(reader);
      for (;;) {
        const symbol = decodeSymbol(reader, tables.literal);
        if (symbol < 256) {
          output.push(symbol);
        } else if (symbol === 256) {
          break; // end of block
        } else {
          const lengthIndex = symbol - 257;
          if (lengthIndex >= LENGTH_BASE.length) throw new Error('Invalid length code.');
          const length = LENGTH_BASE[lengthIndex] + reader.bits(LENGTH_EXTRA[lengthIndex]);
          const distanceSymbol = decodeSymbol(reader, tables.distance);
          if (distanceSymbol >= DISTANCE_BASE.length) throw new Error('Invalid distance code.');
          const distance = DISTANCE_BASE[distanceSymbol] + reader.bits(DISTANCE_EXTRA[distanceSymbol]);
          output.copyBack(distance, length);
        }
      }
    } else {
      throw new Error('Invalid DEFLATE block type.');
    }

    if (isFinal) break;
  }

  return output.result();
}

/** Decompress a zlib stream (RFC 1950): a two-byte header, then raw DEFLATE. */
export function inflateZlib(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 2) throw new Error('Truncated zlib stream.');
  if ((bytes[0] & 0x0F) !== 8) throw new Error('Unsupported zlib compression method.');
  return inflateRaw(bytes.subarray(2));
}
