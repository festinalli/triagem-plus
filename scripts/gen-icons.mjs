// Gera os ícones PNG da extensão (arte própria, sem dependências): "T+" branco sobre verde-azulado #0F766E.
// Uso: node scripts/gen-icons.mjs [--outdir <pasta>]   (padrão: src/assets/icons)
// Desenho por campos de distância com super-amostragem, só com operações exatas de ponto flutuante.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ICON_SIZES = [16, 32, 48, 128];

const SUPERSAMPLE = 4;
const BACKGROUND = [15, 118, 110]; // #0F766E
const WHITE = [255, 255, 255];
const CORNER_RADIUS = 0.22;

// "T": barra no alto e haste ao centro. "+": dois segmentos à direita, mais abaixo.
const T_BAR = { x0: 0.14, x1: 0.56, y0: 0.24, y1: 0.37 };
const T_STEM = { x0: 0.29, x1: 0.41, y0: 0.24, y1: 0.76 };
const PLUS_CENTER = [0.74, 0.6];
const PLUS_HALF = 0.14;
const PLUS_HALF_THICK = 0.05;

const inRect = (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

function inRoundedSquare(x, y) {
  const qx = Math.abs(x - 0.5) - (0.5 - CORNER_RADIUS);
  const qy = Math.abs(y - 0.5) - (0.5 - CORNER_RADIUS);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) <= CORNER_RADIUS;
}

function inPlus(x, y, thick) {
  const dx = Math.abs(x - PLUS_CENTER[0]);
  const dy = Math.abs(y - PLUS_CENTER[1]);
  return (dx <= thick && dy <= PLUS_HALF) || (dy <= thick && dx <= PLUS_HALF);
}

/** Pixels RGBA (não pré-multiplicado) de um ícone quadrado de `size` pixels. */
export function renderIcon(size) {
  const out = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE * SUPERSAMPLE;
  const thick = size <= 16 ? PLUS_HALF_THICK * 1.4 : PLUS_HALF_THICK;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let covered = 0;
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          if (!inRoundedSquare(x, y)) continue;
          covered++;
          const white = inRect(x, y, T_BAR) || inRect(x, y, T_STEM) || inPlus(x, y, thick);
          const c = white ? WHITE : BACKGROUND;
          sum[0] += c[0];
          sum[1] += c[1];
          sum[2] += c[2];
        }
      }
      if (covered === 0) continue;
      const i = (py * size + px) * 4;
      out[i] = Math.round(sum[0] / covered);
      out[i + 1] = Math.round(sum[1] / covered);
      out[i + 2] = Math.round(sum[2] / covered);
      out[i + 3] = Math.round((covered / n) * 255);
    }
  }
  return out;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([head, body, crc]);
}

/** Codifica pixels RGBA em PNG (8 bits, sem entrelaçamento). */
export function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function generateIcons(outdir) {
  fs.mkdirSync(outdir, { recursive: true });
  return ICON_SIZES.map((size) => {
    const file = path.join(outdir, `icon-${size}.png`);
    fs.writeFileSync(file, encodePng(size, renderIcon(size)));
    return file;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const flag = process.argv.indexOf('--outdir');
  const outdir = flag >= 0 && process.argv[flag + 1] ? path.resolve(process.argv[flag + 1]) : path.join(root, 'src', 'assets', 'icons');
  for (const f of generateIcons(outdir)) console.log(path.relative(process.cwd(), f));
}
