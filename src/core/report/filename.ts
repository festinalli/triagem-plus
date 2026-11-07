// Nome do arquivo baixado: triagem-<vaga>-<AAAA-MM-DD>.<ext>. Só letras minúsculas, números e hífen, sem caminho e sem
// nada do candidato. O prefixo "triagem-" já impede que o nome inteiro seja um nome reservado do Windows (CON, NUL, COM1...),
// e o trecho da vaga nunca fica vazio nem comprido.
import { dateParts } from './model.ts';

export type ReportExtension = 'pdf' | 'csv';

const MAX_SLUG = 48;
const FALLBACK_SLUG = 'vaga';

export function slugOf(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
  return slug === '' ? FALLBACK_SLUG : slug;
}

export function reportFileName(jobTitle: string, now: number, ext: ReportExtension): string {
  const { year, month, day } = dateParts(now);
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return `triagem-${slugOf(jobTitle)}-${date}.${ext === 'csv' ? 'csv' : 'pdf'}`;
}
