// Termos da lista citados em cada tipo de texto do perfil. A ficha usa para montar os termos, e o leitor para saber se uma entrada
// de Experiência tem termo de tecnologia, que é um dos sinais de trabalho (DP-24). Os dois têm de concordar no que é termo.
import { canonicalOf, categoryOf, findTerms, isKnownTerm } from '../dictionary/index.ts';
import type { TermCategory } from '../dictionary/index.ts';
import { normalize } from '../text/normalize.ts';
import { BRAZILIAN_STATE_CODES } from './places.ts';
import { foldNeutralSpelling } from './work-titles.ts';

// canonicalOf recusa acima disso, e o recorte abaixo só vale a pena em texto curto.
const MAX_ITEM_CHARS = 80;
const ITEM_SEPARATOR = /[,;·•|‧∙⋅]/u;
const ITEM_JOINER = /\s+(?:e|y|and)\s+|\s*\/\s*/iu; // "Go e Rust", "C/C++"
const ITEM_QUALIFIER = /\s*(?:[([:]|\s[-–—]\s).*$/u; // "Go (avançado)", "Inglês - Fluente"
const ITEM_LEVEL = /\s+(?:avan[cç]ado|intermedi[aá]rio|b[aá]sico|fluente|nativo|native|fluent|advanced|intermediate|basic|beginner)$/iu; // "Go avançado"
const LIST_LABEL = /^([^:：]{1,40})[:：]\s*/u; // "Linguagens: Go, Rust", "Python: avançado"
const LABELED_LINE = /^([^:：]{2,40})[:：]\s*(.+)$/u;

// A lista de termos traz as formas femininas dos cargos, menos esta, que nem sempre é usada: "Gerenta de produto".
const IRREGULAR_FEMININE = /(?<!\p{L})gerenta(?!\p{L})/giu;

/** Rótulos de linha de competências dentro de uma experiência, já passados por `normalize`. */
const STACK_LABELS: ReadonlySet<string> = new Set([
  'competencias', 'principais competencias', 'competencias principais', 'habilidades', 'conhecimentos', 'tecnologias',
  'tecnologia', 'tecnologias utilizadas', 'ferramentas', 'linguagens', 'stack', 'stack tecnica', 'stack tecnologica',
  'skills', 'top skills', 'key skills', 'technologies', 'tools', 'languages', 'frameworks', 'tech stack',
]);

// Só com sigla em maiúsculas e nome de lugar antes: "Goiânia, GO" e "Goiânia/GO" perdem a sigla, e "Java, GO" fica.
const STATE_AFTER_PLACE = new RegExp(`(\\p{Lu}[\\p{L}\\p{M}'’-]{1,40})\\s*[,/-]\\s*(?:${[...BRAZILIAN_STATE_CODES].join('|')})(?![\\p{L}\\p{N}])`, 'gu');

/** Sigla de estado não é termo (DP-06): sem isto, "Goiânia, GO" no meio de uma frase daria crédito em Go. */
function withoutStateCodes(text: string): string {
  return text.replace(STATE_AFTER_PLACE, (match: string, place: string) => (isKnownTerm(place) ? match : place));
}

/** Consultas já feitas nesta análise. O mesmo item se repete muito, e cada consulta normaliza o texto. Morre com a análise. */
export type Memo = Map<string, string | null>;

/** Só o que a pessoa escreveu como item de lista designa o termo, mesmo ambíguo. */
function designated(item: string, memo: Memo): string | null {
  if (item.length > MAX_ITEM_CHARS) return null;
  const known = memo.get(item);
  if (known !== undefined) return known;
  const head = item.replace(ITEM_QUALIFIER, '');
  const withoutLevel = head.replace(ITEM_LEVEL, '');
  const listed = canonicalOf(item) ?? (head === item ? null : canonicalOf(head)) ?? (withoutLevel === head ? null : canonicalOf(withoutLevel));
  memo.set(item, listed);
  return listed;
}

interface Reading {
  readonly terms: Set<string>;
  /** O que não foi designado. Passa pela busca comum, que exige contexto para termo ambíguo. */
  readonly rest: string[];
  readonly memo: Memo;
}

function readItems(text: string, reading: Reading): void {
  for (const raw of text.split(ITEM_SEPARATOR)) {
    const item = raw.trim();
    if (item === '') continue;
    const whole = designated(item, reading.memo);
    if (whole !== null) {
      reading.terms.add(whole);
      continue;
    }
    const parts = item.length > MAX_ITEM_CHARS ? [item] : item.split(ITEM_JOINER);
    const listed = parts.length === 1 ? [null] : parts.map((part) => designated(part.trim(), reading.memo));
    for (const canonical of listed) if (canonical !== null) reading.terms.add(canonical);
    if (listed.includes(null)) reading.rest.push(item);
  }
}

/**
 * Termos em texto corrido. O espaço no fim é folga para o orçamento da busca: um texto de dois caracteres, como "C#", gasta mais
 * passos do que o orçamento dele paga, e a busca desistiria sem achar nada.
 */
export function termsInProse(text: string): string[] {
  if (text === '') return [];
  return findTerms(`${withoutStateCodes(text)}  `).map((hit) => hit.canonical);
}

function finish(reading: Reading): Set<string> {
  for (const canonical of termsInProse(reading.rest.join('\n'))) reading.terms.add(canonical);
  return reading.terms;
}

/** Competências, Idiomas e Certificados: cada linha ou item é uma lista. O que vem antes dos dois-pontos também é item, e assim "Python: avançado" conta. */
export function termsInList(text: string, memo: Memo): Set<string> {
  const reading: Reading = { terms: new Set(), rest: [], memo };
  for (const line of withoutStateCodes(text).split('\n')) {
    const label = LIST_LABEL.exec(line);
    if (label !== null) readItems(label[1] ?? '', reading);
    readItems(label === null ? line : line.slice(label[0].length), reading);
  }
  return finish(reading);
}

/** Experiência: a linha rotulada é lista, e o resto é texto corrido. */
export function termsInExperience(text: string, memo: Memo): Set<string> {
  const reading: Reading = { terms: new Set(), rest: [], memo };
  for (const line of foldNeutralSpelling(withoutStateCodes(text)).replace(IRREGULAR_FEMININE, 'gerente').split('\n')) {
    const labeled = LABELED_LINE.exec(line);
    if (labeled !== null && STACK_LABELS.has(normalize(labeled[1]))) readItems(labeled[2] ?? '', reading);
    else reading.rest.push(line);
  }
  return finish(reading);
}

/** Idioma e nome de cargo não são tecnologia: "estudei inglês" não faz um intercâmbio virar emprego. */
const WORK_CATEGORIES: ReadonlySet<TermCategory> = new Set<TermCategory>(['technology', 'tool', 'skill', 'certification']);

/** O texto da entrada cita termo de tecnologia, com a mesma leitura que a ficha vai fazer dele (DP-24). */
export function hasTechTerm(text: string): boolean {
  for (const canonical of termsInExperience(text, new Map())) {
    const category = categoryOf(canonical);
    if (category !== null && WORK_CATEGORIES.has(category)) return true;
  }
  return false;
}
