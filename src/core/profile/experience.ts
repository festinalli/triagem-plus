// Experiências a partir das linhas da seção. A âncora é a linha de período: cada uma abre uma experiência, e o cargo é
// procurado para trás. Empresa, tipo de contrato, local e modalidade nunca chegam a `text` (RF-42, DP-06). `title` é só a linha
// que parece o cargo, em memória: a ficha nunca guarda esse texto, e sim o rótulo da lista fechada (DP-23, ./work-titles.ts).
//
// O formato real não foi visto (R-04). Os dois formatos previstos:
//   um cargo:       Cargo / Empresa · Tempo integral / período / local / descrição / Competências: ...
//   vários cargos:  Empresa / Tempo integral · 5 anos / Cargo A / período / ... / Cargo B / período / ...
//
// O tempo de uma entrada só conta se ela tiver sinal de trabalho: palavra de cargo, tipo de contrato ou termo de tecnologia
// (RF-43, DP-24). Sem sinal, a entrada fica sem período: o que ela citar continua valendo, mas sem meses.
import { isKnownTerm } from '../dictionary/index.ts';
import { normalize } from '../text/normalize.ts';
import { unionMonths } from '../time/union.ts';
import type { MonthSpan, YearMonth } from '../time/types.ts';
import { isCareerBreakLine } from './career-break.ts';
import { MAX_SHORT_LINE } from './lines.ts';
import { LINE_SEGMENT, isDurationText, readPeriodLine } from './period.ts';
import { BRAZILIAN_STATE_CODES, STATES_AND_COUNTRIES } from './places.ts';
import { hasTechTerm } from './terms.ts';
import type { ParsedExperience } from './types.ts';
import { hasWorkWord } from './work-titles.ts';

export interface ExperienceLine {
  readonly text: string;
  /** Havia linha em branco antes. Só separa blocos quando não há nenhum período. */
  readonly afterBlank: boolean;
}

const CONTRACT_TYPES: ReadonlySet<string> = new Set([
  'tempo integral', 'periodo integral', 'meio periodo', 'autonomo', 'autonoma', 'freelance', 'freelancer', 'contrato',
  'temporario', 'temporaria', 'estagio', 'aprendiz', 'terceirizado', 'terceirizada', 'sazonal', 'clt', 'pj',
  'full time', 'part time', 'self employed', 'contract', 'internship', 'apprenticeship', 'temporary', 'seasonal',
  'permanent', 'permanent full time', 'permanent part time', 'contract full time', 'contract part time',
]);
const NAMES_CONTRACT = new RegExp(`(?:^| )(?:${[...CONTRACT_TYPES].join('|')})(?: |$)`, 'u');

/** Só para o cabeçalho da entrada: na descrição, "contrato" é uma palavra qualquer. */
function namesContract(line: string): boolean {
  return line.length <= MAX_SHORT_LINE && NAMES_CONTRACT.test(normalize(line));
}

/**
 * pure: só tipo de contrato ou duração ("Tempo integral · 5 anos"). company: empresa com contrato ou duração
 * ("Empresa · Tempo integral"). maybe: tem separador, mas nada conhecido, e só a posição decide.
 */
type Employment = 'pure' | 'company' | 'maybe' | null;

function employmentOf(line: string): Employment {
  if (line.length > MAX_SHORT_LINE) return null;
  const segments = line.split(LINE_SEGMENT).filter((segment) => segment !== '');
  if (segments.length === 0) return null;
  const known = segments.filter((s) => CONTRACT_TYPES.has(normalize(s)) || isDurationText(s)).length;
  if (known === segments.length) return 'pure';
  if (known > 0) return 'company';
  return segments.length > 1 && !line.includes(':') ? 'maybe' : null;
}

const MODALITY = '(?:hibrida|hibrido|remota|remoto|remote|presencial|hybrid|onsite|on site|in person)';
const MODALITY_AT_END = new RegExp(`(?:^| )${MODALITY}$`, 'u');
const MODALITY_AT_START = new RegExp(`^${MODALITY}(?: \\S+){0,2}$`, 'u');
const MODALITY_ALONE = new RegExp(`^${MODALITY}$`, 'u');
const MAX_LOCATION_WORDS = 6;

function hasModality(segment: string): boolean {
  const key = normalize(segment);
  if (key.split(' ').length > MAX_LOCATION_WORDS) return false;
  return MODALITY_AT_END.test(key) || MODALITY_AT_START.test(key);
}

const PLACE_NAME = /^\p{Lu}[\p{L}\p{M}'’-]*(?: (?:\p{Lu}[\p{L}\p{M}'’-]*|de|do|da|dos|das|del|di)){0,5}$/u;
const PLACE_WITH_STATE_CODE = /^(.+?)\s*[-/]\s*\p{Lu}{2}$/u; // "São Paulo - SP", "São Paulo/SP"
const PLACE_THEN_STATE_CODE = /^(.+) (\p{Lu}{2})$/u; // "Goiânia GO"
const MAX_PLACE_PARTS = 4;

function placeParts(segment: string): string[] {
  return segment.split(/\s*,\s*/u);
}

function isCityState(segment: string): boolean {
  const withCode = PLACE_WITH_STATE_CODE.exec(segment);
  if (withCode !== null) return PLACE_NAME.test(withCode[1] ?? '');
  const parts = placeParts(segment);
  return parts.length >= 2 && parts.length <= MAX_PLACE_PARTS && parts.every((part) => PLACE_NAME.test(part));
}

/** "Java, Spring" tem a forma de "Cidade, Estado", mas é stack: uma parte que é termo da lista tira a dúvida. */
function namesKnownTerm(segment: string): boolean {
  return placeParts(segment).some((part) => isKnownTerm(part));
}

/**
 * Cidade seguida de sigla de UF em maiúsculas é sempre local, mesmo que a sigla seja nome de termo, como GO: "Goiânia, GO",
 * "Rio de Janeiro, RJ, Brasil", "Goiânia GO". Só o que vem antes da sigla pode tirar a dúvida: "Java, GO" é stack.
 */
function isCityWithStateCode(segment: string): boolean {
  const spaced = PLACE_THEN_STATE_CODE.exec(segment);
  if (spaced !== null && !segment.includes(',')) {
    const place = spaced[1] ?? '';
    return BRAZILIAN_STATE_CODES.has(spaced[2] ?? '') && PLACE_NAME.test(place) && !place.split(' ').some((word) => isKnownTerm(word));
  }
  const parts = placeParts(segment);
  if (parts.length < 2 || parts.length > MAX_PLACE_PARTS) return false;
  const code = parts.findIndex((part) => BRAZILIAN_STATE_CODES.has(part));
  if (code < 1) return false;
  const before = parts.slice(0, code);
  const after = parts.slice(code + 1);
  return before.every((part) => PLACE_NAME.test(part) && !isKnownTerm(part)) && after.every((part) => STATES_AND_COUNTRIES.has(normalize(part)));
}

/**
 * Linha de local, em qualquer posição do trecho: parece "Cidade, Estado", tem a modalidade ou é só a sigla da UF. Na dúvida, fica
 * de fora (DP-06). Exceção: "Cidade, Estado" que cita termo da lista é stack e fica, porque perder stack muda a nota de quem
 * escreve assim. "Competências: Java, Spring" fica, porque tem dois-pontos.
 */
function isLocationLine(line: string): boolean {
  if (line.length > MAX_SHORT_LINE || line.includes(':') || /[.!?;]$/u.test(line)) return false;
  if (BRAZILIAN_STATE_CODES.has(line)) return true;
  return line.split(LINE_SEGMENT).some((segment) =>
    hasModality(segment) || isCityWithStateCode(segment) || (isCityState(segment) && !namesKnownTerm(segment)));
}

/**
 * Em volta do cargo a dúvida troca de lado: "Engenheiro de Software, Backend" tem forma de "Cidade, Estado", e
 * "Desenvolvedor Remoto" termina em modalidade. Ali só é local a modalidade sozinha, ou o que termina em país ou estado
 * conhecido. Limite: "Austin, Texas" colado antes do período, fora do formato previsto, passaria por cargo.
 */
function isSureLocation(line: string): boolean {
  if (line.length > MAX_SHORT_LINE || line.includes(':')) return false;
  if (BRAZILIAN_STATE_CODES.has(line)) return true;
  return line.split(LINE_SEGMENT).some((segment) => {
    if (MODALITY_ALONE.test(normalize(segment)) || isCityWithStateCode(segment)) return true;
    if (!isCityState(segment)) return false;
    if (PLACE_WITH_STATE_CODE.test(segment)) return true;
    const tail = placeParts(segment).at(-1) ?? '';
    return /^\p{Lu}{2}$/u.test(tail) || STATES_AND_COUNTRIES.has(normalize(tail));
  });
}

/** "Engenheira de Software · Remoto": a modalidade está junto, mas a linha é a do cargo. */
function isLocationAboveAnchor(line: string): boolean {
  return isSureLocation(line) && !hasWorkWord(line);
}

/** Logo depois do período, um nome de lugar sozinho também é local: "Brasil", "Região de Campinas". "Python" e "Java Spring" não são. */
function isBarePlace(line: string): boolean {
  return line.length <= MAX_SHORT_LINE && PLACE_NAME.test(line) && !line.split(' ').some((word) => isKnownTerm(word));
}

const MAX_TITLE_CHARS = 100;
const MAX_TITLE_WORDS = 12;
const TITLE_ABBREVIATION_END = /(?:^|\s)(?:sr|sra|jr|pl|dr|dra|prof|eng)\.$/iu;

/** Forma de cargo: curta e sem cara de frase. "Desenvolvedor Sr." passa; "Atuei em Go." não passa. */
function isBareTitle(line: string): boolean {
  if (line.length > MAX_TITLE_CHARS || line.includes(':')) return false;
  if (!/^[\p{L}\p{N}]/u.test(line) || /[!?;,]$/u.test(line)) return false;
  if (line.endsWith('.') && !TITLE_ABBREVIATION_END.test(line)) return false;
  if (line.split(' ').length > MAX_TITLE_WORDS) return false;
  const employment = employmentOf(line);
  return employment === null || employment === 'maybe';
}

interface Header {
  readonly title: string;
  /** Primeira linha que pertence ao cabeçalho desta experiência. O que vem antes é do corpo da anterior. */
  readonly start: number;
  readonly inGroup: boolean;
}

/**
 * Acha o cargo andando para trás a partir do período, sem passar de `floor`. Palavra de cargo da lista decide primeiro: entre
 * "Acme" e "Engenheira", o cargo é a segunda, em qualquer ordem. Sem ela, só a posição decide. `inGroup` diz que estamos num grupo
 * de vários cargos da mesma empresa, e lá a linha colada no período é sempre o cargo. Fora de um grupo, com duas linhas sem nenhum
 * tipo de contrato ("Cargo / Empresa / período"), o cargo é a de cima.
 */
function locateHeader(lines: readonly ExperienceLine[], anchor: number, floor: number, inGroup: boolean): Header {
  const at = (index: number): string => lines[index]?.text ?? '';
  let i = anchor - 1;
  while (i >= floor && isLocationAboveAnchor(at(i))) i--;
  while (i >= floor && employmentOf(at(i)) === 'pure') i--;

  let companyLine: string | null = null;
  if (i >= floor) {
    const employment = employmentOf(at(i));
    if (employment === 'company' || (employment === 'maybe' && i - 1 >= floor && isBareTitle(at(i - 1)))) {
      companyLine = at(i);
      i--;
    }
  }

  const here = at(i);
  const hereIsWork = hasWorkWord(here);
  // "Acme / Desenvolvedora · CLT / período": a linha com o contrato é a do cargo.
  if (companyLine !== null && !hereIsWork && hasWorkWord(companyLine)) return { title: companyLine, start: i + 1, inGroup: false };
  if (i < floor || !isBareTitle(here)) return { title: '', start: i + 1, inGroup };
  if (companyLine !== null) return { title: here, start: i, inGroup: false };
  if (i - 1 < floor) return { title: here, start: i, inGroup };

  const above = at(i - 1);
  const aboveEmployment = employmentOf(above);
  // "Empresa / Tempo integral · 5 anos / Cargo": a linha da empresa também sai do corpo da experiência anterior.
  if (aboveEmployment === 'pure') return { title: here, start: Math.max(i - 2, floor), inGroup: true };
  if (aboveEmployment === 'company') {
    // "Cargo / Empresa · Tempo integral / Austin, Texas / período": a linha colada no período era o local.
    if (!hereIsWork && i - 2 >= floor && hasWorkWord(at(i - 2))) return { title: at(i - 2), start: i - 2, inGroup: false };
    return { title: here, start: i - 1, inGroup: true };
  }
  if (isBareTitle(above) && !isSureLocation(above)) {
    const aboveIsWork = hasWorkWord(above);
    // A linha de cima pode ser a empresa ou o fim da descrição anterior, e a segunda não pode se perder. No começo da seção, é a empresa.
    if (hereIsWork && !aboveIsWork) return { title: here, start: floor === 0 && i - 1 === 0 ? 0 : i, inGroup };
    if (aboveIsWork && !hereIsWork) return { title: above, start: i - 1, inGroup: false };
    if (!inGroup) return { title: above, start: i - 1, inGroup: false };
  }
  return { title: here, start: i, inGroup };
}

function isEmploymentLine(line: string): boolean {
  const employment = employmentOf(line);
  return employment === 'pure' || employment === 'company';
}

function bodyOf(lines: readonly ExperienceLine[]): string[] {
  const body: string[] = [];
  lines.forEach((line, position) => {
    if (isEmploymentLine(line.text) || isLocationLine(line.text)) return;
    if (position === 0 && isBarePlace(line.text)) return;
    body.push(line.text);
  });
  return body;
}

function build(title: string, span: MonthSpan | null, body: readonly string[], asOf: YearMonth): ParsedExperience {
  return {
    title,
    span,
    months: span === null ? null : unionMonths([span], asOf),
    text: (title === '' ? body : [title, ...body]).join('\n'),
  };
}

/** Sem período nenhum, cada bloco separado por linha em branco vira uma experiência sem tempo, para os termos não se perderem. */
function readUndated(lines: readonly ExperienceLine[], asOf: YearMonth): ParsedExperience[] {
  const blocks: ExperienceLine[][] = [];
  for (const line of lines) {
    const current = blocks.at(-1);
    if (current === undefined || line.afterBlank) blocks.push([line]);
    else current.push(line);
  }

  const out: ParsedExperience[] = [];
  for (const block of blocks) {
    const [top = '', next = ''] = block.map((line) => line.text);
    if (isCareerBreakLine(top) || (isCareerBreakLine(next) && !hasWorkWord(top))) continue;
    const kept = block
      .filter((_, position) => employmentOf(block[position + 1]?.text ?? '') !== 'pure') // a empresa vem antes de "Tempo integral · 5 anos"
      .filter((line) => !isEmploymentLine(line.text) && !isLocationLine(line.text))
      .map((line) => line.text);
    const first = kept[0];
    const second = kept[1] ?? '';
    if (first === undefined) continue;
    if (isBareTitle(second) && hasWorkWord(second) && !hasWorkWord(first)) out.push(build(second, null, kept.slice(2), asOf));
    else if (isBareTitle(first)) out.push(build(first, null, kept.slice(1), asOf));
    else out.push(build('', null, kept, asOf));
  }
  return out;
}

function sameSpan(a: MonthSpan | null, b: MonthSpan | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Primeira linha do cabeçalho de uma pausa na carreira cujo período está em `anchor`, ou nulo se a entrada é um emprego. O
 * rótulo vem na linha do cargo ou logo acima dela, porque a página mostra "Pausa na carreira" e o tipo da pausa, em qualquer
 * ordem. Com palavra de cargo na linha colada no período, é emprego, mesmo que a linha de cima seja um rótulo. Limite conhecido:
 * empresa cujo nome começa com um rótulo, como "Maternidade Santa Joana", derruba o cargo. O erro fica do lado de não ler dado de
 * saúde ou de família.
 */
function careerBreakStart(lines: readonly ExperienceLine[], anchor: number, floor: number): number | null {
  const at = (index: number): string => lines[index]?.text ?? '';
  let last = anchor - 1;
  while (last >= floor && (isLocationAboveAnchor(at(last)) || employmentOf(at(last)) === 'pure')) last--;
  if (last < floor) return null;
  const aboveIsLabel = last - 1 >= floor && isCareerBreakLine(at(last - 1));
  if (isCareerBreakLine(at(last))) return aboveIsLabel ? last - 1 : last;
  return aboveIsLabel && !hasWorkWord(at(last)) ? last - 1 : null;
}

interface OpenEntry {
  title: string;
  span: MonthSpan | null;
  bodyStart: number;
  readonly careerBreak: boolean;
  /** O cabeçalho já traz palavra de cargo ou tipo de contrato. */
  readonly signal: boolean;
}

/** Tipo de contrato depois do período, em linha própria: "Cargo / período / Tempo integral". */
function isContractLine(line: ExperienceLine): boolean {
  return isEmploymentLine(line.text) && namesContract(line.text);
}

function close(entry: OpenEntry, lines: readonly ExperienceLine[], asOf: YearMonth): ParsedExperience[] {
  if (entry.careerBreak) return [];
  const body = bodyOf(lines);
  const worked = entry.signal || lines.some(isContractLine) || hasTechTerm([entry.title, ...body].join('\n'));
  return [build(entry.title, worked ? entry.span : null, body, asOf)];
}

/** Lê as experiências de uma ocorrência da seção Experiência. Pausa na carreira não vira experiência (./career-break.ts). */
export function readExperiences(lines: readonly ExperienceLine[], asOf: YearMonth): ParsedExperience[] {
  const out: ParsedExperience[] = [];
  let open: OpenEntry | null = null;
  let floor = 0;
  let inGroup = false;
  let groupContract = false;

  for (const [index, line] of lines.entries()) {
    const period = readPeriodLine(line.text);
    if (period === null) continue;
    // O mesmo período de novo, sem nada no meio, é repetição da página, com ou sem a duração ao lado.
    if (open !== null && index === open.bodyStart && sameSpan(period.span, open.span)) {
      open.bodyStart = index + 1;
      floor = index + 1;
      continue;
    }
    const header = locateHeader(lines, index, floor, inGroup);
    const breakStart = careerBreakStart(lines, index, floor);
    const start = breakStart === null ? header.start : Math.min(header.start, breakStart);
    const headerLines: readonly string[] = lines.slice(start, index).map((headerLine) => headerLine.text);
    // O tipo de contrato de um grupo vem uma vez só, acima do primeiro cargo, e vale para os outros.
    const hasContract: boolean = headerLines.some(namesContract);
    groupContract = breakStart === null && header.inGroup && (hasContract || (inGroup && groupContract));
    inGroup = breakStart === null && header.inGroup;
    if (open === null) out.push(...readUndated(lines.slice(0, start), asOf));
    else out.push(...close(open, lines.slice(open.bodyStart, start), asOf));
    open = {
      title: header.title,
      span: period.span,
      bodyStart: index + 1,
      careerBreak: breakStart !== null,
      signal: hasContract || groupContract || headerLines.some(hasWorkWord),
    };
    floor = index + 1;
  }

  if (open === null) return readUndated(lines, asOf);
  out.push(...close(open, lines.slice(open.bodyStart), asOf));
  return out;
}
