// Planilha com o mesmo conteúdo do PDF (RF-70). Separador ";" (o Excel em português espera isso), fim de linha CRLF e BOM
// UTF-8 para o acento abrir certo. Texto de terceiros nunca vira fórmula (RF-74, CA-14).
import { FOOTER_PHRASE, MISSING_NOTICE, PERSONAL_DATA_NOTICE, PREVIEW_NOTICE, REVIEW_NOTICE } from './model.ts';
import type { ReportModel } from './model.ts';

export const CSV_BOM = String.fromCharCode(0xfeff);
const SEPARATOR = ';';
const EOL = '\r\n';

/** Começos que fazem a planilha tratar a célula como fórmula. */
const FORMULA_START = /^[=+\-@\t\r\n]/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Uma célula pronta: sem controle, neutralizada e entre aspas se precisar. */
export function csvCell(value: string): string {
  let text = value.replace(CONTROL, '');
  if (FORMULA_START.test(text) || FORMULA_START.test(text.trimStart())) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** As linhas que o PDF tem antes e depois da lista: título, data, requisitos, abrangência e avisos (RF-71). */
function introRows(model: ReportModel): string[][] {
  const rows: string[][] = [[`Triagem+: ${model.jobTitle}`], [`Relatório gerado em ${model.dateText}`], ['Requisitos da vaga']];
  if (model.requirements.length === 0) rows.push(['Esta vaga ainda não tem requisitos.']);
  for (const requirement of model.requirements) rows.push([requirement.label, requirement.importanceLabel]);
  rows.push([model.scopeText]);
  if (model.rows.length > 0) rows.push([MISSING_NOTICE]);
  if (model.hasReview) rows.push([REVIEW_NOTICE]);
  if (model.hasPreview) rows.push([PREVIEW_NOTICE]);
  rows.push([FOOTER_PHRASE], [PERSONAL_DATA_NOTICE], []);
  return rows;
}

export function renderCsv(model: ReportModel): string {
  const header = ['Posição', 'Nome', 'Link', 'Nota', 'Faixa', 'Experiência total', 'Cargo atual', 'Etapa', 'Bateu', 'Faltou', 'A rever'];
  if (model.includeNotes) header.push('Notas');
  const lines = [...introRows(model).map((cells) => cells.map(csvCell).join(SEPARATOR)), header.map(csvCell).join(SEPARATOR)];
  for (const row of model.rows) {
    const cells = [
      String(row.position),
      row.name,
      row.link,
      row.scoreText,
      row.bandLabel ?? '',
      row.experience,
      row.currentTitle,
      row.stageLabel,
      row.met.join(', '),
      row.missing.join(', '),
      row.review.join(', '),
    ];
    if (model.includeNotes) cells.push(row.notes ?? '');
    lines.push(cells.map(csvCell).join(SEPARATOR));
  }
  return CSV_BOM + lines.join(EOL) + EOL;
}
