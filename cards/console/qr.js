// Dependency-free QR Code encoder (ISO/IEC 18004:2015 Model 2).
// Byte mode (UTF-8) for general text; alphanumeric mode when every character
// is in the 45-char alphanumeric set. ECC levels L/M/Q/H, versions 1..40,
// automatic smallest version, all 8 masks with the standard penalty rules.
//
// Coordinates: modules[y][x], y = row (top->bottom), x = column (left->right).

const ECC_LEVELS = ["L", "M", "Q", "H"];
// 2-bit ECC level indicator used in the format information (note: not in L,M,Q,H order).
const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

// Block structure table (ISO/IEC 18004 Table 9), indexed [ecc][version]; index 0 unused.
// ECC_PER_BLOCK: error-correction codewords in EVERY block (same for both groups).
// NUM_BLOCKS: total number of RS blocks (group 1 + group 2).
// Group sizes are derived rather than tabulated: the total codeword count R for a
// version is fixed, and the spec splits it so group 1 has floor(R/B) codewords per
// block and group 2 blocks carry exactly one more DATA codeword. So with
// B blocks, the number of group-1 ("short") blocks is B - (R mod B).
const ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const NUM_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

// ---------------------------------------------------------------- GF(256) / Reed-Solomon
// Field GF(2^8) with primitive polynomial x^8+x^4+x^3+x^2+1 (0x11D), generator alpha = 2.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x; LOG[x] = i;
  x <<= 1; if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const gfMul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

// Generator polynomial g(x) = (x - a^0)(x - a^1)...(x - a^(n-1)), coefficients
// high-order first with the leading 1 dropped (length n).
const genCache = new Map();
function rsGenerator(n) {
  if (genCache.has(n)) return genCache.get(n);
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];                    // * x
      next[j + 1] ^= gfMul(g[j], EXP[i]); // * a^i  (minus == plus in GF(2^8))
    }
    g = next;
  }
  const out = Uint8Array.from(g.slice(1));
  genCache.set(n, out);
  return out;
}

/** ECC codewords for one block: remainder of data(x) * x^n divided by g(x). */
export function rsEncode(data, n) {
  const gen = rsGenerator(n);
  const rem = new Uint8Array(n);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.copyWithin(0, 1); rem[n - 1] = 0;
    for (let i = 0; i < n; i++) rem[i] ^= gfMul(gen[i], factor);
  }
  return rem;
}

// ---------------------------------------------------------------- capacities
// Raw data modules (data + ECC bits, including remainder bits) for a version:
// everything minus finders+separators+format, timing, alignment, version info.
function rawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const na = Math.floor(ver / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const totalCodewords = (ver) => Math.floor(rawDataModules(ver) / 8);
export const dataCodewords = (ver, ecc) =>
  totalCodewords(ver) - ECC_PER_BLOCK[ecc][ver] * NUM_BLOCKS[ecc][ver];

/** Alignment pattern centre coordinates (ISO/IEC 18004 Annex E), same for rows and cols. */
export function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// ---------------------------------------------------------------- BCH format / version info
/** 15-bit format information (already XORed with 101010000010010). */
export function formatBits(ecc, mask) {
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); // BCH(15,5), g = 10100110111
  return ((data << 10) | rem) ^ 0x5412;
}
/** 18-bit version information for versions 7..40 (BCH(18,6), g = 1111100100101). */
export function versionBits(ver) {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}

// ---------------------------------------------------------------- data encoding
class BitBuffer {
  constructor() { this.bits = []; }
  put(val, len) { for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1); }
}

function makeSegment(text) {
  if (text.length > 0 && [...text].every((c) => ALNUM.includes(c))) {
    return {
      mode: 0b0010, count: text.length, ccBits: [9, 11, 13],
      write(bb) {
        let i = 0;
        for (; i + 1 < text.length; i += 2) bb.put(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
        if (i < text.length) bb.put(ALNUM.indexOf(text[i]), 6);
      },
      bitLen: 11 * Math.floor(text.length / 2) + 6 * (text.length % 2),
    };
  }
  const bytes = new TextEncoder().encode(text);
  return {
    mode: 0b0100, count: bytes.length, ccBits: [8, 16, 16],
    write(bb) { for (const b of bytes) bb.put(b, 8); },
    bitLen: bytes.length * 8,
  };
}
// Character-count field width depends on version band 1-9 / 10-26 / 27-40.
const ccWidth = (seg, ver) => seg.ccBits[ver <= 9 ? 0 : ver <= 26 ? 1 : 2];

// ---------------------------------------------------------------- matrix construction
function buildMatrix(ver) {
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Uint8Array(size));
  const fn = Array.from({ length: size }, () => new Uint8Array(size)); // 1 = function module
  const set = (x, y, dark) => { m[y][x] = dark ? 1 : 0; fn[y][x] = 1; };

  // Timing patterns: row 6 and column 6, dark on even indices.
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  // Finder patterns (7x7) plus their 1-module light separators, drawn as a 9x9
  // Chebyshev-distance pattern clipped to the symbol.
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  }
  // Alignment patterns (5x5) at every pair of centre coordinates, except the three
  // that would collide with finder patterns.
  const al = alignmentPositions(ver), last = al.length - 1;
  al.forEach((cy, i) => al.forEach((cx, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  // Reserve format areas now (real bits written per mask later) and draw the
  // "dark module" at (x=8, y=size-8), which is always dark and belongs to no pattern.
  drawFormat(m, fn, size, 0);
  // Version information (v7+): two 6x3 blocks, bottom-left and top-right.
  if (ver >= 7) {
    const vb = versionBits(ver);
    for (let i = 0; i < 18; i++) {
      const bit = (vb >>> i) & 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, bit); set(b, a, bit);
    }
  }
  return { size, m, fn };
}

function drawFormat(m, fn, size, bits) {
  const set = (x, y, dark) => { m[y][x] = dark ? 1 : 0; fn[y][x] = 1; };
  const bit = (i) => (bits >>> i) & 1; // bit 0 = LSB of the 15-bit word
  // Copy 1, around the top-left finder (skips the timing row/col at index 6).
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  // Copy 2, split between the top-right (bits 0-7) and bottom-left (bits 8-14) finders.
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, 1); // dark module
}

function placeCodewords(m, fn, size, codewords) {
  // Zig-zag in 2-column strips from the bottom-right, alternating up/down,
  // skipping the vertical timing column (x = 6). Leftover remainder bits stay 0.
  let i = 0; const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++) {
      const y = upward ? size - 1 - v : v;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (fn[y][x]) continue;
        if (i < total) m[y][x] = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
        i++;
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
function applyMask(m, fn, size, k) {
  const f = MASKS[k];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    if (!fn[y][x] && f(x, y)) m[y][x] ^= 1;
}

// Penalty score (ISO/IEC 18004 7.8.3): N1=3, N2=3, N3=40, N4=10.
function penalty(m, size) {
  let score = 0, dark = 0;
  const line = (get) => {
    let s = 0, run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && get(i) === get(i - 1)) { run++; continue; }
      if (run >= 5) s += 3 + (run - 5); // rule 1: runs of 5+ same colour
      run = 1;
    }
    // rule 3: each 1:1:3:1:1 (dark:light:dark:dark:dark:light:dark) pattern that is
    // preceded OR followed by 4 light modules. Modules outside the symbol count as
    // light (they are quiet zone).
    const at = (i) => (i >= 0 && i < size ? get(i) : 0);
    const light4 = (i) => !at(i) && !at(i + 1) && !at(i + 2) && !at(i + 3);
    for (let i = 0; i + 7 <= size; i++) {
      if (at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6) &&
          (light4(i - 4) || light4(i + 7))) s += 40;
    }
    return s;
  };
  for (let y = 0; y < size; y++) score += line((x) => m[y][x]);
  for (let x = 0; x < size; x++) score += line((y) => m[y][x]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    dark += m[y][x];
    if (x + 1 < size && y + 1 < size) { // rule 2: 2x2 same-colour blocks
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
  }
  // rule 4: 10 points per full 5% the dark ratio deviates from 50%
  // (|100*dark/total - 50| / 5 == |20*dark - 10*total| / total).
  const total = size * size;
  score += 10 * Math.floor(Math.abs(dark * 20 - total * 10) / total);
  return score;
}

// ---------------------------------------------------------------- public API
/** Split data into RS blocks, append ECC to each, and interleave (7.6). */
export function buildCodewords(data, ver, ecc) {
  const nb = NUM_BLOCKS[ecc][ver], eccLen = ECC_PER_BLOCK[ecc][ver];
  const raw = totalCodewords(ver);
  const shortBlocks = nb - (raw % nb);          // group 1 count
  const shortLen = Math.floor(raw / nb);        // group 1 total codewords per block
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dlen = shortLen - eccLen + (i < shortBlocks ? 0 : 1); // group 2 = +1 data cw
    const d = data.slice(k, k + dlen); k += dlen;
    blocks.push({ d, e: rsEncode(d, eccLen) });
  }
  const out = [];
  for (let i = 0; i <= shortLen - eccLen; i++)
    for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < eccLen; i++) for (const b of blocks) out.push(b.e[i]);
  return Uint8Array.from(out);
}

/** Encoded data codewords (mode, count, payload, terminator, padding) for a version. */
export function dataCodewordsFor(text, ver, ecc) {
  const seg = makeSegment(text);
  const cap = dataCodewords(ver, ecc) * 8;
  const bb = new BitBuffer();
  bb.put(seg.mode, 4);
  bb.put(seg.count, ccWidth(seg, ver));
  seg.write(bb);
  if (bb.bits.length > cap) return null;
  bb.put(0, Math.min(4, cap - bb.bits.length)); // terminator
  bb.put(0, (8 - (bb.bits.length % 8)) % 8);    // byte align
  for (let pad = 0xec; bb.bits.length < cap; pad ^= 0xec ^ 0x11) bb.put(pad, 8);
  const out = new Uint8Array(cap / 8);
  bb.bits.forEach((b, i) => { out[i >>> 3] |= b << (7 - (i & 7)); });
  return out;
}

export function encodeQR(text, { ecc = "M", mask: forcedMask } = {}) {
  if (!ECC_LEVELS.includes(ecc)) throw new Error(`Invalid ECC level: ${ecc}`);
  text = String(text);
  let ver = 1, data = null;
  for (; ver <= 40; ver++) if ((data = dataCodewordsFor(text, ver, ecc))) break;
  if (!data) throw new Error("Text too long for a QR code (exceeds version 40)");

  const { size, m, fn } = buildMatrix(ver);
  placeCodewords(m, fn, size, buildCodewords(data, ver, ecc));

  let best = forcedMask ?? -1;
  if (best < 0) {
    let bestScore = Infinity;
    for (let k = 0; k < 8; k++) {
      applyMask(m, fn, size, k);
      drawFormat(m, fn, size, formatBits(ecc, k));
      const s = penalty(m, size);
      if (s < bestScore) { bestScore = s; best = k; }
      applyMask(m, fn, size, k); // undo (XOR)
    }
  }
  applyMask(m, fn, size, best);
  drawFormat(m, fn, size, formatBits(ecc, best));
  return { size, modules: m, version: ver, ecc, mask: best };
}

export function qrToSvgPath(qr, { margin = 4 } = {}) {
  const { size, modules } = qr;
  const n = size + margin * 2;
  let d = "";
  // Merge horizontal runs of dark modules into one rect each.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; ) {
      if (!modules[y][x]) { x++; continue; }
      let e = x; while (e < size && modules[y][e]) e++;
      d += `M${x + margin} ${y + margin}h${e - x}v1h${x - e}z`;
      x = e;
    }
  }
  return { viewBox: `0 0 ${n} ${n}`, d };
}
