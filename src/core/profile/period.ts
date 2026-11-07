// A linha de período é a âncora da experiência: "jan de 2020 - o momento · 4 anos 10 meses".
import { normalize } from '../text/normalize.ts';
import { parseDateRange, parseDateText } from '../time/parse-date.ts';
import type { MonthSpan } from '../time/types.ts';

const MAX_PERIOD_CHARS = 120;

/** Separadores que o texto usa entre as partes de uma linha. */
export const LINE_SEGMENT = /\s*[·•|‧∙⋅]\s*/u;

// Sobre texto já passado por `normalize` (sem acento, sem pontuação).
const DURATION = /^(?:\d+ (?:anos?|mes(?:es)?|yrs?|years?|mos?|months?)(?: (?:e )?\d+ (?:mes(?:es)?|mos?|months?))?|menos de (?:um|1) (?:ano|mes)|less than (?:a|one|1) (?:year|month))$/u;

export function isDurationText(segment: string): boolean {
  return DURATION.test(normalize(segment));
}

// Duração colada no fim, sem o ponto do meio, que às vezes some na colagem: "jan 2020 - atual 4 anos 10 meses".
const TRAILING_DURATION = /[\s,(]+\d+\s*(?:anos?|m[eê]s(?:es)?|yrs?|years?|mos?|months?)(?:\s*,?\s*(?:e\s+)?\d+\s*(?:m[eê]s(?:es)?|mos?|months?))?\)?$/iu;
const RANGE_SEPARATOR = /\s+(?:-|–|—|a|até|ate|to|until)\s+|\s*[–—]\s*/iu;
const TIGHT_RANGE = /^(.*?\d{4})-(.+)$/u; // "2019-2021", "jan 2020-atual"
// Formas de data, sobre texto já passado por `normalize`, mesmo que o mês não seja reconhecido (outro idioma) ou o
// número seja inválido. Palavra e ano só contam dos dois lados: "ISO-9001 - 2015" e "Copa 2014 - 2018" são descrição.
const WORD_AND_YEAR = /^\p{L}{2,12} (?:de )?\d{4}$/u;
const NUMBER_AND_YEAR = /^\d{1,2} \d{4}$/u;
const DATE_SHAPE = /^(?:\p{L}{2,12} (?:de )?|\d{1,2} )?\d{4}$/u;

const WHOLE_LINE_BRACKETS = /^[([{]\s*(.*?)\s*[)\]}]$/u; // "(jan 2020 - dez 2021)"
const SINCE = /^(?:desde|since|from)\s+/iu; // "Desde jan de 2020"
const FROM = /^de\s+/iu; // "De 2020 a 2021"
const DAY_MONTH_YEAR = /^\d{1,2}\/(\d{1,2}\/\d{4})$/u; // "20/01/2020"
const CURRENT = 'atual';
/** Outras formas de "ainda em curso", além das que a leitura de data já conhece. Sobre texto já passado por `normalize`. */
const STILL_GOING: ReadonlySet<string> = new Set(['agora', 'ate agora', 'em andamento', 'em curso', 'today', 'ongoing', 'to date']);

function dateText(part: string): string {
  if (STILL_GOING.has(normalize(part))) return CURRENT;
  return part.replace(DAY_MONTH_YEAR, '$1');
}

function splitRange(head: string): readonly [string, string] | null {
  const parts = head.split(RANGE_SEPARATOR);
  if (parts.length === 2) return [parts[0] ?? '', parts[1] ?? ''];
  if (parts.length > 2) return null;
  const tight = TIGHT_RANGE.exec(head);
  return tight === null ? null : [tight[1] ?? '', tight[2] ?? ''];
}

export interface PeriodLine {
  /** Nulo quando a linha tem cara de período mas não é legível, como fim antes do início. */
  readonly span: MonthSpan | null;
}

/** Reconhece a linha de período. Devolve nulo quando a linha não é de período. */
export function readPeriodLine(line: string): PeriodLine | null {
  if (line.length > MAX_PERIOD_CHARS || !/\d{4}/u.test(line)) return null;

  const segments = line.split(LINE_SEGMENT);
  let head = segments[0] ?? '';
  let hasDuration = segments.slice(1).some(isDurationText);
  const trailing = TRAILING_DURATION.exec(head);
  if (trailing !== null) {
    head = head.slice(0, trailing.index);
    hasDuration = true;
  }
  head = head.replace(WHOLE_LINE_BRACKETS, '$1');

  // "Desde jan de 2020" é um período em aberto, sem precisar de duração ao lado. Com fim, é um intervalo comum.
  const since = SINCE.exec(head);
  if (since !== null) {
    head = head.slice(since[0].length);
    if (parseDateText(head).ok) {
      const open = parseDateRange(dateText(head), CURRENT);
      return open.ok ? { span: { start: open.start, end: open.end } } : null;
    }
  } else {
    head = head.replace(FROM, '');
  }

  // Uma data só precisa da duração ao lado: "mar de 2020 · 1 mês". Sozinha, pode ser qualquer coisa.
  if (parseDateText(head).ok) {
    if (!hasDuration) return null;
    const single = parseDateRange(head, head);
    return single.ok ? { span: { start: single.start, end: single.end } } : null;
  }

  const parts = splitRange(head);
  if (parts === null) return null;
  const startText = dateText(parts[0]);
  const endText = dateText(parts[1]);
  const range = parseDateRange(startText, endText);
  if (range.ok) return { span: { start: range.start, end: range.end } };

  const start = normalize(startText);
  const end = normalize(endText);
  const startLegible = parseDateText(startText).ok;
  const illegible =
    (DATE_SHAPE.test(end) && (startLegible || NUMBER_AND_YEAR.test(start))) ||
    (WORD_AND_YEAR.test(start) && WORD_AND_YEAR.test(end)) ||
    (hasDuration && startLegible);
  return illegible ? { span: null } : null;
}
