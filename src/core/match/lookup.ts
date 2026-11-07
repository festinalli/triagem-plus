// Como um requisito é procurado na ficha. Ficha e nota têm de concordar nisto, ou a nota procuraria uma chave que a ficha
// não usa.
import { keyOf } from '../dictionary/compile.ts';
import { DEV_DICTIONARY, canonicalOf } from '../dictionary/index.ts';
import type { Requirement } from '../model.ts';
import { normalize } from '../text/normalize.ts';
import { foldRoleWords, foldTitleWords } from './gender.ts';

export const TITLE_KEY_PREFIX = 'title:';

/**
 * listed: termo da lista, sempre avaliado, porque a ficha guarda todos os reconhecidos.
 * free: texto livre, procurado só quando a análise conhecia o requisito (RF-55), e nunca em Sobre (DP-25).
 * title: palavra de cargo, idem.
 * total: experiência total, que não é termo.
 *
 * Chave vazia é requisito sem nenhuma palavra ("++"). Nunca entra em `searchedFreeTerms`, então fica sem avaliar e não pesa.
 */
export type Lookup =
  | { readonly kind: 'listed'; readonly key: string }
  | { readonly kind: 'free'; readonly key: string }
  | { readonly kind: 'title'; readonly key: string }
  | { readonly kind: 'total' };

/** O texto que o requisito procura. */
export function searchTextOf(requirement: Requirement): string {
  return requirement.canonical ?? requirement.label;
}

export function lookupOf(requirement: Requirement): Lookup {
  if (requirement.kind === 'total_experience') return { kind: 'total' };
  const key = normalize(searchTextOf(requirement));
  if (requirement.kind === 'title_word') return { kind: 'title', key: key === '' ? '' : TITLE_KEY_PREFIX + key };
  // Canônico que a lista não conhece mais, como depois de mudar o dicionário, volta a ser texto: procurar é mais justo
  // do que dar "não encontrado" para sempre.
  const listed = requirement.canonical === undefined ? null : canonicalOf(requirement.canonical);
  return listed === null ? { kind: 'free', key } : { kind: 'listed', key: listed };
}

/**
 * Forma de comparação de uma sequência de palavras. Usa as formas protegidas do dicionário, para "C" não casar com
 * "C++" nem "go" com "go to market".
 */
export function phraseKey(text: string): string {
  return keyOf(foldRoleWords(text), DEV_DICTIONARY.protect);
}

// Palavras que nenhum requisito tem. Uma passada só sobre tudo custa bem menos do que uma por linha ou por texto.
const LINE_MARK = 'fimdelinha0marca';
const TEXT_MARK = 'fimdetexto0marca';

/** Textos prontos para procurar, na mesma ordem. Uma sequência não atravessa o fim da linha nem o do texto. */
export function haystacksOf(texts: readonly string[]): string[] {
  const joined = texts.map((text) => text.replaceAll('\n', ` ${LINE_MARK} `)).join(` ${TEXT_MARK} `);
  return phraseKey(joined).split(TEXT_MARK).map((haystack) => ` ${haystack.trim()} `);
}

/** Forma de comparação de uma palavra de cargo: com a regra de sufixo, que só vale aqui. */
export function titlePhraseKey(text: string): string {
  return phraseKey(foldTitleWords(text));
}

/** Linhas de cargo prontas para procurar uma palavra de cargo, na mesma ordem. */
export function titleHaystacksOf(titles: readonly string[]): string[] {
  return haystacksOf(titles.map(foldTitleWords));
}

export function hasPhrase(haystack: string, phrase: string): boolean {
  return phrase !== '' && haystack.includes(` ${phrase} `);
}
