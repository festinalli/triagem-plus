// As mensagens da triagem (RF-61 a RF-69, RF-70): colar o perfil, resultado da análise, Top 10, lista com filtros, detalhe,
// opções do relatório e a confirmação de apagar. Só dados e ids: o texto da tela mora em src/panel/strings.ts.
// A conversa não é guardada (RF-69): tudo aqui sai da lista de candidatos que o painel leu e do passo atual.
import type { Band, Candidate, Evidence, Importance, Job, ProfileSection, RequirementStatus, ResultNote, Stage } from '../model.ts';
import { positionOf, sortCandidates, topTen } from '../match/rank.ts';
import { isListingOnly, isScored } from '../match/score.ts';
import { findForbidden } from '../guard/index.ts';
import { fillTemplate, missingMarkers, resolveTemplates } from '../messages/templates.ts';
import type { Marker, TemplateId } from '../messages/templates.ts';
import { expiresAt, retentionState } from '../store/retention.ts';
import type { RetentionState } from '../store/retention.ts';
import { applyFilters, filtersActive, NO_FILTERS } from './filters.ts';
import type { CandidateFilters } from './filters.ts';
import { safeHttpsLink } from './links.ts';
import type { Action, ActionId, ConversationInput, ConversationRule } from './build.ts';

interface Base {
  readonly id: string;
  readonly actions: readonly Action[];
}

// ---------- o que o painel guarda na memória e passa para a conversa ----------

/** A análise mais recente, só na memória do painel. Quem ela descreve é buscado na lista, então apagar a pessoa a tira da conversa. */
export interface AnalysisNote {
  readonly candidateId: string;
  /** A pessoa já estava na lista e a ficha foi atualizada (RF-64). */
  readonly updated: boolean;
  /** O texto somado não trouxe nada novo (RF-34). */
  readonly addedNothing: boolean;
  /** O link não é de perfil do LinkedIn: a pessoa não será reconhecida se for colada de novo (RF-30). */
  readonly notProfileLink: boolean;
}

export type ReportScopeChoice = 'top10' | 'filtered';

export interface ReportChoice {
  readonly scope: ReportScopeChoice;
  readonly includeNotes: boolean;
  /** Letras que saíram como "?" no último PDF gerado (RF-75). Nulo: nada gerado ainda. */
  readonly replacedCount: number | null;
}

export const DEFAULT_REPORT_CHOICE: ReportChoice = { scope: 'top10', includeNotes: false, replacedCount: null };

// ---------- peças das mensagens ----------

export interface EvidenceLine {
  readonly section: ProfileSection;
  readonly term: string;
  readonly jobTitles: readonly string[];
  readonly months: number | null;
}

export interface RequirementLine {
  readonly requirementId: string;
  readonly label: string;
  readonly importance: Importance;
  readonly status: RequirementStatus;
  readonly note: ResultNote | null;
  readonly evidence: readonly EvidenceLine[];
}

/** Leitura incompleta (RF-35): o que faltou ler. */
export interface ReadNotice {
  readonly level: 'ok' | 'few_sections' | 'empty' | 'listing';
  readonly truncated: boolean;
  readonly missing: readonly ProfileSection[];
}

export interface PersonRow {
  readonly id: string;
  /** Posição na lista inteira, mesmo quando a tela mostra só os filtrados. */
  readonly position: number;
  readonly name: string;
  /** O link só quando é https seguro; senão a tela mostra o texto sem link. */
  readonly link: string | null;
  readonly linkText: string;
  readonly scored: boolean;
  readonly score: number;
  readonly band: Band;
  /** Só foi vista na página de resultados: pré-nota, sem faixa (RF-39). */
  readonly preview: boolean;
  readonly stage: Stage;
  readonly currentTitle: string | null;
  /** Ainda sem "informado em": selo "não informado" (RF-82). */
  readonly notInformed: boolean;
  readonly favorite: boolean;
  readonly expiring: boolean;
}

export interface Entered {
  readonly name: string;
  readonly position: number;
  readonly total: number;
  readonly inTop: boolean;
  readonly updated: boolean;
}

// ---------- mensagens ----------

export interface PasteFormMessage extends Base {
  readonly kind: 'paste_form';
  /** Por que não dá para colar ainda: sem vaga ativa, ou vaga sem requisitos (não há nota sem requisito). */
  readonly blocked: 'no_job' | 'no_requirements' | null;
  readonly jobTitle: string | null;
  /** Somar texto a quem já está na lista (RF-34). */
  readonly adding: { readonly candidateId: string; readonly name: string; readonly link: string } | null;
}

export interface AnalysisResultMessage extends Base {
  readonly kind: 'analysis_result';
  readonly candidateId: string;
  readonly name: string;
  readonly link: string | null;
  readonly linkText: string;
  readonly scored: boolean;
  readonly score: number;
  readonly band: Band;
  readonly preview: boolean;
  readonly requiredMet: number;
  readonly requiredTotal: number;
  readonly updated: boolean;
  readonly addedNothing: boolean;
  readonly notProfileLink: boolean;
  readonly lines: readonly RequirementLine[];
  readonly readNotice: ReadNotice;
}

export interface TopTenMessage extends Base {
  readonly kind: 'top_ten';
  readonly jobTitle: string;
  readonly total: number;
  readonly rows: readonly PersonRow[];
  readonly entered: Entered | null;
}

export interface CandidateListMessage extends Base {
  readonly kind: 'candidate_list';
  readonly jobTitle: string;
  readonly total: number;
  readonly shown: number;
  readonly hidden: number;
  readonly rows: readonly PersonRow[];
  readonly filters: CandidateFilters;
  readonly filtersActive: boolean;
}

/** Um modelo de mensagem já preenchido para esta pessoa (RF-80). Copiar é o único gesto (RF-81). */
export interface TemplateOption {
  readonly id: TemplateId;
  readonly title: string;
  readonly text: string;
  /** Marcadores que ficaram sem valor e continuam visíveis no texto. */
  readonly missing: readonly Marker[];
}

export interface CandidateDetailMessage extends Base {
  readonly kind: 'candidate_detail';
  readonly candidateId: string;
  readonly name: string;
  readonly link: string | null;
  readonly linkText: string;
  readonly scored: boolean;
  readonly score: number;
  readonly band: Band;
  readonly preview: boolean;
  readonly requiredMet: number;
  readonly requiredTotal: number;
  readonly position: number;
  readonly total: number;
  readonly stage: Stage;
  readonly favorite: boolean;
  readonly notes: string;
  /** Avisos sobre as notas da pessoa: assuntos da trava. Só alerta, nunca bloqueia (RF-65). */
  readonly noteAlerts: readonly string[];
  readonly informedAt: number | null;
  readonly updatedAt: number;
  readonly retention: RetentionState;
  readonly expiresAt: number;
  readonly templates: readonly TemplateOption[];
  readonly lines: readonly RequirementLine[];
  readonly readNotice: ReadNotice;
}

export interface ReportOptionsMessage extends Base {
  readonly kind: 'report_options';
  readonly jobTitle: string;
  readonly total: number;
  readonly filteredCount: number;
  readonly filtersActive: boolean;
  readonly scope: ReportScopeChoice;
  readonly includeNotes: boolean;
  /** O aviso de RF-73 já foi aceito. */
  readonly exportAccepted: boolean;
  readonly replacedCount: number | null;
}

export interface ConfirmCandidateMessage extends Base {
  readonly kind: 'confirm_candidate';
  readonly candidateId: string;
  readonly name: string;
}

export type TriageMessage =
  | PasteFormMessage
  | AnalysisResultMessage
  | TopTenMessage
  | CandidateListMessage
  | CandidateDetailMessage
  | ReportOptionsMessage
  | ConfirmCandidateMessage;

// ---------- montagem ----------

const act = (id: ActionId, extra: Omit<Action, 'id'> = {}): Action => ({ id, ...extra });

const ESSENTIAL_SECTIONS: readonly ProfileSection[] = ['experience', 'skills'];

function candidatesOf(input: ConversationInput): readonly Candidate[] {
  return input.candidates ?? [];
}

function requirementOrder(importance: Importance): number {
  return importance === 'required' ? 0 : 1;
}

function evidenceOf(list: readonly Evidence[]): EvidenceLine[] {
  return list.map((item) => ({ section: item.section, term: item.term, jobTitles: item.jobTitles, months: item.months }));
}

/** Um resultado por requisito da vaga, obrigatórios primeiro. Resultado de requisito que já não existe fica de fora. */
export function requirementLines(candidate: Candidate, job: Job): RequirementLine[] {
  const results = new Map(candidate.match.results.map((result) => [result.requirementId, result]));
  const lines: RequirementLine[] = [];
  for (const requirement of job.requirements) {
    const result = results.get(requirement.id);
    if (result === undefined) continue;
    lines.push({ requirementId: requirement.id, label: requirement.label, importance: requirement.importance, status: result.status, note: result.note ?? null, evidence: evidenceOf(result.evidence) });
  }
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => requirementOrder(a.line.importance) - requirementOrder(b.line.importance) || a.index - b.index)
    .map(({ line }) => line);
}

/** Leitura incompleta (RF-35). Só as seções essenciais geram aviso: as outras podem não existir no perfil. */
export function readNoticeOf(candidate: Candidate): ReadNotice {
  if (isListingOnly(candidate.card)) return { level: 'listing', truncated: false, missing: [] };
  const read = candidate.card.sectionsRead;
  const missing = ESSENTIAL_SECTIONS.filter((section) => !read.includes(section));
  const level = read.length === 0 ? 'empty' : missing.length > 0 ? 'few_sections' : 'ok';
  return { level, truncated: candidate.card.truncated, missing };
}

function rowOf(candidate: Candidate, position: number, input: ConversationInput): PersonRow {
  const retentionDays = input.settings.retentionDays;
  return {
    id: candidate.id,
    position,
    name: candidate.name,
    link: safeHttpsLink(candidate.profileUrl),
    linkText: candidate.profileUrl,
    scored: isScored(candidate.match),
    score: candidate.match.score,
    band: candidate.match.band,
    preview: isListingOnly(candidate.card),
    stage: candidate.stage,
    currentTitle: candidate.card.currentTitle,
    notInformed: candidate.informedAt === null,
    favorite: candidate.favorite,
    expiring: input.now !== undefined && retentionState(candidate, retentionDays, input.now) !== 'ok',
  };
}

function positions(list: readonly Candidate[]): Map<string, number> {
  return new Map(sortCandidates(list).map((candidate, index) => [candidate.id, index + 1]));
}

function enteredOf(input: ConversationInput, list: readonly Candidate[]): Entered | null {
  const analysis = input.analysis;
  if (analysis === undefined || analysis === null) return null;
  const candidate = list.find((item) => item.id === analysis.candidateId);
  const position = positionOf(list, analysis.candidateId);
  if (candidate === undefined || position === null) return null;
  return { name: candidate.name, position, total: list.length, inTop: position <= 10, updated: analysis.updated };
}

/** O Top 10 da vaga ativa. Lista vazia: nada a mostrar (RF-68 pede "os que houver"). */
export function topTenMessage(input: ConversationInput): TopTenMessage | null {
  const job = input.activeJob;
  const list = candidatesOf(input);
  if (job === null || list.length === 0) return null;
  const rank = positions(list);
  const rows = topTen(list).map((candidate) => rowOf(candidate, rank.get(candidate.id) ?? 0, input));
  const showAnalysis = input.analysis !== undefined && input.analysis !== null;
  return {
    id: 'top_ten',
    kind: 'top_ten',
    jobTitle: job.title,
    total: list.length,
    rows,
    entered: enteredOf(input, list),
    actions: [act('open_report', { primary: true }), act('show_all'), act('open_paste'), ...(showAnalysis ? [act('go_home')] : [])],
  };
}

export function analysisMessage(input: ConversationInput): AnalysisResultMessage | null {
  const job = input.activeJob;
  const analysis = input.analysis;
  if (job === null || analysis === undefined || analysis === null) return null;
  const candidate = candidatesOf(input).find((item) => item.id === analysis.candidateId);
  if (candidate === undefined) return null;
  return {
    id: 'analysis_result',
    kind: 'analysis_result',
    candidateId: candidate.id,
    name: candidate.name,
    link: safeHttpsLink(candidate.profileUrl),
    linkText: candidate.profileUrl,
    scored: isScored(candidate.match),
    score: candidate.match.score,
    band: candidate.match.band,
    preview: isListingOnly(candidate.card),
    requiredMet: candidate.match.requiredMet,
    requiredTotal: candidate.match.requiredTotal,
    updated: analysis.updated,
    addedNothing: analysis.addedNothing,
    notProfileLink: analysis.notProfileLink,
    lines: requirementLines(candidate, job),
    readNotice: readNoticeOf(candidate),
    actions: [act('remove_from_list', { candidateId: candidate.id, danger: true }), act('add_more_text', { candidateId: candidate.id }), act('show_detail', { candidateId: candidate.id })],
  };
}

/** O início da vaga ativa: o resultado da última análise (se houver) e o Top 10. */
export function homeTriage(input: ConversationInput): { readonly analysis: AnalysisResultMessage | null; readonly top: TopTenMessage | null } {
  return { analysis: analysisMessage(input), top: topTenMessage(input) };
}

const pasteRule: ConversationRule = (input, step) => {
  if (step.name !== 'paste') return [];
  const job = input.activeJob;
  if (job === null) {
    return [{ id: 'paste_form', kind: 'paste_form', blocked: 'no_job', jobTitle: null, adding: null, actions: [act('create_job', { primary: true }), act('show_jobs')] }];
  }
  if (job.requirements.length === 0) {
    return [{ id: 'paste_form', kind: 'paste_form', blocked: 'no_requirements', jobTitle: job.title, adding: null, actions: [act('open_requirements', { primary: true }), act('go_home')] }];
  }
  const target = step.candidateId === undefined ? undefined : candidatesOf(input).find((item) => item.id === step.candidateId);
  const adding = target === undefined ? null : { candidateId: target.id, name: target.name, link: target.profileUrl };
  return [{ id: 'paste_form', kind: 'paste_form', blocked: null, jobTitle: job.title, adding, actions: [act('go_home')] }];
};

const listRule: ConversationRule = (input, step) => {
  const job = input.activeJob;
  if (step.name !== 'list' || job === null) return [];
  const list = candidatesOf(input);
  const filters = input.filters ?? NO_FILTERS;
  const rank = positions(list);
  const kept = sortCandidates(applyFilters(list, job, filters));
  return [
    {
      id: 'candidate_list',
      kind: 'candidate_list',
      jobTitle: job.title,
      total: list.length,
      shown: kept.length,
      hidden: list.length - kept.length,
      rows: kept.map((candidate) => rowOf(candidate, rank.get(candidate.id) ?? 0, input)),
      filters,
      filtersActive: filtersActive(filters),
      actions: [act('open_report', { primary: true }), act('open_paste'), act('go_home')],
    },
  ];
};

function noteAlertsOf(notes: string): string[] {
  return [...new Set(findForbidden(notes).map((hit) => hit.reason))];
}

function templateOptions(candidate: Candidate, job: Job, input: ConversationInput): TemplateOption[] {
  const values = { nome: candidate.name, vaga: job.title, responsavel: input.settings.responsibleName, contato: input.settings.responsibleContact };
  return resolveTemplates(input.settings.messageTemplates, input.settings.retentionDays).map((template) => ({
    id: template.id,
    title: template.title,
    text: fillTemplate(template.body, values),
    missing: missingMarkers(template.body, values),
  }));
}

const detailRule: ConversationRule = (input, step) => {
  const job = input.activeJob;
  if ((step.name !== 'detail' && step.name !== 'confirm_delete_candidate') || job === null) return [];
  const list = candidatesOf(input);
  const candidate = list.find((item) => item.id === step.candidateId);
  if (candidate === undefined) return [];
  if (step.name === 'confirm_delete_candidate') {
    return [
      {
        id: 'confirm_candidate',
        kind: 'confirm_candidate',
        candidateId: candidate.id,
        name: candidate.name,
        actions: [act('confirm_delete_candidate', { candidateId: candidate.id, danger: true }), act('show_detail', { candidateId: candidate.id, primary: true })],
      },
    ];
  }
  const retention = input.now === undefined ? 'ok' : retentionState(candidate, input.settings.retentionDays, input.now);
  return [
    {
      id: 'candidate_detail',
      kind: 'candidate_detail',
      candidateId: candidate.id,
      name: candidate.name,
      link: safeHttpsLink(candidate.profileUrl),
      linkText: candidate.profileUrl,
      scored: isScored(candidate.match),
      score: candidate.match.score,
      band: candidate.match.band,
      preview: isListingOnly(candidate.card),
      requiredMet: candidate.match.requiredMet,
      requiredTotal: candidate.match.requiredTotal,
      position: positionOf(list, candidate.id) ?? 0,
      total: list.length,
      stage: candidate.stage,
      favorite: candidate.favorite,
      notes: candidate.notes,
      noteAlerts: noteAlertsOf(candidate.notes),
      informedAt: candidate.informedAt,
      updatedAt: candidate.updatedAt,
      retention,
      expiresAt: expiresAt(candidate, input.settings.retentionDays),
      templates: templateOptions(candidate, job, input),
      lines: requirementLines(candidate, job),
      readNotice: readNoticeOf(candidate),
      actions: [
        ...(retention !== 'ok' ? [act('renew_candidate', { candidateId: candidate.id, primary: true })] : []),
        act('add_more_text', { candidateId: candidate.id }),
        act('show_all'),
        act('go_home'),
        act('delete_candidate', { candidateId: candidate.id, danger: true }),
      ],
    },
  ];
};

const reportRule: ConversationRule = (input, step) => {
  const job = input.activeJob;
  if (step.name !== 'report' || job === null) return [];
  const list = candidatesOf(input);
  const choice = input.report ?? DEFAULT_REPORT_CHOICE;
  const filters = input.filters ?? NO_FILTERS;
  return [
    {
      id: 'report_options',
      kind: 'report_options',
      jobTitle: job.title,
      total: list.length,
      filteredCount: applyFilters(list, job, filters).length,
      filtersActive: filtersActive(filters),
      scope: choice.scope,
      includeNotes: choice.includeNotes,
      exportAccepted: input.settings.acceptances.fileExport !== undefined,
      replacedCount: choice.replacedCount,
      actions: [act('show_all'), act('go_home')],
    },
  ];
};

export const TRIAGE_RULES: readonly ConversationRule[] = [pasteRule, listRule, detailRule, reportRule];
