// Filtros da lista (RF-60): termo de stack, experiência mínima, faixa, etapa, favorito e "atende a todos os obrigatórios".
// Filtro só esconde da tela: quem ficou de fora continua guardado e contado (P-3, CA-12). Puro: sem Chrome e sem DOM.
import type { Band, Candidate, Job, Stage } from '../model.ts';
import { canonicalOf } from '../dictionary/index.ts';
import { BAND_LABELS, STAGE_LABELS } from '../report/model.ts';
import { isScored } from '../match/score.ts';
import { normalize } from '../text/normalize.ts';

export interface CandidateFilters {
  /** Termo de stack, como o leitor o reconhece ("java", "spring boot"). Vazio: sem filtro. */
  readonly term: string;
  /** Anos mínimos de experiência no total. Nulo: sem filtro. */
  readonly minYears: number | null;
  readonly band: Band | 'any';
  readonly stage: Stage | 'any';
  readonly favoriteOnly: boolean;
  readonly allRequired: boolean;
}

export const NO_FILTERS: CandidateFilters = { term: '', minYears: null, band: 'any', stage: 'any', favoriteOnly: false, allRequired: false };

export function filtersActive(filters: CandidateFilters): boolean {
  return filters.term.trim() !== '' || filters.minYears !== null || filters.band !== 'any' || filters.stage !== 'any' || filters.favoriteOnly || filters.allRequired;
}

const MONTHS_PER_YEAR = 12;

/** Chave exata: a do dicionário quando o termo é conhecido (React.js, Golang), senão o texto normalizado. */
function termKeyOf(text: string): string {
  return canonicalOf(text.trim()) ?? normalize(text);
}

function hasTerm(candidate: Candidate, wanted: string): boolean {
  return candidate.card.terms.some((term) => term.key === wanted);
}

/** Atende a todos os obrigatórios: cada requisito obrigatório da vaga está "bateu". Pendente de nova análise não conta como atendido. */
function meetsAllRequired(candidate: Candidate, job: Job): boolean {
  const byId = new Map(candidate.match.results.map((result) => [result.requirementId, result]));
  return job.requirements.filter((requirement) => requirement.importance === 'required').every((requirement) => byId.get(requirement.id)?.status === 'met');
}

export function matchesFilters(candidate: Candidate, job: Job, filters: CandidateFilters): boolean {
  const wanted = termKeyOf(filters.term);
  if (wanted !== '' && !hasTerm(candidate, wanted)) return false;
  if (filters.minYears !== null) {
    const months = candidate.card.totalMonths;
    if (months === null || months < filters.minYears * MONTHS_PER_YEAR) return false;
  }
  if (filters.band !== 'any' && !(isScored(candidate.match) && candidate.match.band === filters.band)) return false;
  if (filters.stage !== 'any' && candidate.stage !== filters.stage) return false;
  if (filters.favoriteOnly && !candidate.favorite) return false;
  if (filters.allRequired && !meetsAllRequired(candidate, job)) return false;
  return true;
}

/** Quem passa pelos filtros, na ordem recebida. */
export function applyFilters(list: readonly Candidate[], job: Job, filters: CandidateFilters): Candidate[] {
  return filtersActive(filters) ? list.filter((candidate) => matchesFilters(candidate, job, filters)) : [...list];
}

/** Os filtros que valem, em frases simples, para o relatório dizer o que foi escondido (RF-71). */
export function describeFilters(filters: CandidateFilters): string[] {
  const out: string[] = [];
  if (filters.term.trim() !== '') out.push(`termo "${filters.term.trim()}"`);
  if (filters.minYears !== null) out.push(`pelo menos ${filters.minYears} ${filters.minYears === 1 ? 'ano' : 'anos'} de experiência`);
  if (filters.band !== 'any') out.push(`faixa ${BAND_LABELS[filters.band]}`);
  if (filters.stage !== 'any') out.push(`etapa ${STAGE_LABELS[filters.stage]}`);
  if (filters.favoriteOnly) out.push('só favoritos');
  if (filters.allRequired) out.push('atende a todos os obrigatórios');
  return out;
}
