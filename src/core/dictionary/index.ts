// Ponto de entrada do dicionário de termos de tecnologia (RF-12, CA-04). Puro: sem Chrome, DOM, relógio nem rede.
import { compileDictionary, keyOf } from './compile.ts';
import { findTerms as findTermsIn } from './find.ts';
import { CERTIFICATIONS, SKILLS } from './data/skills.ts';
import { NOISE } from './data/curated.ts';
import { TECHNOLOGY } from './data/technology.ts';
import { TOOLS } from './data/tools.ts';
import { LANGUAGES, ROLES } from './data/people.ts';
import { impliedTerms } from './implied.ts';
import type { CompiledDictionary, CuratedTerm, TermCategory, TermHit } from './types.ts';

export const DICTIONARY_TERMS: readonly CuratedTerm[] = Object.freeze([
  ...TECHNOLOGY,
  ...TOOLS,
  ...SKILLS,
  ...CERTIFICATIONS,
  ...LANGUAGES,
  ...ROLES,
]);

/** Dicionário embutido, já compilado. */
export const DEV_DICTIONARY: CompiledDictionary = compileDictionary({ terms: DICTIONARY_TERMS, noise: NOISE });

/** Nome mais longo aceito ao consultar um termo isolado (mesmo teto das frases do dicionário). */
const MAX_LOOKUP_CHARS = 80;

/**
 * Termos do dicionário que aparecem no texto, na ordem da primeira aparição, com `canonical`, `category` e a contagem.
 * Termo ambíguo (Go, R, C, Swift...) só conta com contexto de tecnologia no mesmo texto (ver data/technology.ts).
 * Devolve também os termos implícitos (ASP.NET traz .NET; SQL Server traz SQL), logo depois de quem os implica, com a soma
 * das contagens de quem os implica. Quem já foi citado por extenso mantém a própria contagem.
 */
export function findTerms(text: string, dict: CompiledDictionary = DEV_DICTIONARY): TermHit[] {
  return addImplied(findTermsIn(text, dict), dict);
}

/** Implícitos de um canônico, de forma transitiva, sem repetição e sem ele mesmo. */
function impliedClosure(canonical: string): string[] {
  const out: string[] = [];
  const pending = [...impliedTerms(canonical)];
  while (pending.length > 0) {
    const next = pending.shift() as string;
    if (next === canonical || out.includes(next)) continue;
    out.push(next);
    pending.push(...impliedTerms(next));
  }
  return out;
}

function addImplied(hits: TermHit[], dict: CompiledDictionary): TermHit[] {
  if (hits.length === 0) return hits;
  const explicit = new Set(hits.map((hit) => hit.canonical));
  const counts = new Map<string, number>();
  for (const hit of hits) {
    for (const name of impliedClosure(hit.canonical)) {
      if (!explicit.has(name)) counts.set(name, (counts.get(name) ?? 0) + hit.count);
    }
  }
  if (counts.size === 0) return hits;
  const out: TermHit[] = [];
  const emitted = new Set<string>();
  for (const hit of hits) {
    out.push(hit);
    for (const name of impliedClosure(hit.canonical)) {
      const count = counts.get(name);
      if (count === undefined || emitted.has(name)) continue;
      const term = dict.terms.find((t) => t.canonical === name);
      if (term === undefined) continue;
      emitted.add(name);
      out.push({ canonical: term.canonical, category: term.category, count });
    }
  }
  return out;
}

function lookup(text: string, dict: CompiledDictionary): number {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_LOOKUP_CHARS) return -1;
  return dict.phrases.get(keyOf(text, dict.protect))?.term ?? -1;
}

/**
 * Consulta de um termo digitado (não de um texto): "Postgres", "K8s", "Go". Aqui não há contexto a exigir, porque a
 * pessoa disse que é o termo. Devolve o nome canônico ou null.
 */
export function canonicalOf(text: string, dict: CompiledDictionary = DEV_DICTIONARY): string | null {
  const index = lookup(text, dict);
  return index < 0 ? null : (dict.terms[index]?.canonical ?? null);
}

/** Categoria do termo (por canônico ou sinônimo), ou null se não é da lista. */
export function categoryOf(text: string, dict: CompiledDictionary = DEV_DICTIONARY): TermCategory | null {
  const index = lookup(text, dict);
  return index < 0 ? null : (dict.terms[index]?.category ?? null);
}

/** Verdadeiro se o texto digitado é um termo da lista (canônico ou sinônimo); falso é texto livre. */
export function isKnownTerm(text: string, dict: CompiledDictionary = DEV_DICTIONARY): boolean {
  return lookup(text, dict) >= 0;
}

/**
 * Todos os nomes do termo, com o canônico primeiro, como escritos no dicionário (para a busca). Aceita o canônico ou
 * qualquer sinônimo. Termo desconhecido devolve lista vazia.
 */
export function synonymsOf(text: string, dict: CompiledDictionary = DEV_DICTIONARY): string[] {
  const index = lookup(text, dict);
  return index < 0 ? [] : [...(dict.terms[index]?.names ?? [])];
}

export { compileDictionary } from './compile.ts';
export { STEPS_PER_CHAR } from './find.ts';
export { classifyHeading, classifyItem, isHeadingLine, splitRequirementBlocks } from './blocks.ts';
export type { RequirementBlock, RequirementItem } from './blocks.ts';
export { TERM_CATEGORIES } from './types.ts';
export type { CompiledDictionary, CuratedTerm, Dictionary, RequirementClass, TermCategory, TermHit } from './types.ts';
export { impliedTerms } from './implied.ts';
