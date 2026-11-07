// Tipos do dicionário de termos de tecnologia (RF-12, CA-04). Puro: sem Chrome, DOM nem relógio.

export const TERM_CATEGORIES = ['technology', 'tool', 'skill', 'certification', 'language', 'role'] as const;
export type TermCategory = (typeof TERM_CATEGORIES)[number];

/** Classe de um bloco ou item de requisito de vaga: obrigatório, desejável ou apenas citado. */
export type RequirementClass = 'required' | 'preferred' | 'mentioned';

/**
 * Termo escrito à mão. `protectedForms` são as grafias que a normalização destruiria (`c++`, `.net`).
 * `requires` é o contexto declarado de um termo ambíguo (go, r, swift): o termo só conta num texto que também
 * contenha uma das frases de `requires`. A grafia longa sem ambiguidade (`golang`) entra em `requires`, de modo que
 * ela sozinha já basta.
 */
export interface CuratedTerm {
  readonly canonical: string;
  readonly synonyms: readonly string[];
  readonly category: TermCategory;
  readonly protectedForms: readonly string[];
  readonly requires: readonly string[];
}

/** Dados de entrada da compilação. `noise` são frases comuns que se parecem com um termo ("go to market", "R$"). */
export interface Dictionary {
  readonly terms: readonly CuratedTerm[];
  readonly noise: readonly string[];
}

/** Um termo encontrado num texto: quantas vezes casou, na ordem da primeira aparição. */
export interface TermHit {
  readonly canonical: string;
  readonly category: TermCategory;
  readonly count: number;
}

/** Forma protegida (c++, c#, node.js...) com o símbolo que a substitui antes de normalizar. */
export interface ProtectedForm {
  readonly form: string;
  readonly symbol: string;
}

/** Tabela de troca das formas protegidas: a expressão que as acha e o símbolo de cada uma (chave em minúsculas). */
export interface ProtectTable {
  readonly re: RegExp | null;
  readonly symbols: ReadonlyMap<string, string>;
}

/** O que a busca de frases sabe de cada frase normalizada: o termo que ela designa (-1 se nenhum) e os termos
 * ambíguos cujo contexto declarado ela é. */
export interface PhraseEntry {
  readonly term: number;
  readonly contextOf: readonly number[];
}

export interface CompiledTerm {
  readonly canonical: string;
  readonly category: TermCategory;
  readonly requires: readonly string[];
  /** Canônico, sinônimos e grafias protegidas, como escritos (para a busca). */
  readonly names: readonly string[];
}

export interface CompiledDictionary {
  readonly terms: readonly CompiledTerm[];
  readonly phrases: ReadonlyMap<string, PhraseEntry>;
  readonly protect: ProtectTable;
  /** Entradas que não entraram (longas demais ou em conflito com outro termo). */
  readonly rejected: number;
}
