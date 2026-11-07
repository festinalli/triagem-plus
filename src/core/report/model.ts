// O que vai no relatório (RF-71), já em português simples e sem decisão de layout. PDF e CSV leem este mesmo modelo, então
// os dois trazem o mesmo conteúdo. Puro: sem relógio (o "agora" chega por parâmetro), sem Chrome e sem DOM.
import type { Band, Candidate, Job, RequirementResult, Stage } from '../model.ts';
import { sortCandidates, TOP_SIZE } from '../match/rank.ts';
import { isScored } from '../match/score.ts';

export type ReportScope = 'top10' | 'all';

export interface BuildReportInput {
  readonly job: Job;
  readonly candidates: readonly Candidate[];
  readonly scope: ReportScope;
  readonly includeNotes: boolean;
  /** Milissegundos desde 1970. */
  readonly now: number;
  /** Quantos candidatos a vaga tem ao todo, quando a lista veio filtrada. */
  readonly allCount?: number;
  /** Os filtros que valiam, em frases. Vazio ou ausente: lista sem filtro. */
  readonly filterTexts?: readonly string[];
}

export interface ReportRequirement {
  readonly label: string;
  readonly required: boolean;
  readonly importanceLabel: 'Obrigatório' | 'Desejável';
}

export interface ReportRow {
  readonly position: number;
  readonly name: string;
  readonly link: string;
  /** "85" ou "sem nota". */
  readonly scoreText: string;
  /** Forte, Parcial ou Fraco. Nulo quando não há nota avaliada. */
  readonly bandLabel: string | null;
  readonly band: Band | null;
  readonly met: readonly string[];
  readonly missing: readonly string[];
  /** Requisitos novos, ainda não conferidos no perfil (RF-55). Não pesam na nota e não contam como falta da pessoa. */
  readonly review: readonly string[];
  readonly experience: string;
  readonly currentTitle: string;
  readonly stageLabel: string;
  /** Nulo quando as notas não foram pedidas. Vazio quando foram pedidas e a pessoa não escreveu nada. */
  readonly notes: string | null;
}

export interface ReportModel {
  readonly jobTitle: string;
  readonly generatedAt: number;
  /** DD/MM/AAAA. */
  readonly dateText: string;
  readonly scope: ReportScope;
  readonly scopeText: string;
  /** Os filtros que valiam; vazio quando a lista não foi filtrada. */
  readonly filterTexts: readonly string[];
  readonly includeNotes: boolean;
  readonly totalCandidates: number;
  /** Algum candidato tem requisito a rever. A legenda de "A rever" só entra no arquivo se isto for verdade. */
  readonly hasReview: boolean;
  readonly requirements: readonly ReportRequirement[];
  readonly rows: readonly ReportRow[];
}

export const BAND_LABELS: Readonly<Record<Band, string>> = { strong: 'Forte', partial: 'Parcial', weak: 'Fraco' };

export const STAGE_LABELS: Readonly<Record<Stage, string>> = {
  new: 'Novo',
  reviewing: 'Em análise',
  contacted: 'Contatado',
  interview: 'Entrevista',
  offer: 'Proposta',
  closed: 'Encerrado',
};

export const FOOTER_PHRASE = 'A nota é apoio, e a decisão é sua.';
/** Explica a linha 'A rever': requisito novo, ainda não conferido no perfil. Não é falta da pessoa (RF-55). */
export const REVIEW_NOTICE = 'A rever: requisitos novos, ainda não conferidos no perfil. Eles não pesam na nota.';
export const PERSONAL_DATA_NOTICE =
  'Este arquivo tem dados pessoais. Ele sai do controle da extensão, e quem o recebe também passa a responder por eles.';
/** Explica "Faltou" (RF-50): ausência no texto não é ausência na pessoa. */
export const MISSING_NOTICE = 'Faltou significa que não foi encontrado no texto do perfil; a pessoa pode ter e não ter citado.';

export const NO_SCORE_TEXT = 'sem nota';
export const PARTIAL_SUFFIX = ' (em parte)';

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** O dia no fuso da máquina, que é o dia que a pessoa vê no calendário. Date aqui só converte, não lê o relógio. */
export function dateParts(now: number): { year: number; month: number; day: number } {
  const date = new Date(Number.isFinite(now) ? now : 0);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function formatDate(now: number): string {
  const { year, month, day } = dateParts(now);
  return `${two(day)}/${two(month)}/${year}`;
}

export function formatExperience(totalMonths: number | null): string {
  if (totalMonths === null || !Number.isFinite(totalMonths) || totalMonths < 0) return 'Não informada';
  const months = Math.floor(totalMonths);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearsText = years === 1 ? '1 ano' : `${years} anos`;
  const monthsText = rest === 1 ? '1 mês' : `${rest} meses`;
  if (years === 0) return monthsText;
  return rest === 0 ? yearsText : `${yearsText} e ${monthsText}`;
}

function scopeText(scope: ReportScope, shown: number, total: number, filterTexts: readonly string[], allCount: number): string {
  const noun = (n: number): string => (n === 1 ? '1 candidato' : `${n} candidatos`);
  if (filterTexts.length > 0) return `${shown} de ${noun(allCount)}, com filtro: ${filterTexts.join('; ')}`;
  if (total === 0) return 'Nenhum candidato nesta vaga';
  if (scope === 'top10' && total > TOP_SIZE) return `Os ${shown} melhores entre ${noun(total)}`;
  return shown === 1 ? '1 candidato' : `Todos os ${noun(shown)}`;
}

function splitResults(candidate: Candidate, labels: ReadonlyMap<string, string>): { met: string[]; missing: string[]; review: string[] } {
  const met: string[] = [];
  const missing: string[] = [];
  const review: string[] = [];
  const labelOf = (result: RequirementResult): string => labels.get(result.requirementId) ?? result.requirementId;
  for (const result of candidate.match.results) {
    switch (result.status) {
      case 'met':
        met.push(labelOf(result));
        break;
      case 'partial':
        met.push(labelOf(result) + PARTIAL_SUFFIX);
        break;
      case 'not_found':
        missing.push(labelOf(result));
        break;
      case 'needs_reanalysis':
        review.push(labelOf(result));
        break;
    }
  }
  return { met, missing, review };
}

export function buildReport(input: BuildReportInput): ReportModel {
  const { job, candidates, scope, includeNotes, now } = input;
  const filterTexts = input.filterTexts ?? [];
  const allCount = Math.max(input.allCount ?? candidates.length, candidates.length);
  const labels = new Map(job.requirements.map((requirement) => [requirement.id, requirement.label]));
  const ordered = sortCandidates(candidates);
  const chosen = scope === 'top10' ? ordered.slice(0, TOP_SIZE) : ordered;
  const rows = chosen.map((candidate, index): ReportRow => {
    const scored = isScored(candidate.match);
    const { met, missing, review } = splitResults(candidate, labels);
    return {
      position: index + 1,
      name: candidate.name,
      link: candidate.profileUrl,
      scoreText: scored ? String(candidate.match.score) : NO_SCORE_TEXT,
      bandLabel: scored ? BAND_LABELS[candidate.match.band] : null,
      band: scored ? candidate.match.band : null,
      met,
      missing,
      review,
      experience: formatExperience(candidate.card.totalMonths),
      currentTitle: candidate.card.currentTitle ?? 'Não informado',
      stageLabel: STAGE_LABELS[candidate.stage],
      notes: includeNotes ? candidate.notes : null,
    };
  });
  return {
    jobTitle: job.title,
    generatedAt: now,
    dateText: formatDate(now),
    scope,
    scopeText: scopeText(scope, rows.length, candidates.length, filterTexts, allCount),
    filterTexts,
    includeNotes,
    totalCandidates: allCount,
    hasReview: rows.some((row) => row.review.length > 0),
    requirements: job.requirements.map((requirement) => ({
      label: requirement.label,
      required: requirement.importance === 'required',
      importanceLabel: requirement.importance === 'required' ? 'Obrigatório' : 'Desejável',
    })),
    rows,
  };
}
