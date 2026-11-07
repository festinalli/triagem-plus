// Compilação do dicionário: índice de frases normalizadas e formas protegidas. Puro e determinístico.
import { normalize } from '../text/normalize.ts';
import { buildProtectTable, buildProtectedForms, protectText } from './protect.ts';
import type { CompiledDictionary, CompiledTerm, Dictionary, PhraseEntry, ProtectTable } from './types.ts';

/** Frase de um termo, depois de normalizada, tem no máximo este número de palavras (limite do casamento). */
export const MAX_PHRASE_TOKENS = 4;

function phraseTokens(key: string): number {
  return key.length === 0 ? 0 : key.split(' ').length;
}

/** Chave de busca de um texto: formas protegidas trocadas e depois normalizado. */
export function keyOf(text: string, table: ProtectTable): string {
  return normalize(protectText(text, table));
}

function isUsableKey(key: string): boolean {
  return key.length > 0 && phraseTokens(key) <= MAX_PHRASE_TOKENS;
}

export function compileDictionary(dict: Dictionary): CompiledDictionary {
  let rejected = 0;
  const protectedForms = buildProtectedForms([...dict.terms.flatMap((t) => [...t.protectedForms]), ...dict.noise]);
  const table = buildProtectTable(protectedForms);

  // Frases: cada chave aponta para um termo (ou para nenhum, se só serve de contexto) e para os termos que a pedem.
  const phrases = new Map<string, { term: number; contextOf: number[] }>();
  const claim = (key: string, term: number): void => {
    const entry = phrases.get(key) ?? { term: -1, contextOf: [] };
    if (entry.term >= 0 && entry.term !== term) {
      rejected++;
      return;
    }
    entry.term = term;
    phrases.set(key, entry);
  };

  const terms: CompiledTerm[] = [];
  dict.terms.forEach((t, index) => {
    const names = [...new Set([t.canonical, ...t.synonyms, ...t.protectedForms])];
    const keys = new Set(names.map((v) => keyOf(v, table)));
    for (const key of keys) {
      if (isUsableKey(key)) claim(key, index);
      else rejected++;
    }
    // O contexto passa pela mesma chave que o texto: uma forma protegida (node.js) vira o símbolo, como no texto.
    const requires = [...new Set(t.requires.map((r) => keyOf(r, table)).filter((r) => r.length > 0))];
    for (const phrase of requires) {
      if (!isUsableKey(phrase)) {
        rejected++;
        continue;
      }
      const entry = phrases.get(phrase) ?? { term: -1, contextOf: [] };
      if (!entry.contextOf.includes(index)) entry.contextOf.push(index);
      phrases.set(phrase, entry);
    }
    terms.push(Object.freeze({ canonical: t.canonical, category: t.category, requires: Object.freeze(requires), names: Object.freeze(names) }));
  });

  const frozenPhrases = new Map<string, PhraseEntry>();
  for (const [key, entry] of phrases) {
    frozenPhrases.set(key, Object.freeze({ term: entry.term, contextOf: Object.freeze([...entry.contextOf]) }));
  }
  return Object.freeze({ terms: Object.freeze(terms), phrases: frozenPhrases, protect: table, rejected });
}
