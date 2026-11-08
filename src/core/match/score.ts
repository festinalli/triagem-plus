// A nota (RF-50 a RF-55), como no Apêndice A da especificação. Trabalha só com a ficha e os requisitos: nada do perfil chega
// aqui, então o que não está na lista fechada de seções não tem como mudar a conta (P-5, DP-03).
//
// A conta é feita em frações exatas, com inteiros de tamanho livre. Com número de ponto flutuante, 3 × 0,6 dá
// 1,7999999999999998, e uma nota de 72,5 viraria 72. Em fração, 72,5 é 72,5 e vai para 73, sempre.
//
// Sem requisito avaliável, a nota é 0, a faixa é Fraco e requiredTotal é 0. Não é um julgamento da pessoa: isScored diz que
// não há nota, e a tela mostra isso no lugar do número (Apêndice A).
import type {
  Band,
  CardTerm,
  Evidence,
  Importance,
  MatchResult,
  ProfileCard,
  ProfileSection,
  Requirement,
  RequirementResult,
  ResultNote,
} from '../model.ts';
import { lookupOf } from './lookup.ts';

const WEIGHT: Readonly<Record<Importance, number>> = { required: 3, preferred: 1 };

/** Crédito 1: o termo está numa seção que prova uso. Sobre e Projetos só citam (Apêndice A). */
const PROOF_SECTIONS: ReadonlySet<ProfileSection> = new Set<ProfileSection>(['experience', 'skills', 'certifications', 'languages']);

const STRONG_FROM = 75;
const WEAK_BELOW = 50;
const MONTHS_PER_YEAR = 12;
/** Anos mínimos podem vir quebrados (2,5). A escala faz deles um inteiro. */
const YEARS_SCALE = 1000;

interface Fraction {
  readonly num: bigint;
  readonly den: bigint;
}

const NO_CREDIT: Fraction = { num: 0n, den: 1n };
const HALF_CREDIT: Fraction = { num: 1n, den: 2n };
const FULL_CREDIT: Fraction = { num: 1n, den: 1n };

/** A ÷ N, no máximo 1. */
function creditForYears(months: number, minYears: number): Fraction {
  const num = BigInt(Math.round(months * YEARS_SCALE));
  const den = BigInt(Math.round(minYears * MONTHS_PER_YEAR * YEARS_SCALE));
  return num >= den ? FULL_CREDIT : { num, den };
}

function hasMinimum(minYears: number | undefined): minYears is number {
  return typeof minYears === 'number' && Number.isFinite(minYears) && minYears > 0;
}

/** `fraction` nulo: o requisito não entra na conta. */
interface Evaluation {
  readonly result: RequirementResult;
  readonly fraction: Fraction | null;
}

function scored(requirement: Requirement, fraction: Fraction, evidence: readonly Evidence[], note?: ResultNote): Evaluation {
  const credit = Number(fraction.num) / Number(fraction.den);
  const status = credit >= 1 ? 'met' : credit > 0 ? 'partial' : 'not_found';
  const result: RequirementResult = { requirementId: requirement.id, status, credit, evidence, ...(note === undefined ? {} : { note }) };
  return { result, fraction };
}

function evidenceOf(term: CardTerm, label: string): Evidence[] {
  return term.sections.map((section) =>
    section === 'experience'
      ? { section, term: label, jobTitles: term.jobTitles, months: term.months }
      : { section, term: label, jobTitles: [], months: null });
}

function evaluateTotal(requirement: Requirement, card: ProfileCard): Evaluation {
  if (card.totalMonths === null) return scored(requirement, NO_CREDIT, [], 'check_profile');
  const evidence: Evidence[] = [{ section: 'experience', term: requirement.label, jobTitles: [], months: card.totalMonths }];
  const credit = hasMinimum(requirement.minYears) ? creditForYears(card.totalMonths, requirement.minYears) : FULL_CREDIT;
  return scored(requirement, credit, evidence);
}

function evaluate(
  requirement: Requirement,
  card: ProfileCard,
  terms: ReadonlyMap<string, CardTerm>,
  searched: ReadonlySet<string>,
): Evaluation {
  const lookup = lookupOf(requirement);
  if (lookup.kind === 'total') return evaluateTotal(requirement, card);

  if (lookup.kind !== 'listed' && !searched.has(lookup.key)) {
    return { result: { requirementId: requirement.id, status: 'needs_reanalysis', credit: 0, evidence: [] }, fraction: null };
  }

  const term = terms.get(lookup.key);
  if (term === undefined) return scored(requirement, NO_CREDIT, []);

  const evidence = evidenceOf(term, lookup.kind === 'listed' ? lookup.key : requirement.label);
  if (requirement.kind === 'term' && hasMinimum(requirement.minYears)) {
    if (term.months === null) return scored(requirement, HALF_CREDIT, evidence, 'time_not_measurable');
    return scored(requirement, creditForYears(term.months, requirement.minYears), evidence);
  }
  return term.sections.some((section) => PROOF_SECTIONS.has(section))
    ? scored(requirement, FULL_CREDIT, evidence)
    : scored(requirement, HALF_CREDIT, evidence, 'mentioned_only');
}

/**
 * A pré-nota (RF-39, DP-27). O que a lista mostrou conta inteiro. O que ela não mostrou conta zero, para quem mostra mais subir
 * na lista, e o aviso diz que falta conferir. Tempo total e termo livre nem têm como aparecer nela, então ficam fora da conta.
 * O tempo de um termo também não aparece: o termo conta inteiro, e a observação diz que o tempo fica a conferir no perfil.
 */
function evaluateListing(requirement: Requirement, terms: ReadonlyMap<string, CardTerm>, searched: ReadonlySet<string>): Evaluation {
  const lookup = lookupOf(requirement);
  if (lookup.kind === 'total' || (lookup.kind !== 'listed' && !searched.has(lookup.key))) {
    return { result: { requirementId: requirement.id, status: 'needs_reanalysis', credit: 0, evidence: [], note: 'not_in_listing' }, fraction: null };
  }
  const term = terms.get(lookup.key);
  if (term === undefined) return scored(requirement, NO_CREDIT, [], 'not_in_listing');
  const evidence = evidenceOf(term, lookup.kind === 'listed' ? lookup.key : requirement.label);
  return requirement.kind === 'term' && hasMinimum(requirement.minYears)
    ? scored(requirement, FULL_CREDIT, evidence, 'time_not_measurable')
    : scored(requirement, FULL_CREDIT, evidence);
}

/** 100 × soma(peso × crédito) ÷ soma(pesos), com meio para cima. */
function roundedScore(items: ReadonlyArray<{ readonly weight: number; readonly fraction: Fraction }>): number {
  let num = 0n;
  let den = 1n;
  let weights = 0n;
  for (const { weight, fraction } of items) {
    const w = BigInt(weight);
    num = num * fraction.den + w * fraction.num * den;
    den *= fraction.den;
    weights += w;
  }
  if (weights === 0n) return 0;
  return Number((200n * num + weights * den) / (2n * weights * den));
}

/** Requisito obrigatório pendente tira de Forte: ele não pesa contra a pessoa, mas também não foi atendido (Apêndice A). */
function bandOf(score: number, allRequiredMet: boolean, requiredPending: boolean): Band {
  if (score >= STRONG_FROM && allRequiredMet && !requiredPending) return 'strong';
  return score < WEAK_BELOW ? 'weak' : 'partial';
}

/** A pessoa só foi vista na página de resultados: o número é pré-nota, sem faixa (RF-39). */
export function isListingOnly(card: Pick<ProfileCard, 'sectionsRead'>): boolean {
  return card.sectionsRead.length > 0 && card.sectionsRead.every((section) => section === 'listing');
}

/** Falso quando nenhum requisito foi avaliado: a nota 0 não quer dizer nada, e a tela diz "sem nota". */
export function isScored(match: MatchResult): boolean {
  return match.results.some((result) => result.status !== 'needs_reanalysis');
}

/**
 * Calcula a nota pela ficha. Requisito que precisa de nova análise (RF-55) aparece nos resultados, mas fica fora do
 * numerador, do denominador e de requiredTotal: não pesa contra a pessoa nem a favor dela.
 */
export function computeMatch(card: ProfileCard, requirements: readonly Requirement[]): MatchResult {
  const terms = new Map(card.terms.map((term) => [term.key, term]));
  const searched = new Set(card.searchedFreeTerms);

  const listingOnly = isListingOnly(card);
  const evaluated = requirements.map((requirement) => ({
    requirement,
    ...(listingOnly ? evaluateListing(requirement, terms, searched) : evaluate(requirement, card, terms, searched)),
  }));
  const counted = evaluated.flatMap(({ requirement, fraction }) => (fraction === null ? [] : [{ requirement, fraction }]));
  const required = counted.filter(({ requirement }) => requirement.importance === 'required');
  const requiredPending = evaluated.some(({ requirement, fraction }) => fraction === null && requirement.importance === 'required');
  const requiredMet = required.filter(({ fraction }) => fraction.num >= fraction.den).length;

  const score = roundedScore(counted.map(({ requirement, fraction }) => ({ weight: WEIGHT[requirement.importance], fraction })));
  return {
    score,
    // Pré-nota não tem faixa. O campo fica neutro, e a tela e o relatório escrevem "Pré-nota" no lugar.
    band: listingOnly ? 'partial' : bandOf(score, requiredMet === required.length, requiredPending),
    results: evaluated.map(({ result }) => result),
    requiredMet,
    requiredTotal: required.length,
  };
}
