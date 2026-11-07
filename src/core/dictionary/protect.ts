// Formas protegidas, passo 1 da busca: c++, c#, f#, .net, asp.net, node.js, next.js, ci/cd e as demais declaradas nos
// termos, mais as frases de ruído (r$, go to market). Antes de normalizar, cada forma acha-se no texto e é trocada por
// um símbolo próprio, só de letras (a normalização mantém letras), cercado de espaços: o símbolo é sempre uma palavra
// isolada, mesmo colado a letra ou dígito vizinho (`C++17`, `VB.NET`). Assim `c++` não vira `c`, e `.net` não vira `net`.
import type { ProtectedForm, ProtectTable } from './types.ts';

/** Prefixo dos símbolos. Um texto que contenha este prefixo seguido de letras é lido como símbolo (risco aceito:
 * nenhuma palavra real do português ou do inglês tem essa forma). */
export const SYMBOL_PREFIX = 'zqxw';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Símbolo da forma de índice `index` (base 26 em letras, sem número: `zqxwa`, `zqxwb`, ..., `zqxwaa`). */
export function symbolFor(index: number): string {
  let n = index;
  let letters = '';
  do {
    letters = LETTERS[n % 26] + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return SYMBOL_PREFIX + letters;
}

/** Chave de uma forma ou de um trecho achado: minúsculas, sem acento, espaço, hífen e sublinhado iguais, apóstrofo reto. */
function canonicalForm(form: string): string {
  return form
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s\-‐‑_]+/gu, ' ')
    .replace(/[’‘`]/gu, "'")
    .trim();
}

/** Formas em minúsculas, sem repetição, da mais longa para a mais curta (com desempate alfabético): a ordem é fixa. */
export function buildProtectedForms(forms: readonly string[]): ProtectedForm[] {
  const byKey = new Map<string, string>();
  for (const raw of forms) {
    const form = raw.trim().toLowerCase().replace(/\s+/gu, ' ');
    if (form.length > 0 && !byKey.has(canonicalForm(form))) byKey.set(canonicalForm(form), form);
  }
  const unique = [...byKey.values()];
  unique.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  return unique.map((form, index) => ({ form, symbol: symbolFor(index) }));
}

const ACCENTED: Readonly<Record<string, string>> = {
  a: 'aàáâãäå',
  e: 'eèéêë',
  i: 'iìíîï',
  o: 'oòóôõö',
  u: 'uùúûü',
  c: 'cç',
  n: 'nñ',
};

/**
 * Trecho da expressão para uma forma: o texto real pode trazer acento onde a forma não tem (`codigo` casa `código`),
 * hífen, sublinhado ou espaço no lugar do espaço ou do hífen da forma (`go live`, `go-live`) e apóstrofo curvo (`let's`).
 */
function formPattern(form: string): string {
  let out = '';
  for (const ch of form) {
    const accents = ACCENTED[ch];
    if (accents !== undefined) out += `[${accents}]\\p{M}*`;
    else if (ch === ' ' || ch === '-') out += '[\\s\\-‐‑_]+';
    else if (ch === "'") out += "['’‘`]";
    else out += ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  }
  return out;
}

const LETTER = /\p{L}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Uma única expressão para todas as formas. Limites de palavra, só nas bordas que têm letra ou dígito:
 *   - forma que começa com letra ou dígito não pode ter letra ou dígito colado antes (`abc++` não é `c++`);
 *   - forma que termina com letra não pode ter letra colada depois, mas aceita dígito (`.NET8`, `node.js12`);
 *   - forma que termina com dígito não pode ter letra ou dígito colado depois.
 * Formas que começam com `.` (`.net`) não têm limite à esquerda (`VB.NET`). Espaço ou hífen dentro da forma casa com qualquer
 * sequência de espaços, hífens e sublinhados, e uma letra sem acento casa também a acentuada. A alternância é ordenada da mais longa.
 */
export function buildProtectTable(forms: readonly ProtectedForm[]): ProtectTable {
  if (forms.length === 0) return { re: null, symbols: new Map() };
  const alternatives = forms.map(({ form }) => {
    const first = form.charAt(0);
    const last = form.charAt(form.length - 1);
    const before = LETTER_OR_DIGIT.test(first) ? '(?<![\\p{L}\\p{N}])' : '';
    const after = LETTER.test(last) ? '(?!\\p{L})' : LETTER_OR_DIGIT.test(last) ? '(?![\\p{L}\\p{N}])' : '';
    return `${before}${formPattern(form)}${after}`;
  });
  const symbols = new Map(forms.map(({ form, symbol }) => [canonicalForm(form), symbol] as const));
  return { re: new RegExp(`(?:${alternatives.join('|')})`, 'giu'), symbols };
}

/** Troca as formas protegidas do texto pelos símbolos, cada um cercado de espaços. Uma passada; texto sem formas volta igual. */
export function protectText(text: string, table: ProtectTable): string {
  if (table.re === null) return text;
  return text.replace(table.re, (match) => {
    const symbol = table.symbols.get(canonicalForm(match));
    return symbol === undefined ? match : ` ${symbol} `;
  });
}
