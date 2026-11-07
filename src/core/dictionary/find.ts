// Busca de termos num texto (RF-12, CA-04). Uma única passada sobre o texto, com orçamento de passos medido pelo
// trabalho real. Cada passagem cobra o tamanho do que de fato processou: a troca das formas protegidas cobra
// o tamanho da entrada; cada trecho cobra a sua leitura mais a saída da normalização e a divisão em palavras; cada
// consulta de janela cobra 1 passo mais 1 por termo de contexto da frase. O orçamento é de STEPS_PER_CHAR passos por
// caractere de entrada. Quando não há mais orçamento, a busca para e devolve o que já achou. Não há limiar de
// milissegundos.
import { normalize } from '../text/normalize.ts';
import { MAX_PHRASE_TOKENS } from './compile.ts';
import { protectText } from './protect.ts';
import type { CompiledDictionary, TermHit } from './types.ts';

/** Orçamento de passos por caractere de entrada. */
export const STEPS_PER_CHAR = 8;

/** Trecho sem espaço de no máximo este tamanho (em pontos de código). Nenhuma palavra do dicionário passa de 80 caracteres. */
const PIECE_CHARS = 128;
const PIECE = new RegExp(`\\S{1,${PIECE_CHARS}}|\\s+`, 'gu');
const SPACES = /^\s+$/u;
/** Tamanho aproximado do lote de texto normalizado de uma vez. */
const BATCH_CHARS = 2048;

interface Meter {
  /** Verdadeiro quando units ainda cabem no orçamento. */
  affordable(units: number): boolean;
  /** Cobra units passos. */
  charge(units: number): void;
}

function meterFor(limit: number): Meter {
  let spent = 0;
  return {
    affordable: (units) => spent + units <= limit,
    charge(units) {
      spent += units;
    },
  };
}

/** Termos do dicionário que aparecem no texto, na ordem da primeira aparição, com a contagem de casamentos. */
export function findTerms(text: unknown, dict: CompiledDictionary): TermHit[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const meter = meterFor(text.length * STEPS_PER_CHAR);

  // 1. Troca das formas protegidas: uma passada sobre a entrada inteira.
  const protectedText = protectText(text, dict.protect);
  meter.charge(text.length);

  const counts = new Map<number, number>();
  const order: number[] = [];
  const contextSeen = new Set<number>();
  const words: string[] = [];
  let next = 0; // primeira palavra ainda não consultada
  let consumedUntil = 0;
  let exhausted = false;

  // 3. Consulta das janelas que começam na palavra `i`, da mais longa para a mais curta. Devolve false sem cobrar
  //    quando o orçamento não cabe mais consultas.
  const consultAt = (i: number): boolean => {
    let found = -1;
    let foundLength = 0;
    for (let n = Math.min(MAX_PHRASE_TOKENS, words.length - i); n >= 1; n--) {
      if (!meter.affordable(1)) return false;
      meter.charge(1);
      const entry = dict.phrases.get(n === 1 ? (words[i] ?? '') : words.slice(i, i + n).join(' '));
      if (entry === undefined) continue;
      if (!meter.affordable(entry.contextOf.length)) return false;
      meter.charge(entry.contextOf.length);
      // O contexto declarado vale em qualquer janela do texto, inclusive dentro de um termo já casado.
      for (const term of entry.contextOf) contextSeen.add(term);
      if (found < 0 && entry.term >= 0) {
        found = entry.term;
        foundLength = n;
      }
    }
    // Casamento não sobreposto e guloso: o termo mais longo que começa nesta palavra vence.
    if (found >= 0 && i >= consumedUntil) {
      const previous = counts.get(found);
      if (previous === undefined) {
        order.push(found);
        counts.set(found, 1);
      } else {
        counts.set(found, previous + 1);
      }
      consumedUntil = i + foundLength;
    }
    return true;
  };

  // Consulta as palavras já normalizadas. Fora do fim do texto, só as que têm as três seguintes disponíveis, para que
  // cada janela seja a mesma de quando o texto inteiro está pronto.
  const drain = (atEnd: boolean): void => {
    while (!exhausted && next < words.length && (atEnd || words.length - next >= MAX_PHRASE_TOKENS)) {
      if (!consultAt(next)) exhausted = true;
      next++;
    }
  };

  // 2. Trechos: a leitura de cada trecho é cobrada antes de ele entrar no lote; o lote (até BATCH_CHARS, fechado numa
  //    quebra de espaço) é normalizado de uma vez e só então cobrado (saída da normalização e divisão). Um lote que não
  //    cabe no orçamento não é normalizado, e a busca para nele.
  let batch = '';
  const flush = (): boolean => {
    if (batch === '') return true;
    const normalized = normalize(batch);
    batch = '';
    if (!meter.affordable(2 * normalized.length)) return false;
    meter.charge(2 * normalized.length);
    if (normalized.length > 0) {
      for (const word of normalized.split(' ')) words.push(word);
    }
    drain(false);
    return !exhausted;
  };
  let alive = true;
  for (const piece of protectedText.match(PIECE) ?? []) {
    if (!meter.affordable(piece.length)) {
      alive = false;
      break;
    }
    meter.charge(piece.length);
    batch += piece;
    if (batch.length >= BATCH_CHARS && SPACES.test(piece) && !flush()) {
      alive = false;
      break;
    }
  }
  if (alive) flush();
  drain(true);

  const hits: TermHit[] = [];
  for (const index of order) {
    const term = dict.terms[index];
    if (term === undefined) continue;
    if (term.requires.length > 0 && !contextSeen.has(index)) continue;
    hits.push({ canonical: term.canonical, category: term.category, count: counts.get(index) ?? 0 });
  }
  return hits;
}
