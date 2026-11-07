// Origem: Candidata+, marco onda-4, src/core/time/parse-date.ts. Mudanças: só português e inglês (DP-17) e o
// marcador "o momento", que é a forma de "atual" prevista para o perfil em português.
import { makeYearMonth, compareYearMonth, isValidYear } from './year-month.ts';
import type { DateError, YearMonth } from './types.ts';

export type ParsedDate =
  | { readonly ok: true; readonly kind: 'month'; readonly value: YearMonth }
  | { readonly ok: true; readonly kind: 'year'; readonly year: number }
  | { readonly ok: true; readonly kind: 'current' }
  | DateError;

export type DateRange =
  | {
      readonly ok: true;
      readonly start: YearMonth;
      /** Nulo quando o intervalo está em aberto (emprego atual). */
      readonly end: YearMonth | null;
      readonly current: boolean;
    }
  | DateError;

// Nomes de mês em português e inglês, em forma plena e abreviada, já sem acento e em minúsculas.
// Nomes que coincidem entre idiomas (mar, jun...) apontam sempre para o mesmo mês.
const MONTH_NAMES: ReadonlyMap<string, number> = new Map<string, number>(Object.entries({
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
  january: 1,
  february: 2, feb: 2,
  march: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11,
  december: 12, dec: 12,
}));

// Marcadores de "ainda em curso", em português e inglês.
const CURRENT_MARKERS: ReadonlySet<string> = new Set([
  'o momento',
  'momento',
  'ate o momento',
  'atual',
  'atualmente',
  'presente',
  'o presente',
  'hoje',
  'ate hoje',
  'present',
  'current',
  'now',
]);

/** Normaliza para comparação: sem acento, sem marcas, minúsculas, pontos viram espaço e espaços colapsados. */
function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reconhece uma data de emprego: `03/2021`, `2021-03`, `março de 2021`, `mar 2021`, `March 2021`, um ano isolado,
 * ou um marcador de "atual" (o momento, atual, presente, present). Não usa relógio.
 */
export function parseDateText(text: string): ParsedDate {
  const value = fold(text);
  if (value === '') return { ok: false, code: 'date_empty' };
  if (CURRENT_MARKERS.has(value)) return { ok: true, kind: 'current' };

  const yearOnly = /^(\d{4})$/.exec(value);
  if (yearOnly) {
    // Mesma faixa de makeYearMonth: "0000" e "0999" não são anos.
    const year = Number(yearOnly[1]);
    return isValidYear(year) ? { ok: true, kind: 'year', year } : { ok: false, code: 'date_unrecognized' };
  }

  // Numérico: mês/ano ou ano-mês (ISO). A forma com ano na frente não se confunde com a de mês na frente.
  const monthYear = /^(\d{1,2})\s*[/\-\s]\s*(\d{4})$/.exec(value);
  if (monthYear) return monthFrom(Number(monthYear[2]), Number(monthYear[1]));

  const yearMonth = /^(\d{4})\s*[/\-]\s*(\d{1,2})$/.exec(value);
  if (yearMonth) return monthFrom(Number(yearMonth[1]), Number(yearMonth[2]));

  // Por extenso ou abreviado: "março de 2021", "mar/2021", "march 2021".
  const named = /^([a-z]+)\s*(?:de\s+|[/\-]\s*|\s+)(\d{4})$/.exec(value);
  if (named) {
    const month = MONTH_NAMES.get(named[1] ?? '');
    if (month !== undefined) return monthFrom(Number(named[2]), month);
  }

  return { ok: false, code: 'date_unrecognized' };
}

function monthFrom(year: number, month: number): ParsedDate {
  const ym = makeYearMonth(year, month);
  if (ym === null) return { ok: false, code: 'date_unrecognized' };
  return { ok: true, kind: 'month', value: ym };
}

/**
 * Interpreta o par início/fim de uma experiência.
 * - Ano isolado no início vale janeiro; no fim, dezembro.
 * - Marcador de "atual" no fim deixa o intervalo em aberto (`end` nulo, `current` verdadeiro).
 * - Fim anterior ao início devolve `date_range_reversed`.
 */
export function parseDateRange(startText: string, endText: string): DateRange {
  const start = toStart(parseDateText(startText));
  if (!start.ok) return start;

  const endParsed = parseDateText(endText);
  if (!endParsed.ok) return endParsed;
  if (endParsed.kind === 'current') {
    return { ok: true, start: start.value, end: null, current: true };
  }
  const end = endParsed.kind === 'year'
    ? makeYearMonth(endParsed.year, 12)
    : endParsed.value;
  if (end === null) return { ok: false, code: 'date_unrecognized' };
  if (compareYearMonth(end, start.value) < 0) {
    return { ok: false, code: 'date_range_reversed' };
  }
  return { ok: true, start: start.value, end, current: false };
}

type StartResult = { readonly ok: true; readonly value: YearMonth } | DateError;

function toStart(parsed: ParsedDate): StartResult {
  if (!parsed.ok) return parsed;
  if (parsed.kind === 'current') return { ok: false, code: 'date_unrecognized' };
  if (parsed.kind === 'year') {
    const ym = makeYearMonth(parsed.year, 1);
    return ym === null ? { ok: false, code: 'date_unrecognized' } : { ok: true, value: ym };
  }
  return { ok: true, value: parsed.value };
}
