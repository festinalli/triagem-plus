// Trava de termos proibidos (RF-13, RF-14, RF-15, RF-65, RD-8). Compara palavra inteira, sem acento e sem diferença de
// maiúsculas. Puro: sem Chrome, DOM, relógio nem rede.
//
// Custo linear no tamanho do texto, e nunca mais que MAX_GUARD_CHARS são lidos: os espaços são colapsados antes, então
// corrida de espaços não esconde nada nem custa nada, e nenhum padrão pode retroceder.
//
// checkTerm é para termo curto digitado (requisito, termo de busca, termo excluído): a palavra ambígua conta quando é o
// termo inteiro. findForbidden é para frase e texto longo (linha da vaga, nota): só o que não tem outro sentido em vaga.
// `matched` é o trecho na forma normalizada, sem acento: serve para conferir, e a tela mostra `reason`.
import { normalize } from '../text/normalize.ts';
import { CAPITALS, CITY_SUFFIXES, LEXICON, SAFE_PHRASES, TERM_LEAD, TERM_TAIL } from './lexicon.ts';
import { findPatterns, postalCodeSpans, shieldedTokens } from './patterns.ts';
import { bareAgeTerm, barePlusAge, bareDistanceTerm, findNumericLimits, LINE_MARK, prepareYears } from './years.ts';
import type { GuardSpan } from './years.ts';
import { FORBIDDEN_TOPICS, TOPIC_REASONS } from './topics.ts';
import type { ForbiddenTopic } from './topics.ts';

export { FORBIDDEN_TOPICS, TOPIC_REASONS } from './topics.ts';
export type { ForbiddenTopic } from './topics.ts';

export interface ForbiddenHit {
  readonly topic: ForbiddenTopic;
  readonly matched: string;
  readonly reason: string;
}

export type TermCheck = { readonly allowed: true } | ({ readonly allowed: false } & ForbiddenHit);

/** Frases por primeira palavra, para só montar janela onde pode haver casamento. `null` marca expressão segura. */
interface PhraseIndex {
  readonly phrases: ReadonlyMap<string, ForbiddenTopic | null>;
  readonly longestFrom: ReadonlyMap<string, number>;
}

function buildIndex(lists: readonly ('anywhere' | 'inTerm')[]): PhraseIndex {
  const phrases = new Map<string, ForbiddenTopic | null>();
  const longestFrom = new Map<string, number>();
  const put = (entry: string, topic: ForbiddenTopic | null): void => {
    const key = normalize(entry);
    if (key === '' || phrases.has(key)) return;
    phrases.set(key, topic);
    const words = key.split(' ');
    const first = words[0] ?? '';
    longestFrom.set(first, Math.max(longestFrom.get(first) ?? 0, words.length));
  };
  for (const entry of SAFE_PHRASES) put(entry, null);
  for (const topic of FORBIDDEN_TOPICS) {
    for (const list of lists) {
      for (const entry of LEXICON[topic][list]) put(entry, topic);
    }
  }
  return { phrases, longestFrom };
}

const IN_TEXT = buildIndex(['anywhere']);
const IN_TERM = buildIndex(['anywhere', 'inTerm']);

const WHOLE_TERMS: ReadonlyMap<string, ForbiddenTopic> = (() => {
  const terms = new Map<string, ForbiddenTopic>();
  for (const topic of FORBIDDEN_TOPICS) {
    for (const entry of LEXICON[topic].wholeTerm) {
      const key = normalize(entry);
      if (key !== '' && !terms.has(key)) terms.set(key, topic);
    }
  }
  return terms;
})();

const LEAD: ReadonlySet<string> = new Set(TERM_LEAD);
const TAIL: ReadonlySet<string> = new Set(TERM_TAIL);
const CITIES: ReadonlySet<string> = new Set(CAPITALS);
const SUFFIXES: ReadonlySet<string> = new Set(CITY_SUFFIXES);

/**
 * Até aqui a trava lê, depois de colapsar os espaços. Nenhuma linha de vaga, nota ou termo real chega perto. O que vier depois
 * do limite não é lido: por isso quem aceita termo digitado também recusa o que passa de MAX_TERM_CHARS.
 */
export const MAX_GUARD_CHARS = 100_000;
/** Termo digitado (requisito, termo de busca, termo excluído) mais longo que isso é recusado em vez de ser lido pela metade. */
export const MAX_TERM_CHARS = 200;

const WHITESPACE = /[\s\u0085]+/gu;
const HORIZONTAL_SPACE = /[^\S\r\n]+/gu;
// Quebra de linha com tudo o que é espaço depois dela: várias quebras seguidas valem uma.
const LINE_BREAK = /[\r\n][\s\u0085]*/gu;

// A normalização apaga a pontuação e cola o que estava em volta: "Java,mulheres" viraria uma palavra só e passaria batido.
// Pontuação entre duas palavras vira espaço antes de normalizar. Ficam de fora o ponto de sigla ("P.C.D."), o "(a)" de
// "solteiro(a)" e os caracteres invisíveis, que a normalização já remove sem separar a palavra.
const GLUED_PUNCTUATION = /([\p{L}\p{N}])[^\p{L}\p{N}\p{M}\p{Cf}\s\-_/\\|‐‑().]+(?=[\p{L}\p{N}])/gu;
const GLUED_DOT = /(\p{L}{2})\.(?=\p{L}{2})/gu;
const OPENING_PAREN = /\((?!\p{L}{1,2}\))/gu;
const CLOSING_PAREN = /\)(?=[\p{L}\p{N}]{2})/gu;

// Cabeçalho de cache não é idade: "max-age=60".
const CACHE_MAX_AGE = /max-age ?= ?\d+/giu;
// "desenvolvedor(a)" é a forma inclusiva. Colada, a normalização a deixaria igual a "desenvolvedora", que pode ser filtro.
const INCLUSIVE_ROLE = /(desenvolvedor|programador|consultor|gestor|coordenador|administrador)\((as?)\)/giu;
// Com acento, "fé" não é a sigla de front-end, e por isso vale sozinha. O acento some na normalização.
const FAITH_WITH_ACCENT = /(?<![\p{L}\p{N}])fé(?![\p{L}\p{N}])/iu;

function comparable(text: string): string {
  const spaced = prepareYears(text).replace(CACHE_MAX_AGE, ' ').replace(INCLUSIVE_ROLE, '$1 $2').replace(GLUED_PUNCTUATION, '$1 ').replace(GLUED_DOT, '$1 ').replace(OPENING_PAREN, ' (').replace(CLOSING_PAREN, ') ');
  return normalize(spaced);
}

function faithSpan(text: string, tokens: readonly string[]): GuardSpan[] {
  if (!FAITH_WITH_ACCENT.test(text.normalize('NFC'))) return [];
  const at = tokens.indexOf('fe');
  return at < 0 ? [] : [{ topic: 'religion', start: at, end: at + 1 }];
}

function tokensOf(text: string): string[] {
  const normalized = comparable(text);
  return normalized === '' ? [] : normalized.split(' ');
}

/** Casamento guloso, da esquerda para a direita, com a expressão mais longa. A segura consome as palavras e não dispara. */
function scanPhrases(tokens: readonly string[], index: PhraseIndex, skip: Set<number>): GuardSpan[] {
  const spans: GuardSpan[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (skip.has(i)) continue;
    const longest = index.longestFrom.get(tokens[i] ?? '');
    if (longest === undefined) continue;
    for (let size = Math.min(longest, tokens.length - i); size >= 1; size--) {
      const topic = index.phrases.get(size === 1 ? (tokens[i] ?? '') : tokens.slice(i, i + size).join(' '));
      if (topic === undefined) continue;
      if (topic !== null) spans.push({ topic, start: i, end: i + size });
      else for (let k = i; k < i + size; k++) skip.add(k);
      i += size - 1;
      break;
    }
  }
  return spans;
}

/** Tudo o que cai na trava num trecho, em ordem de leitura. `skip` começa com o que já se sabe que não pede nada. */
function allSpans(tokens: readonly string[], index: PhraseIndex, skip: Set<number>, typed: boolean): GuardSpan[] {
  const phrases = scanPhrases(tokens, index, skip);
  const numeric = findNumericLimits(tokens, typed).filter((span) => !skip.has(span.start));
  return [...phrases, ...numeric, ...findPatterns(tokens, skip)].sort(byReadingOrder);
}

/** O termo inteiro, com ou sem o que costuma cercá-lo: "single", "somente jovem", "em Natal", "Natal RN". */
function wholeTermSpan(tokens: readonly string[]): GuardSpan | null {
  const direct = WHOLE_TERMS.get(tokens.join(' '));
  if (direct !== undefined) return { topic: direct, start: 0, end: tokens.length };
  let start = 0;
  let end = tokens.length;
  while (start < end - 1 && LEAD.has(tokens[start] ?? '')) start++;
  while (end - 1 > start && TAIL.has(tokens[end - 1] ?? '')) end--;
  const core = WHOLE_TERMS.get(tokens.slice(start, end).join(' '));
  if (core !== undefined) return { topic: core, start, end };
  if (end - 1 > start && SUFFIXES.has(tokens[end - 1] ?? '') && CITIES.has(tokens.slice(start, end - 1).join(' '))) {
    return { topic: 'address_distance', start, end };
  }
  return null;
}

function byReadingOrder(a: GuardSpan, b: GuardSpan): number {
  return a.start - b.start || b.end - a.end;
}

function hitOf(tokens: readonly string[], span: GuardSpan): ForbiddenHit {
  return { topic: span.topic, matched: tokens.slice(span.start, span.end).join(' '), reason: TOPIC_REASONS[span.topic] };
}

/** Confere um termo curto digitado. Recusa com o assunto, o trecho e o motivo. */
export function checkTerm(text: string): TermCheck {
  if (typeof text !== 'string') return { allowed: true };
  const bounded = text.replace(WHITESPACE, ' ').slice(0, MAX_GUARD_CHARS);
  const tokens = tokensOf(bounded);
  if (tokens.length === 0) return { allowed: true };
  const whole = wholeTermSpan(tokens) ?? bareAgeTerm(tokens) ?? bareDistanceTerm(tokens) ?? (barePlusAge(bounded) ? { topic: 'age' as const, start: 0, end: tokens.length } : null);
  const span = whole ?? [...allSpans(tokens, IN_TERM, new Set(), true), ...postalCodeSpans(tokens), ...faithSpan(bounded, tokens)].sort(byReadingOrder)[0];
  return span === undefined ? { allowed: true } : { allowed: false, ...hitOf(tokens, span) };
}

/** Tudo o que cai na trava num texto longo, na ordem de leitura, sem repetir o mesmo trecho. */
export function findForbidden(text: string): ForbiddenHit[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  // Uma passada só sobre o texto inteiro, porque a normalização custa mais do que o resto. A quebra de linha vira uma palavra
  // que nenhuma expressão contém, então nada casa de uma linha para a outra.
  const bounded = text.replace(HORIZONTAL_SPACE, ' ').replace(LINE_BREAK, ` ${LINE_MARK} `).slice(0, MAX_GUARD_CHARS);
  const normalized = comparable(bounded);
  if (normalized === '') return [];
  const tokens = normalized.split(' ');
  const shielded = shieldedTokens(tokens);
  const spans = [...allSpans(tokens, IN_TEXT, shielded, false), ...faithSpan(bounded, tokens)].sort(byReadingOrder);
  const hits: ForbiddenHit[] = [];
  const seen = new Set<string>();
  let coveredUntil = 0;
  let coveredTopic: ForbiddenTopic | null = null;
  for (const span of spans) {
    // "até 35 anos de idade" é um achado só, não dois do mesmo assunto.
    if (span.topic === coveredTopic && span.start < coveredUntil) continue;
    coveredUntil = span.end;
    coveredTopic = span.topic;
    const hit = hitOf(tokens, span);
    const key = `${hit.topic}:${hit.matched}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(hit);
  }
  return hits;
}
