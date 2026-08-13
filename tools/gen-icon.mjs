#!/usr/bin/env node
/**
 * gen-icon.mjs — Zero-dependency app icon generator for DemonSave-PS3.
 *
 * Produces the full Tauri icon set in src-tauri/icons/ from procedurally
 * rendered pixels (no external assets, no native libs):
 *
 *   icon.png          512×512  (master / source)
 *   128x128@2x.png    256×256
 *   128x128.png       128×128
 *   32x32.png         32×32
 *   icon.ico          Windows  (16/32/64/128/256 PNG-encoded entries)
 *   icon.icns         macOS    (ic11/ic12/ic07/ic08/ic09)
 *
 * Design: "Soul Crest" — a heraldic rune medallion. A steel-blue beveled
 * ring frames a dark enamel field bearing two crossed swords (saltire) with
 * a glowing soul orb at the crossing and four cardinal rune marks. Crisp,
 * symmetric, game-item style — reads clearly down to 32×32. The blue
 * matches the app's Apple-blue accent (#0a84ff / #0071e3).
 *
 * Only Node built-ins are used: node:fs, node:path, node:zlib.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'src-tauri', 'icons');

// ─── Math helpers ────────────────────────────────────────────────────
/**
 * @param {number} v
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
const lerp = (a, b, t) => a + (b - a) * t;
/**
 * @param {number} a
 * @param {number} b
 * @param {number} x
 * @returns {number}
 */
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/**
 * @param {number} x
 * @param {number} sigma
 * @returns {number}
 */
const gauss = (x, sigma) => Math.exp(-(x * x) / (2 * sigma * sigma));
// antialiased "inside half-width hw" coverage at coordinate x (centered 0)
/**
 * @param {number} hw
 * @param {number} x
 * @param {number} [ew=0.009]
 * @returns {number}
 */
const aaHW = (hw, x, ew = 0.009) => clamp((hw - Math.abs(x)) / ew + 0.5, 0, 1);

// ─── Medallion geometry ──────────────────────────────────────────────
const RING_IN = 0.6;
const RING_OUT = 0.705;
const FIELD_R = 0.585;
const ORB_R = 0.165;

// Rune marks at the four cardinal points, sitting on the ring band.
const RUNES = [
  [0, -(RING_IN + RING_OUT) / 2], // N (top)
  [(RING_IN + RING_OUT) / 2, 0], // E (right)
  [0, (RING_IN + RING_OUT) / 2], // S (bottom)
  [-(RING_IN + RING_OUT) / 2, 0], // W (left)
];

// ─── Sword geometry (local coords: p along blade +toward tip, q across) ─
const TIP_P = 0.5;
const GUARD_P = 0.0;
const GRIP_P = -0.34; // eslint-disable-line no-unused-vars -- kept for documentation
const POMMEL_P = -0.38;
const BLADE_HW0 = 0.046;

// Returns additive [r,g,b] for one sword at local (p,q).
/**
 * @param {number} p
 * @param {number} q
 * @returns {number[]}
 */
function drawSword(p, q) {
  let R = 0,
    G = 0,
    B = 0;

  // Blade (p: GUARD_P → TIP_P), tapers to a point.
  if (p >= GUARD_P && p <= TIP_P) {
    const k = (TIP_P - p) / (TIP_P - GUARD_P); // 1 at guard → 0 at tip
    const hw = BLADE_HW0 * Math.pow(k, 0.9);
    const cov = aaHW(hw, q, 0.007);
    if (cov > 0) {
      const edge = hw > 0.001 ? clamp(Math.abs(q) / hw, 0, 1) : 0;
      const steel = lerp(150, 84, edge);
      const vh = smoothstep(GUARD_P, TIP_P, p);
      const bright = lerp(0.92, 1.12, vh);
      R += steel * 0.95 * bright * cov;
      G += (steel + 6) * 0.97 * bright * cov;
      B += (steel + 26) * bright * cov;
      // fuller groove
      const fuller = gauss(q, 0.009) * cov;
      R += 80 * fuller;
      G += 100 * fuller;
      B += 145 * fuller;
      // blue edge rim glow
      const rim = gauss(Math.abs(q) - hw, 0.011) * cov;
      R += 48 * rim;
      G += 108 * rim;
      B += 212 * rim;
    }
  }

  // Crossguard — lens-shaped steel bar around p ≈ GUARD_P.
  if (p >= -0.05 && p <= 0.08) {
    const gmid = 0.015;
    const gp = (p - gmid) / 0.065; // -1..1 across guard thickness
    const ghw = 0.125 - 0.035 * gp * gp; // wider mid, narrower ends
    const cov = aaHW(ghw, q, 0.01);
    const ctr = gauss(q, 0.04) * 0.5;
    R += (112 + 70 * ctr) * cov;
    G += (120 + 75 * ctr) * cov;
    B += (144 + 88 * ctr) * cov;
    const ge = gauss(Math.abs(q) - ghw, 0.011) * cov;
    R += 40 * ge;
    G += 95 * ge;
    B += 192 * ge;
  }

  // Grip — narrow dark steel bar with a center wrap highlight.
  if (p < -0.05 && p > POMMEL_P + 0.02) {
    const cov = aaHW(0.024, q, 0.007);
    const ctr = gauss(q, 0.008) * 0.6;
    R += (68 + 92 * ctr) * cov;
    G += (70 + 96 * ctr) * cov;
    B += (92 + 112 * ctr) * cov;
  }

  // Pommel — small bright disk at the hilt end.
  if (p <= POMMEL_P + 0.05) {
    const pd = Math.sqrt(q * q + (p - POMMEL_P) ** 2);
    const rim = gauss(pd - 0.04, 0.009);
    const core = aaHW(0.036, pd, 0.008) * 0.85;
    const e = rim * 0.9 + core;
    R += 138 * e;
    G += 156 * e;
    B += 188 * e;
    R += 34 * rim;
    G += 84 * rim;
    B += 176 * rim;
  }

  return [R, G, B];
}

// Draw one sword tilted by angle θ (blade tip direction from straight up,
// positive = tip leans toward +u). du,dv = sample point relative to center.
// Screen coords: u right, v down, so "up" = -v.
/**
 * @param {number} du
 * @param {number} dv
 * @param {number} theta
 * @returns {number[]}
 */
function drawTiltedSword(du, dv, theta) {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const p = du * s - dv * c; // along blade, + toward tip
  const q = du * c + dv * s; // across blade
  return drawSword(p, q);
}

// ─── Squircle tile mask (superellipse, antialiased) ──────────────────
/**
 * @param {number} u
 * @param {number} v
 * @returns {number}
 */
function squircleCover(u, v) {
  const n = 5;
  const f = Math.abs(u) ** n + Math.abs(v) ** n;
  const ew = 0.02;
  if (f <= 1 - ew) return 1;
  if (f >= 1 + ew) return 0;
  return (1 + ew - f) / (2 * ew);
}

// ─── Compose the full crest at one sample point (u,v ∈ [-1,1]) ───────
/**
 * @param {number} u
 * @param {number} v
 * @returns {number[]}
 */
function sample(u, v) {
  const cover = squircleCover(u, v);
  if (cover <= 0) return [0, 0, 0, 0];

  const du = u;
  const dv = v;
  const r = Math.sqrt(du * du + dv * dv);

  // ── Background: radial navy→black + vignette ──────────────────────
  const bgT = smoothstep(0.0, 1.15, r);
  let r0 = lerp(30, 6, bgT);
  let g0 = lerp(33, 7, bgT);
  let b0 = lerp(52, 13, bgT);
  const vig = 1 - 0.4 * smoothstep(0.5, 1.12, r);
  let R = r0 * vig;
  let G = g0 * vig;
  let B = b0 * vig;

  // ── Outer halo around the medallion (soft blue glow) ──────────────
  const og = gauss(r - 0.74, 0.05) * 0.5;
  R += 22 * og;
  G += 50 * og;
  B += 110 * og;

  // ── Enamel inner field (disc) ─────────────────────────────────────
  const fCov = aaHW(FIELD_R, r, 0.01);
  if (fCov > 0) {
    R += 24 * fCov;
    G += 28 * fCov;
    B += 52 * fCov;
    // central depth glow
    const cg = smoothstep(0.45, 0.0, r) * 0.55;
    R += 16 * cg * fCov;
    G += 30 * cg * fCov;
    B += 64 * cg * fCov;
  }

  // ── Inner shadow just inside the ring (recessed enamel edge) ──────
  const recess = gauss(r - (FIELD_R - 0.0), 0.02) * 0.5;
  R -= 14 * recess;
  G -= 14 * recess;
  B -= 16 * recess;

  // ── Metal ring band (beveled steel-blue, lit from top) ────────────
  const outCov = aaHW(RING_OUT, r, 0.008);
  const inCov = aaHW(RING_IN, r, 0.008);
  const band = clamp(outCov - inCov, 0, 1);
  if (band > 0) {
    const upNess = r > 1e-4 ? clamp(-dv / r, -1, 1) : 0; // +1 top, -1 bottom
    const bevel = 0.5 + 0.5 * upNess;
    const baseR = lerp(55, 158, bevel);
    const baseG = lerp(66, 172, bevel);
    const baseB = lerp(96, 208, bevel);
    R += baseR * band;
    G += baseG * band;
    B += baseB * band;
    // bright inner highlight near the top of the ring
    const innerHL = gauss(r - (RING_IN + 0.014), 0.007) * clamp(upNess, 0, 1) * 1.4;
    R += 120 * innerHL;
    G += 140 * innerHL;
    B += 185 * innerHL;
    // dark outer shadow near the bottom
    const outerSh = gauss(r - (RING_OUT - 0.012), 0.007) * clamp(-upNess, 0, 1);
    R -= 40 * outerSh;
    G -= 42 * outerSh;
    B -= 48 * outerSh;
    // faint blue sheen across the whole band
    const sheen = gauss(r - (RING_IN + RING_OUT) / 2, 0.03) * 0.25;
    R += 18 * sheen * band;
    G += 44 * sheen * band;
    B += 100 * sheen * band;
  }

  // ── Cardinal rune marks on the ring ───────────────────────────────
  for (const [rx, ry] of RUNES) {
    const rd = Math.sqrt((u - rx) ** 2 + (v - ry) ** 2);
    const rg = gauss(rd, 0.02);
    R += 95 * rg;
    G += 178 * rg;
    B += 255 * rg;
  }

  // ── Crossed swords (saltire): +45° and -45° ───────────────────────
  const [r1, g1, b1] = drawTiltedSword(du, dv, Math.PI / 4);
  const [r2, g2, b2] = drawTiltedSword(du, dv, -Math.PI / 4);
  R += r1 + r2;
  G += g1 + g2;
  B += b1 + b2;

  // ── Soul orb at the crossing (focal element) ──────────────────────
  const od = r; // orb centered at origin
  const t = od / ORB_R;
  if (t < 1.3) {
    const core = smoothstep(0.34, 0.0, t);
    const body = smoothstep(1.2, 0.0, t);
    const k = 1.25;
    const cr = lerp(95, 248, core);
    const cg = lerp(155, 251, core);
    const cb = lerp(222, 255, core);
    R += cr * body * k;
    G += cg * body * k;
    B += cb * body * k;
    R += 205 * core;
    G += 222 * core;
    B += 255 * core;
    // tight outer glow
    const glow = smoothstep(1.3, 0.5, t) * 0.4;
    R += 28 * glow;
    G += 66 * glow;
    B += 140 * glow;
  }

  return [clamp(R, 0, 255), clamp(G, 0, 255), clamp(B, 0, 255), cover * 255];
}

// ─── Render master RGBA buffer at a given size (3×3 supersampled) ─────
/**
 * @param {number} size
 * @returns {Uint8Array}
 */
function renderMaster(size) {
  const out = new Uint8Array(size * size * 4);
  const ss = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0,
        G = 0,
        B = 0,
        A = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          const u = (px / size) * 2 - 1;
          const v = (py / size) * 2 - 1;
          const c = sample(u, v);
          R += c[0];
          G += c[1];
          B += c[2];
          A += c[3];
        }
      }
      const k = ss * ss;
      const idx = (y * size + x) * 4;
      out[idx] = R / k;
      out[idx + 1] = G / k;
      out[idx + 2] = B / k;
      out[idx + 3] = A / k;
    }
  }
  return out;
}

// ─── Box-average downscale (requires srcSize % dstSize === 0) ────────
/**
 * @param {Uint8Array} src
 * @param {number} srcSize
 * @param {number} dstSize
 * @returns {Uint8Array}
 */
function boxDownscale(src, srcSize, dstSize) {
  if (srcSize === dstSize) return src;
  const ratio = srcSize / dstSize;
  const out = new Uint8Array(dstSize * dstSize * 4);
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      let R = 0,
        G = 0,
        B = 0,
        A = 0,
        cnt = 0;
      const x0 = Math.floor(x * ratio);
      const x1 = Math.floor((x + 1) * ratio);
      const y0 = Math.floor(y * ratio);
      const y1 = Math.floor((y + 1) * ratio);
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * srcSize + xx) * 4;
          R += src[i];
          G += src[i + 1];
          B += src[i + 2];
          A += src[i + 3];
          cnt++;
        }
      }
      const o = (y * dstSize + x) * 4;
      const c = cnt || 1;
      out[o] = R / c;
      out[o + 1] = G / c;
      out[o + 2] = B / c;
      out[o + 3] = A / c;
    }
  }
  return out;
}

// ─── CRC32 (PNG chunks) ──────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
/**
 * @param {Uint8Array} buf
 * @returns {number}
 */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── PNG encoder (8-bit RGBA, filter type 0 per row) ─────────────────
/**
 * @param {string} type
 * @param {Uint8Array} data
 * @returns {Buffer}
 */
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const dataBuf = Buffer.from(data);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dataBuf.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, dataBuf])), 0);
  return Buffer.concat([len, typeBuf, dataBuf, crc]);
}
/**
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba
 * @returns {Buffer}
 */
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    Buffer.from(rgba.subarray(y * stride, y * stride + stride)).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── ICO encoder (PNG-encoded entries) ───────────────────────────────
/**
 * @param {{ width: number, png: Uint8Array }[]} images
 * @returns {Buffer}
 */
function encodeICO(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);
  const entries = [];
  const datas = [];
  let offset = 6 + 16 * count;
  for (const img of images) {
    const e = Buffer.alloc(16);
    e[0] = img.width >= 256 ? 0 : img.width;
    e[1] = img.width >= 256 ? 0 : img.width;
    e[2] = 0; // colors in palette
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(img.png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    datas.push(img.png);
    offset += img.png.length;
  }
  return Buffer.concat([header, ...entries, ...datas]);
}

// ─── ICNS encoder (macOS) ────────────────────────────────────────────
/**
 * @param {{ type: string, png: Uint8Array }[]} entries
 * @returns {Buffer}
 */
function encodeICNS(entries) {
  const parts = [];
  for (const e of entries) {
    const typeBuf = Buffer.from(e.type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(8 + e.png.length, 0);
    parts.push(Buffer.concat([typeBuf, len, e.png]));
  }
  const body = Buffer.concat(parts);
  const magic = Buffer.from('icns', 'ascii');
  const total = Buffer.alloc(4);
  total.writeUInt32BE(8 + body.length, 0);
  return Buffer.concat([magic, total, body]);
}

// ─── Build every size from the master, then write all files ──────────
function main() {
  mkdirSync(ICONS_DIR, { recursive: true });

  const master512 = renderMaster(512);
  const buf256 = boxDownscale(master512, 512, 256);
  const buf128 = boxDownscale(buf256, 256, 128);
  const buf64 = boxDownscale(buf128, 128, 64);
  const buf32 = boxDownscale(buf64, 64, 32);
  const buf16 = boxDownscale(buf32, 32, 16);

  const png512 = encodePNG(512, 512, master512);
  const png256 = encodePNG(256, 256, buf256);
  const png128 = encodePNG(128, 128, buf128);
  const png64 = encodePNG(64, 64, buf64);
  const png32 = encodePNG(32, 32, buf32);
  const png16 = encodePNG(16, 16, buf16);

  const ico = encodeICO([
    { width: 16, png: png16 },
    { width: 32, png: png32 },
    { width: 64, png: png64 },
    { width: 128, png: png128 },
    { width: 256, png: png256 },
  ]);

  const icns = encodeICNS([
    { type: 'ic11', png: png32 }, // 32×32
    { type: 'ic12', png: png64 }, // 64×64
    { type: 'ic07', png: png128 }, // 128×128
    { type: 'ic08', png: png256 }, // 256×256
    { type: 'ic09', png: png512 }, // 512×512
  ]);

  const writes = [
    ['icon.png', png512],
    ['128x128@2x.png', png256],
    ['128x128.png', png128],
    ['32x32.png', png32],
    ['icon.ico', ico],
    ['icon.icns', icns],
  ];
  for (const item of writes) {
    const name = String(item[0]);
    const data = item[1];
    const p = join(ICONS_DIR, name);
    writeFileSync(p, data);
    console.log(`  ✓ ${name.padEnd(18)} ${String(data.length).padStart(7)} bytes`);
  }
  console.log(`\nGenerated ${writes.length} icon files in ${ICONS_DIR}`);
}

main();
