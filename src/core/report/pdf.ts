// Gerador de PDF próprio (DP-21, RNF-12): A4 em pé, só texto, linhas, retângulos e links, com Helvetica e Helvetica-Bold.
// Sem compressão, sem JavaScript, sem /OpenAction, sem imagem e sem recurso externo. Todo texto passa por toWinAnsi e sai
// com ( ) \ e bytes fora do ASCII em escape octal, então texto de terceiros nunca vira operador do arquivo (RNF-04).
import { FOOTER_PHRASE, MISSING_NOTICE, PERSONAL_DATA_NOTICE, PREVIEW_NOTICE, REVIEW_NOTICE } from './model.ts';
import type { ReportModel, ReportRow } from './model.ts';
import { textWidth, toWinAnsi } from './winansi.ts';

export { FOOTER_PHRASE, MISSING_NOTICE, PERSONAL_DATA_NOTICE, PREVIEW_NOTICE, REVIEW_NOTICE };

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 48;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;
const FIRST_TOP = 54;
const NEXT_TOP = 62;
const BOTTOM = PAGE_H - 66;
const FOOTER_RULE_Y = PAGE_H - 52;
const FOOTER_TEXT_Y = PAGE_H - 38;
const LABEL_W = 84;
const BODY = 9.5;
const BODY_H = 12.5;

type Rgb = readonly [number, number, number];
const INK: Rgb = [0.1, 0.12, 0.16];
const MUTED: Rgb = [0.38, 0.42, 0.48];
const LINK: Rgb = [0.05, 0.3, 0.7];
const BAND_FILL: Rgb = [0.92, 0.94, 0.97];
const RULE: Rgb = [0.8, 0.83, 0.88];
const BAND_COLORS: Readonly<Record<string, Rgb>> = {
  strong: [0.04, 0.4, 0.2],
  partial: [0.6, 0.36, 0],
  weak: [0.65, 0.12, 0.12],
};

interface Item {
  readonly x: number;
  readonly text: string;
  readonly bold: boolean;
  readonly size: number;
  readonly color: Rgb;
  readonly link?: string;
}

interface Line {
  readonly h: number;
  readonly after: number;
  readonly items: readonly Item[];
  readonly fill?: Rgb;
  readonly rule?: boolean;
}

interface Annotation {
  readonly rect: readonly [number, number, number, number];
  readonly uri: string;
}

interface Page {
  readonly ops: string[];
  readonly annots: Annotation[];
}

export interface PdfResult {
  readonly bytes: Uint8Array;
  /** Letras que não existem na codificação do PDF e saíram como "?" (RF-75). */
  readonly replacedCount: number;
}

function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Cadeia de PDF entre parênteses. Só ASCII visível passa direto, e ( ) \ saem com barra. */
function pdfString(winAnsi: string): string {
  let out = '(';
  for (let index = 0; index < winAnsi.length; index += 1) {
    const code = winAnsi.charCodeAt(index);
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${winAnsi[index]}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += winAnsi[index];
  }
  return `${out})`;
}

/** Só endereço https, com nome de site simples, sem usuário nem senha, sem espaço e só em ASCII visível. Nulo se não servir. */
const HTTPS_URI = /^https:\/\/([a-z0-9-]+\.)+[a-z0-9-]+(:\d{1,5})?([/?#][^\s\\]*)?$/i;

function safeHttpsUri(raw: string): string | null {
  const trimmed = raw.trim();
  if (!HTTPS_URI.test(trimmed)) return null;
  for (let index = 0; index < trimmed.length; index += 1) {
    const code = trimmed.charCodeAt(index);
    if (code < 0x21 || code > 0x7e) return null;
  }
  return trimmed;
}

class Writer {
  replaced = 0;

  /** Texto de uma linha só: espaços juntos, sem controle, em WinAnsi. */
  clean(input: string): string {
    const { text, replaced } = toWinAnsi(input);
    this.replaced += replaced;
    return text.replace(/ {2,}/g, ' ').trim();
  }

  wrap(text: string, bold: boolean, size: number, width: number): string[] {
    const lines: string[] = [];
    let current = '';
    const flush = (): void => {
      lines.push(current);
      current = '';
    };
    for (const word of text.split(' ')) {
      if (word === '') continue;
      const joined = current === '' ? word : `${current} ${word}`;
      if (textWidth(joined, bold, size) <= width) {
        current = joined;
        continue;
      }
      if (current !== '') flush();
      let rest = word;
      while (textWidth(rest, bold, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && textWidth(rest.slice(0, cut), bold, size) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    if (current !== '') flush();
    return lines.length === 0 ? [''] : lines;
  }

  /** Parágrafos separados por quebra de linha, cada um quebrado na largura. */
  paragraphs(input: string, bold: boolean, size: number, width: number): string[] {
    const out: string[] = [];
    for (const part of input.split(/\r\n|\r|\n/)) {
      const cleaned = this.clean(part);
      if (cleaned === '') continue;
      out.push(...this.wrap(cleaned, bold, size, width));
    }
    return out.length === 0 ? [''] : out;
  }
}

function textLine(items: readonly Item[], h = BODY_H, after = 0, extra: Partial<Line> = {}): Line {
  return { h, after, items, ...extra };
}

/** Linhas de um campo com rótulo à esquerda e valor à direita. */
function field(w: Writer, label: string, valueLines: readonly string[], opts: { color?: Rgb; link?: string; rule?: boolean } = {}): Line[] {
  const valueX = MARGIN_X + LABEL_W;
  return valueLines.map((value, index) => {
    const last = index === valueLines.length - 1;
    const items: Item[] = [];
    if (index === 0) items.push({ x: MARGIN_X + 6, text: w.clean(label), bold: true, size: 8.5, color: MUTED });
    if (value !== '') {
      items.push({
        x: valueX,
        text: value,
        bold: false,
        size: BODY,
        color: opts.link !== undefined ? LINK : (opts.color ?? INK),
        ...(opts.link !== undefined ? { link: opts.link } : {}),
      });
    }
    return textLine(items, BODY_H, last ? 3 : 0, last && opts.rule === true ? { rule: true } : {});
  });
}

function rowBlock(w: Writer, row: ReportRow, includeNotes: boolean): Line[] {
  const valueW = CONTENT_W - LABEL_W - 6;
  const scoreLabel = row.bandLabel === null ? `Nota: ${row.scoreText}` : `Nota ${row.scoreText} · ${row.bandLabel}`;
  const scoreText = w.clean(scoreLabel);
  const scoreColor = row.band === null ? MUTED : (BAND_COLORS[row.band] ?? INK);
  const scoreW = textWidth(scoreText, true, 10.5);
  const nameLines = w.wrap(w.clean(`${row.position}. ${row.name}`), true, 11.5, CONTENT_W - scoreW - 28);
  const lines: Line[] = [textLine([], 5, 0, { fill: BAND_FILL })];
  nameLines.forEach((text, index) => {
    const items: Item[] = [{ x: MARGIN_X + 8, text, bold: true, size: 11.5, color: INK }];
    if (index === 0) items.push({ x: MARGIN_X + CONTENT_W - 8 - scoreW, text: scoreText, bold: true, size: 10.5, color: scoreColor });
    lines.push(textLine(items, 15, 0, { fill: BAND_FILL }));
  });
  lines.push(textLine([], 5, 4, { fill: BAND_FILL }));

  const uri = safeHttpsUri(row.link);
  const linkPieces = w.wrap(w.clean(row.link), false, BODY, valueW);
  lines.push(...field(w, 'Perfil', linkPieces, uri === null ? { color: MUTED } : { link: uri }));
  lines.push(...field(w, 'Cargo atual', w.wrap(w.clean(row.currentTitle), false, BODY, valueW)));
  lines.push(...field(w, 'Experiência', [w.clean(row.experience)]));
  lines.push(...field(w, 'Bateu', w.wrap(w.clean(row.met.length === 0 ? 'Nenhum' : row.met.join(', ')), false, BODY, valueW)));
  lines.push(...field(w, 'Faltou', w.wrap(w.clean(row.missing.length === 0 ? 'Nenhum' : row.missing.join(', ')), false, BODY, valueW)));
  if (row.review.length > 0) lines.push(...field(w, row.reviewLabel, w.wrap(w.clean(row.review.join(', ')), false, BODY, valueW), { color: MUTED }));
  lines.push(...field(w, 'Etapa', [w.clean(row.stageLabel)], { rule: !includeNotes }));
  if (includeNotes) {
    const notes = row.notes ?? '';
    const noteLines = w.paragraphs(notes, false, BODY, valueW);
    lines.push(...field(w, 'Notas', notes.trim() === '' ? ['Sem notas'] : noteLines, { rule: true, color: notes.trim() === '' ? MUTED : INK }));
  }
  lines.push(textLine([], 8));
  return lines;
}

function introLines(w: Writer, model: ReportModel): Line[] {
  const lines: Line[] = [];
  const title = w.wrap(w.clean(`Triagem+: ${model.jobTitle}`), true, 18, CONTENT_W);
  title.forEach((text) => lines.push(textLine([{ x: MARGIN_X, text, bold: true, size: 18, color: INK }], 23)));
  lines.push(textLine([{ x: MARGIN_X, text: w.clean(`Relatório gerado em ${model.dateText}`), bold: false, size: 10, color: MUTED }], 15, 8));
  lines.push(textLine([{ x: MARGIN_X, text: 'Requisitos da vaga', bold: true, size: 11.5, color: INK }], 17, 2, { rule: true }));
  if (model.requirements.length === 0) {
    lines.push(textLine([{ x: MARGIN_X, text: 'Esta vaga ainda não tem requisitos.', bold: false, size: BODY, color: MUTED }], BODY_H));
  }
  for (const requirement of model.requirements) {
    const tag = requirement.importanceLabel;
    const tagW = textWidth(tag, true, 8.5);
    const pieces = w.wrap(w.clean(requirement.label), false, BODY, CONTENT_W - 18 - tagW - 14);
    pieces.forEach((text, index) => {
      const items: Item[] = [{ x: MARGIN_X + 14, text, bold: false, size: BODY, color: INK }];
      if (index === 0) {
        items.unshift({ x: MARGIN_X + 3, text: '\u0095', bold: false, size: BODY, color: MUTED });
        items.push({ x: MARGIN_X + CONTENT_W - tagW, text: tag, bold: true, size: 8.5, color: requirement.required ? INK : MUTED });
      }
      lines.push(textLine(items, BODY_H));
    });
  }
  lines.push(textLine([], 10));
  w.wrap(w.clean(model.scopeText), true, 10.5, CONTENT_W).forEach((text, index, all) => {
    lines.push(textLine([{ x: MARGIN_X, text, bold: true, size: 10.5, color: INK }], 16, index === all.length - 1 ? 8 : 0));
  });
  return lines;
}

function closingLines(w: Writer, model: ReportModel): Line[] {
  const width = CONTENT_W - 16;
  const lines: Line[] = [textLine([], 4, 0, { fill: BAND_FILL })];
  const add = (text: string, bold: boolean): void => {
    for (const piece of w.wrap(w.clean(text), bold, 9, width)) {
      lines.push(textLine([{ x: MARGIN_X + 8, text: piece, bold, size: 9, color: INK }], 12, 0, { fill: BAND_FILL }));
    }
  };
  add(`Gerado em ${model.dateText}.`, true);
  if (model.rows.length > 0) add(MISSING_NOTICE, false);
  if (model.hasReview) add(REVIEW_NOTICE, false);
  if (model.hasPreview) add(PREVIEW_NOTICE, false);
  add(PERSONAL_DATA_NOTICE, false);
  lines.push(textLine([], 4, 0, { fill: BAND_FILL }));
  return lines;
}

export function renderPdf(model: ReportModel): PdfResult {
  const w = new Writer();
  const pages: Page[] = [];
  let cursor = FIRST_TOP;
  const shortTitle = w.wrap(w.clean(`Triagem+: ${model.jobTitle}`), false, 8, CONTENT_W - 90)[0] ?? '';

  const newPage = (): Page => {
    const page: Page = { ops: [], annots: [] };
    pages.push(page);
    cursor = FIRST_TOP;
    if (pages.length > 1) {
      drawText(page, { x: MARGIN_X, text: shortTitle, bold: false, size: 8, color: MUTED }, 30, 0);
      drawRule(page, 42, RULE);
      cursor = NEXT_TOP;
    }
    return page;
  };

  const drawLine = (page: Page, line: Line): void => {
    if (line.fill !== undefined) {
      page.ops.push(`${line.fill.join(' ')} rg ${num(MARGIN_X)} ${num(PAGE_H - cursor - line.h - line.after)} ${num(CONTENT_W)} ${num(line.h + line.after)} re f`);
    }
    for (const item of line.items) drawText(page, item, cursor, line.h);
    if (line.rule === true) drawRule(page, cursor + line.h + line.after - 0.5, RULE);
    cursor += line.h + line.after;
  };

  const flow = (groups: readonly (readonly Line[])[]): void => {
    for (const group of groups) {
      const height = group.reduce((sum, line) => sum + line.h + line.after, 0);
      let page = pages[pages.length - 1] ?? newPage();
      if (cursor + height > BOTTOM && height <= BOTTOM - NEXT_TOP) page = newPage();
      for (const line of group) {
        if (cursor + line.h + line.after > BOTTOM) page = newPage();
        drawLine(page, line);
      }
    }
  };

  flow([introLines(w, model)]);
  if (model.rows.length === 0) {
    flow([[textLine([{ x: MARGIN_X, text: 'Nenhum candidato nesta vaga.', bold: false, size: 11, color: MUTED }], 18, 10)]]);
  }
  flow(model.rows.map((row) => rowBlock(w, row, model.includeNotes)));
  flow([closingLines(w, model)]);

  const total = pages.length;
  pages.forEach((page, index) => {
    drawRule(page, FOOTER_RULE_Y, RULE);
    drawText(page, { x: MARGIN_X, text: w.clean(FOOTER_PHRASE), bold: false, size: 8.5, color: MUTED }, FOOTER_TEXT_Y - 6, 12);
    const label = `Página ${index + 1} de ${total}`;
    drawText(page, { x: PAGE_W - MARGIN_X - textWidth(label, false, 8.5), text: label, bold: false, size: 8.5, color: MUTED }, FOOTER_TEXT_Y - 6, 12);
  });

  return { bytes: assemble(pages), replacedCount: w.replaced };
}

function drawRule(page: Page, yTop: number, color: Rgb): void {
  page.ops.push(`${color.join(' ')} RG 0.6 w ${num(MARGIN_X)} ${num(PAGE_H - yTop)} m ${num(PAGE_W - MARGIN_X)} ${num(PAGE_H - yTop)} l S`);
}

function drawText(page: Page, item: Item, yTop: number, h: number): void {
  if (item.text === '') return;
  const baseline = PAGE_H - (yTop + (h + item.size * 0.72) / 2);
  page.ops.push(`BT ${item.color.join(' ')} rg /${item.bold ? 'F2' : 'F1'} ${num(item.size)} Tf 1 0 0 1 ${num(item.x)} ${num(baseline)} Tm ${pdfString(item.text)} Tj ET`);
  if (item.link === undefined) return;
  const width = textWidth(item.text, item.bold, item.size);
  page.ops.push(`${item.color.join(' ')} RG 0.5 w ${num(item.x)} ${num(baseline - 1.6)} m ${num(item.x + width)} ${num(baseline - 1.6)} l S`);
  page.annots.push({ rect: [item.x, baseline - 3, item.x + width, baseline + item.size * 0.9], uri: item.link });
}

/** Monta o arquivo: objetos numerados, tabela de endereços e o fim. Tudo em ASCII, mais quatro bytes altos no cabeçalho. */
function assemble(pages: readonly Page[]): Uint8Array {
  const bodies: string[] = [];
  const add = (body: string): number => bodies.push(body);
  const pagesId = 2;
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds: number[] = [];
  for (const page of pages) {
    const stream = page.ops.join('\n');
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const annotIds = page.annots.map((annot) => {
      const [x1, y1, x2, y2] = annot.rect;
      return add(`<< /Type /Annot /Subtype /Link /Rect [${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)}] /Border [0 0 0] /F 4 /A << /S /URI /URI ${pdfString(annot.uri)} >> >>`);
    });
    const annots = annotIds.length === 0 ? '' : ` /Annots [${annotIds.map((id) => `${id} 0 R`).join(' ')}]`;
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R${annots} >>`,
      ),
    );
  }
  bodies[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  // A segunda linha, com quatro bytes altos, avisa aos programas que o arquivo é binário.
  let out = ['%PDF-1.4', `%${String.fromCharCode(0xe2, 0xe3, 0xcf, 0xd3)}`, ''].join('\n');
  const offsets: number[] = [];
  bodies.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let index = 0; index < out.length; index += 1) bytes[index] = out.charCodeAt(index) & 0xff;
  return bytes;
}
