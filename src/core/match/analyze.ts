// Do texto colado ou lido ao resultado: leitor, ficha, nota e aviso de leitura incompleta (RF-34, RF-35, RF-40).
import type { CardTerm, MatchResult, ProfileCard, ProfileSection, Requirement } from '../model.ts';
import { profileKeyOf } from '../profile/merge.ts';
import { parseProfileText } from '../profile/parse.ts';
import type { YearMonth } from '../time/types.ts';
import { buildCard, inSectionOrder, uniqueTitles } from './card.ts';
import { computeMatch } from './score.ts';

/** Sem estas duas, a nota quase certamente sai menor do que deveria (RF-35). */
const ESSENTIAL_SECTIONS: readonly ProfileSection[] = ['experience', 'skills'];

export interface ProfileQuality {
  readonly level: 'ok' | 'few_sections' | 'empty';
  readonly truncated: boolean;
  /** As seções essenciais que não vieram. As outras podem só não existir no perfil, e não geram aviso. */
  readonly missing: readonly ProfileSection[];
}

export interface AnalyzeInput {
  readonly text: string;
  readonly url: string;
  readonly requirements: readonly Requirement[];
  readonly asOf: YearMonth;
}

export interface ProfileAnalysis {
  readonly name: string | null;
  readonly profileKey: string | null;
  readonly card: ProfileCard;
  readonly match: MatchResult;
  readonly quality: ProfileQuality;
}

function qualityOf(sectionsRead: readonly ProfileSection[], truncated: boolean): ProfileQuality {
  const missing = ESSENTIAL_SECTIONS.filter((section) => !sectionsRead.includes(section));
  const level = sectionsRead.length === 0 ? 'empty' : missing.length > 0 ? 'few_sections' : 'ok';
  return { level, truncated, missing };
}

export function analyzeProfile({ text, url, requirements, asOf }: AnalyzeInput): ProfileAnalysis {
  const parsed = parseProfileText(text, asOf);
  const card = buildCard(parsed, requirements);
  return {
    name: parsed.name,
    profileKey: profileKeyOf(url),
    card,
    match: computeMatch(card, requirements),
    quality: qualityOf(card.sectionsRead, card.truncated),
  };
}

function larger(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  return b === null ? a : Math.max(a, b);
}

function mergeTerm(a: CardTerm, b: CardTerm): CardTerm {
  return {
    key: a.key,
    sections: inSectionOrder([...a.sections, ...b.sections]),
    months: larger(a.months, b.months),
    jobTitles: uniqueTitles([...a.jobTitles, ...b.jobTitles]),
  };
}

function sortedUnion(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

/**
 * Termo livre só conta como procurado se foi procurado nas duas análises, ou se foi achado. Uma das leituras pode ser uma página
 * parcial, e o que não foi procurado na leitura completa continua pendente: a soma não pode virar "não encontrado" (RF-55).
 */
function searchedInBoth(
  previous: ProfileCard,
  next: ProfileCard,
  found: ReadonlyMap<string, CardTerm>,
): string[] {
  // A leitura nova cobre tudo o que a anterior leu: o que ela procurou vale para a ficha inteira (RF-55).
  // A lista de resultados nunca procura termo livre, então não conta aqui (RF-39).
  const covers = previous.sectionsRead.every((section) => section === 'listing' || next.sectionsRead.includes(section));
  const inNext = new Set(next.searchedFreeTerms);
  if (covers) return sortedUnion(previous.searchedFreeTerms, next.searchedFreeTerms).filter((key) => inNext.has(key) || found.has(key));
  return searchedInBothParts(previous.searchedFreeTerms, next.searchedFreeTerms, found);
}

function searchedInBothParts(previous: readonly string[], next: readonly string[], found: ReadonlyMap<string, CardTerm>): string[] {
  const inPrevious = new Set(previous);
  const inNext = new Set(next);
  return sortedUnion(previous, next).filter((key) => (inPrevious.has(key) && inNext.has(key)) || found.has(key));
}

/**
 * Soma duas análises do mesmo perfil quando o texto da primeira já saiu da memória (RF-34). O novo vem primeiro nos cargos
 * e no cargo atual, por ser a leitura mais recente. A ficha fica cortada só se as duas leituras estavam cortadas, porque o
 * que uma leitura trouxe inteiro a outra não tira.
 */
export function mergeCards(previous: ProfileCard, next: ProfileCard): ProfileCard {
  const terms = new Map<string, CardTerm>();
  for (const term of [...next.terms, ...previous.terms]) {
    const known = terms.get(term.key);
    terms.set(term.key, known === undefined ? term : mergeTerm(known, term));
  }
  return {
    totalMonths: larger(previous.totalMonths, next.totalMonths),
    currentTitle: next.currentTitle ?? previous.currentTitle,
    terms: sortedUnion([...terms.keys()], []).flatMap((key) => terms.get(key) ?? []),
    searchedFreeTerms: searchedInBoth(previous, next, terms),
    sectionsRead: inSectionOrder([...previous.sectionsRead, ...next.sectionsRead]),
    truncated: previous.truncated && next.truncated,
  };
}
