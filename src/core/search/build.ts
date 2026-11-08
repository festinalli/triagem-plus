// O texto de busca (RF-20, RF-21). Só monta o texto e o endereço. Nunca abre nada nem lê página nenhuma (RF-23).
//
// A trava vale aqui também (RF-13): termo excluído proibido e requisito proibido guardado de antes não saem no texto, e a resposta
// devolve o que ficou de fora e por quê.
import { keyOf } from '../dictionary/compile.ts';
import { canonicalOf, categoryOf, DEV_DICTIONARY, synonymsOf } from '../dictionary/index.ts';
import { checkTerm, MAX_TERM_CHARS } from '../guard/index.ts';
import type { ForbiddenTopic } from '../guard/index.ts';
import type { Requirement, RequirementKind } from '../model.ts';
import { masculineRole, roleForms, startsWithRoleWord } from './role-gender.ts';

const MAX_SHORT_TERMS = 3;
const SEARCH_URL = 'https://www.linkedin.com/search/results/people/?keywords=';

/** Limite de operadores por plano. Nulo em `free`: o LinkedIn não publica. Nulo em `recruiter`: não há limite. */
export const OPERATOR_LIMITS = Object.freeze({ free: null, salesNavigator: 15, recruiter: null } as const);

const SEARCHABLE_KINDS: ReadonlySet<RequirementKind> = new Set<RequirementKind>(['term', 'language', 'certification', 'title_word']);
const QUOTES = /["“”„‟«»＂〝〞〟]/gu;
// Metade de um par de substitutos. O encodeURIComponent lança URIError com isso, e o par inteiro (um emoji) não casa aqui.
const LONE_SURROGATE = /\p{Cs}/gu;
const SPACES = /[\s\u0085]+/gu;
// Caractere de controle e invisível não ajudam a achar ninguém. A contrabarra podia escapar a aspa que fecha o termo.
const UNPRINTABLE = /[\p{Cc}\p{Cf}\\]/gu;

const REASON_TOO_LONG = `Termo com mais de ${MAX_TERM_CHARS} caracteres não entra na busca. Escreva só o termo.`;
const REASON_SAME_AS_REQUIRED = 'Este termo também está nos requisitos: procurar e excluir o mesmo termo não acha ninguém, então ele ficou fora do NOT.';

export interface SearchText {
  readonly text: string;
  /** Quantos AND, OR e NOT o texto usa. */
  readonly operators: number;
}

export type RefusalCode = 'forbidden' | 'too_long' | 'same_as_required';

/** Termo que ficou fora do texto, para a tela explicar. */
export interface RefusedTerm {
  readonly term: string;
  readonly code: RefusalCode;
  readonly topic?: ForbiddenTopic;
  readonly reason: string;
}

export interface BuiltSearch {
  readonly full: SearchText;
  readonly short: SearchText;
  /** Excluídos que não entraram no NOT: proibidos, longos demais ou iguais a um termo procurado. */
  readonly refusedExcluded: readonly RefusedTerm[];
  /** Requisitos obrigatórios que não entraram no texto: proibidos, guardados de antes da trava, ou longos demais. */
  readonly refusedRequirements: readonly RefusedTerm[];
}

export interface BuildSearchInput {
  readonly requirements: readonly Requirement[];
  readonly excludedTerms: readonly string[];
}

/** Um requisito no texto: as formas do nome (duas, se o cargo muda com o gênero) e o tipo. */
interface Group {
  readonly forms: readonly string[];
  readonly kind: RequirementKind;
  readonly head: string;
}

function clean(term: unknown): string {
  if (typeof term !== 'string') return '';
  return term.replace(LONE_SURROGATE, '').replace(QUOTES, '').replace(SPACES, ' ').replace(UNPRINTABLE, '').trim();
}

function quoted(term: string): string {
  return `"${term}"`;
}

/** Forma comparável que separa "C" de "C++" e de "C#", que `normalize` deixaria iguais. */
function identityOf(term: string): string {
  return keyOf(term, DEV_DICTIONARY.protect);
}

/** Recusa de um termo para a tela, ou null se ele pode ir para o texto. */
function refusalOf(term: string): RefusedTerm | null {
  if (term.length > MAX_TERM_CHARS) return { term: term.slice(0, MAX_TERM_CHARS), code: 'too_long', reason: REASON_TOO_LONG };
  const check = checkTerm(term);
  return check.allowed ? null : { term, code: 'forbidden', topic: check.topic, reason: check.reason };
}

function isRole(head: string, requirement: Requirement): boolean {
  if (requirement.kind === 'title_word' || categoryOf(head) === 'role') return true;
  return requirement.kind === 'term' && requirement.canonical === undefined && startsWithRoleWord(head);
}

/** O que entra no texto, na ordem da vaga e sem repetir, e os requisitos que ficaram de fora. */
function groupsOf(requirements: readonly Requirement[]): { groups: Group[]; refused: RefusedTerm[] } {
  const seen = new Set<string>();
  const groups: Group[] = [];
  const refused: RefusedTerm[] = [];
  for (const requirement of requirements) {
    const head = clean(requirement.canonical ?? requirement.label);
    if (head.length <= MAX_TERM_CHARS && identityOf(head) === '') continue;
    const refusal = refusalOf(head);
    if (refusal !== null) {
      refused.push(refusal);
      continue;
    }
    const role = isRole(head, requirement);
    const identity = identityOf(role ? masculineRole(head) : head);
    if (seen.has(identity)) continue;
    seen.add(identity);
    groups.push({ head, kind: requirement.kind, forms: role ? roleForms(head) : [head] });
  }
  return { groups, refused };
}

function alternatives(names: readonly string[]): string {
  return names.length === 1 ? quoted(names[0] ?? '') : `(${names.map(quoted).join(' OR ')})`;
}

/** Tudo o que os grupos procuram. Um excluído igual a isso anularia a busca inteira. */
function searchedNames(groups: readonly Group[]): ReadonlySet<string> {
  const names = new Set<string>();
  for (const group of groups) {
    for (const name of [group.head, ...group.forms, ...synonymsOf(group.head)]) names.add(identityOf(clean(name)));
  }
  return names;
}

function excludedOf(excludedTerms: readonly unknown[], groups: readonly Group[]): { kept: Map<string, string>; refused: RefusedTerm[] } {
  const searched = searchedNames(groups);
  const kept = new Map<string, string>();
  const refused: RefusedTerm[] = [];
  const seen = new Set<string>();
  for (const raw of excludedTerms) {
    const term = clean(raw);
    if (term.length > MAX_TERM_CHARS) {
      refused.push({ term: term.slice(0, MAX_TERM_CHARS), code: 'too_long', reason: REASON_TOO_LONG });
      continue;
    }
    const identity = identityOf(term);
    if (identity === '' || seen.has(identity)) continue;
    seen.add(identity);
    const refusal = refusalOf(term);
    if (refusal !== null) {
      refused.push(refusal);
    } else if (searched.has(identity) || searched.has(identityOf(canonicalOf(term) ?? term)) || searched.has(identityOf(masculineRole(term)))) {
      refused.push({ term, code: 'same_as_required', reason: REASON_SAME_AS_REQUIRED });
    } else {
      kept.set(identity, term);
    }
  }
  return { kept, refused };
}

/** Os grupos ligados por AND. OR só nas duas formas de gênero de um cargo (RD-8). */
function positiveSearch(groups: readonly Group[]): SearchText {
  const operators = Math.max(groups.length - 1, 0) + groups.reduce((sum, group) => sum + group.forms.length - 1, 0);
  return { text: groups.map((group) => alternatives(group.forms)).join(' AND '), operators };
}

function fullSearch(groups: readonly Group[], excluded: ReadonlyMap<string, string>): SearchText {
  // NOT sozinho pode falhar no LinkedIn: sem nenhum termo positivo, o texto fica vazio (RF-20).
  if (groups.length === 0) return { text: '', operators: 0 };
  const positive = positiveSearch(groups);
  return {
    text: [positive.text, ...[...excluded.values()].map((term) => `NOT ${quoted(term)}`)].join(' '),
    operators: positive.operators + excluded.size,
  };
}

/** Até 3 obrigatórios e sem excluídos: é a versão que acha mais gente. */
function shortSearch(groups: readonly Group[]): SearchText {
  const terms = groups.filter((group) => group.kind === 'term');
  return positiveSearch((terms.length > 0 ? terms : groups).slice(0, MAX_SHORT_TERMS));
}

/**
 * Obrigatórios por AND e excluídos por NOT. Desejáveis e experiência total não entram (RF-20). Sinônimos não entram no texto:
 * a busca longa volta sem resultados no LinkedIn (DP-30). Eles continuam valendo na nota.
 */
export function buildSearch(input: BuildSearchInput): BuiltSearch {
  const requirements = Array.isArray(input?.requirements) ? input.requirements : [];
  const excludedTerms = Array.isArray(input?.excludedTerms) ? input.excludedTerms : [];
  const searchable = requirements.filter((requirement) => requirement?.importance === 'required' && SEARCHABLE_KINDS.has(requirement.kind));
  const { groups, refused: refusedRequirements } = groupsOf(searchable);
  const { kept, refused: refusedExcluded } = excludedOf(excludedTerms, groups);
  return { full: fullSearch(groups, kept), short: shortSearch(groups), refusedExcluded, refusedRequirements };
}

/** O endereço da busca de pessoas. Só monta: quem abre é a pessoa, por clique (RF-22). */
export function peopleSearchUrl(text: string): string {
  return `${SEARCH_URL}${typeof text === 'string' ? encodeURIComponent(text.replace(LONE_SURROGATE, '')) : ''}`;
}
