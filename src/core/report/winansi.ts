// Texto Unicode para a codificação WinAnsi das fontes padrão Helvetica e Helvetica-Bold (DP-21), com a largura de cada letra.
// As larguras são as das métricas oficiais das duas fontes, em milésimos do corpo. Cada letra de uma cadeia "WinAnsi" é um
// byte (0 a 255) guardado como caractere.

function range(table: number[], from: number, widths: readonly number[]): void {
  widths.forEach((width, index) => {
    table[from + index] = width;
  });
}

function repeat(table: number[], from: number, to: number, width: number): void {
  for (let code = from; code <= to; code += 1) table[code] = width;
}

function build(kind: 'regular' | 'bold'): number[] {
  const regular = kind === 'regular';
  const table: number[] = new Array<number>(256).fill(556);
  range(table, 32, regular
    ? [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278]
    : [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278]);
  repeat(table, 48, 57, 556);
  range(table, 58, regular ? [278, 278, 584, 584, 584, 556, 1015] : [333, 333, 584, 584, 584, 611, 975]);
  range(table, 65, regular
    ? [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611]
    : [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611]);
  range(table, 91, regular ? [278, 278, 278, 469, 556, 333] : [333, 278, 333, 584, 556, 333]);
  range(table, 97, regular
    ? [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500]
    : [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500]);
  range(table, 123, regular ? [334, 260, 334, 584] : [389, 280, 389, 584]);
  // 0x80 a 0x9F: euro, reticências, aspas curvas, marcador, travessões, marca registrada e as letras com caron.
  const high = regular
    ? [556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667]
    : [556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667];
  range(table, 0x80, high);
  range(table, 0xa0, regular
    ? [278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611]
    : [278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611]);
  const accent = regular ? 667 : 722;
  repeat(table, 0xc0, 0xc5, accent);
  table[0xc6] = 1000;
  table[0xc7] = 722;
  repeat(table, 0xc8, 0xcb, 667);
  repeat(table, 0xcc, 0xcf, 278);
  table[0xd0] = 722;
  table[0xd1] = 722;
  repeat(table, 0xd2, 0xd6, 778);
  table[0xd7] = 584;
  table[0xd8] = 778;
  repeat(table, 0xd9, 0xdc, 722);
  table[0xdd] = 667;
  table[0xde] = 667;
  table[0xdf] = 611;
  repeat(table, 0xe0, 0xe5, 556);
  table[0xe6] = 889;
  table[0xe7] = regular ? 500 : 556;
  repeat(table, 0xe8, 0xeb, 556);
  repeat(table, 0xec, 0xef, 278);
  const eth = regular ? 556 : 611;
  repeat(table, 0xf0, 0xf6, eth);
  table[0xf7] = 584;
  table[0xf8] = 611;
  repeat(table, 0xf9, 0xfc, eth);
  table[0xfd] = regular ? 500 : 556;
  table[0xfe] = eth;
  table[0xff] = regular ? 500 : 556;
  return table;
}

const REGULAR_WIDTHS = build('regular');
const BOLD_WIDTHS = build('bold');

/** Unicode que a WinAnsi escreve nos códigos 0x80 a 0x9F. */
const HIGH: ReadonlyMap<number, number> = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91],
  [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98],
  [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

/** Controle e formatação invisível: somem sem avisar, não são letra perdida. */
function isInvisible(code: number): boolean {
  return (
    code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0xad || (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e) || (code >= 0x2060 && code <= 0x2064) || code === 0xfeff
  );
}

export interface Converted {
  readonly text: string;
  /** Letras que não existem na WinAnsi e viraram "?". */
  readonly replaced: number;
}

/** Espaços e quebras viram um espaço só. Use antes de medir ou quebrar linha. */
export function toWinAnsi(input: string): Converted {
  let text = '';
  let replaced = 0;
  for (const char of input.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0xa0 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0b || code === 0x0c || (code >= 0x2000 && code <= 0x200a) || code === 0x202f || code === 0x3000) {
      text += ' ';
    } else if (isInvisible(code)) {
      continue;
    } else if (code < 0x7f || (code >= 0xa1 && code <= 0xff)) {
      text += char;
    } else {
      const mapped = HIGH.get(code);
      if (mapped === undefined) {
        text += '?';
        replaced += 1;
      } else {
        text += String.fromCharCode(mapped);
      }
    }
  }
  return { text, replaced };
}

export function charWidth(code: number, bold: boolean): number {
  return (bold ? BOLD_WIDTHS : REGULAR_WIDTHS)[code] ?? 556;
}

/** Largura em pontos de uma cadeia WinAnsi. */
export function textWidth(text: string, bold: boolean, size: number): number {
  const table = bold ? BOLD_WIDTHS : REGULAR_WIDTHS;
  let total = 0;
  for (let index = 0; index < text.length; index += 1) total += table[text.charCodeAt(index)] ?? 556;
  return (total * size) / 1000;
}
