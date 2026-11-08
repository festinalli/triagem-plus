// A conversa do painel (RF-66, RF-69): função pura que recebe ajustes, vagas, vaga ativa e o passo atual e devolve a lista de
// mensagens, cada uma com `kind`, dados e os botões do próximo passo. Nada é guardado: a conversa é remontada a cada vez.
//
// Como acrescentar um tipo de mensagem (por exemplo, o resultado de uma análise ou o Top 10):
//   1. declare a interface da mensagem aqui e some-a a `ConversationMessage`;
//   2. escreva uma regra (`ConversationRule`) que devolve as mensagens novas e some-a a `DEFAULT_RULES`;
//   3. no painel, o mapa `MESSAGE_VIEWS` (src/panel/messages.ts) passa a exigir o desenho do `kind` novo (erro de tipo até existir).
// O texto da tela nunca mora aqui: a regra devolve dados e ids, e o painel escreve as frases (src/panel/strings.ts).
import { RETENTION_DEFAULT_DAYS, RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from '../model.ts';
import type { Candidate, Job, Settings } from '../model.ts';
import { buildSearch } from '../search/build.ts';
import type { BuiltSearch } from '../search/build.ts';
import type { CandidateFilters } from './filters.ts';
import { homeTriage, TRIAGE_RULES } from './triage.ts';
import { PRIVACY_RULES } from './privacy.ts';
import type { PrivacyInput, PrivacyMessage } from './privacy.ts';
import { resolveTemplates } from '../messages/templates.ts';
import type { ResolvedTemplate } from '../messages/templates.ts';
import type { AnalysisNote, ReportChoice, TriageMessage } from './triage.ts';

/** Versão do texto dos avisos. Se subir, quem aceitou uma versão antiga vê os avisos de novo (RF-01). */
export const TERMS_VERSION = 1;

/** Os blocos dos avisos da primeira abertura, na ordem em que aparecem (RF-01). */
export const NOTICE_IDS = ['responsibility', 'account_risk', 'no_relation', 'score_support', 'not_legal'] as const;
export type NoticeId = (typeof NOTICE_IDS)[number];

export type ActionId =
  | 'create_job'
  | 'show_jobs'
  | 'activate_job'
  | 'edit_job'
  | 'archive_job'
  | 'unarchive_job'
  | 'delete_job'
  | 'confirm_archive_job'
  | 'confirm_delete_job'
  | 'cancel'
  | 'open_requirements'
  | 'open_search'
  | 'open_help'
  | 'go_home'
  | 'open_paste'
  | 'remove_from_list'
  | 'add_more_text'
  | 'show_detail'
  | 'show_all'
  | 'open_report'
  | 'delete_candidate'
  | 'confirm_delete_candidate'
  | 'renew_candidate'
  | 'open_privacy'
  | 'back_privacy'
  | 'delete_person'
  | 'confirm_delete_person';

/** Botão do próximo passo. O painel dá o texto e liga o clique. */
export interface Action {
  readonly id: ActionId;
  readonly jobId?: string;
  /** Para os botões que agem sobre uma pessoa da lista. */
  readonly candidateId?: string;
  readonly primary?: boolean;
  readonly danger?: boolean;
}

/** Onde a pessoa está. Vive só na memória do painel (RF-69). */
export type Step =
  | { readonly name: 'home' }
  | { readonly name: 'job_list' }
  | { readonly name: 'job_form'; readonly jobId: string | null }
  /** `jobId` ausente: a vaga ativa. Presente: a vaga que acabou de ser editada, ativa ou não (RF-10, RF-11). */
  | { readonly name: 'requirements'; readonly jobId?: string }
  | { readonly name: 'search' }
  | { readonly name: 'settings' }
  | { readonly name: 'privacy' }
  | { readonly name: 'privacy_delete'; readonly candidateId: string }
  | { readonly name: 'help_affirmative' }
  | { readonly name: 'paste'; readonly candidateId?: string }
  | { readonly name: 'list' }
  | { readonly name: 'detail'; readonly candidateId: string }
  | { readonly name: 'report' }
  | { readonly name: 'confirm_delete_candidate'; readonly candidateId: string }
  | { readonly name: 'confirm_delete_job'; readonly jobId: string }
  | { readonly name: 'confirm_archive_job'; readonly jobId: string };

export const HOME: Step = { name: 'home' };

export interface RetentionLimits {
  readonly defaultDays: number;
  readonly minDays: number;
  readonly maxDays: number;
}

export interface JobListItem {
  readonly id: string;
  readonly title: string;
  readonly active: boolean;
  readonly archived: boolean;
  readonly requirementCount: number;
}

interface Base {
  /** Identifica a mensagem na tela (chave estável para o foco). */
  readonly id: string;
  readonly actions: readonly Action[];
}

export interface NoticesMessage extends Base {
  readonly kind: 'notices';
  readonly blocks: readonly NoticeId[];
}

export interface AcceptFormMessage extends Base {
  readonly kind: 'accept_form';
  readonly responsibleName: string;
  readonly responsibleContact: string;
  readonly retentionDays: number;
  readonly retention: RetentionLimits;
}

export interface NoJobMessage extends Base {
  readonly kind: 'no_job';
  readonly archivedCount: number;
}

export interface JobListMessage extends Base {
  readonly kind: 'job_list';
  readonly jobs: readonly JobListItem[];
}

export interface JobSummaryMessage extends Base {
  readonly kind: 'job_summary';
  readonly jobId: string;
  readonly title: string;
  readonly requiredCount: number;
  readonly preferredCount: number;
  readonly excludedCount: number;
}

export interface JobFormMessage extends Base {
  readonly kind: 'job_form';
  /** Nulo ao criar. */
  readonly job: Job | null;
}

export interface RequirementsMessage extends Base {
  readonly kind: 'requirements';
  readonly job: Job;
}

export interface SearchMessage extends Base {
  readonly kind: 'search';
  readonly jobId: string;
  readonly title: string;
  /** Quantos obrigatórios entram na busca. Zero: ainda não há o que procurar. */
  readonly searchableCount: number;
  readonly built: BuiltSearch;
}

export interface SettingsFormMessage extends Base {
  readonly kind: 'settings_form';
  readonly responsibleName: string;
  readonly responsibleContact: string;
  readonly retentionDays: number;
  readonly retention: RetentionLimits;
  /** Os três modelos de mensagem que valem agora (RF-80), para editar. */
  readonly templates: readonly ResolvedTemplate[];
}

export interface ConfirmMessage extends Base {
  readonly kind: 'confirm';
  readonly what: 'delete_job' | 'archive_job';
  readonly jobId: string;
  readonly title: string;
}

export interface HelpAffirmativeMessage extends Base {
  readonly kind: 'help_affirmative';
}

export type ConversationMessage =
  | NoticesMessage
  | AcceptFormMessage
  | NoJobMessage
  | JobListMessage
  | JobSummaryMessage
  | JobFormMessage
  | RequirementsMessage
  | SearchMessage
  | SettingsFormMessage
  | ConfirmMessage
  | HelpAffirmativeMessage
  | TriageMessage
  | PrivacyMessage;

export type MessageKind = ConversationMessage['kind'];

export interface ConversationInput {
  readonly settings: Settings;
  readonly jobs: readonly Job[];
  readonly activeJob: Job | null;
  /** Passo atual. Sem ele, a conversa começa pelo início. */
  readonly step?: Step;
  /** Candidatos da vaga ativa, lidos do armazenamento. A conversa nunca os guarda (RF-69). */
  readonly candidates?: readonly Candidate[];
  /** O relógio, em milissegundos: só para o aviso de prazo (RF-90). */
  readonly now?: number;
  /** A análise mais recente, só na memória do painel (RF-66, RF-67). */
  readonly analysis?: AnalysisNote | null;
  readonly filters?: CandidateFilters;
  readonly report?: ReportChoice;
  /** O que a tela de Privacidade sabe: espaço em uso, busca e quem está sendo corrigido. */
  readonly privacy?: PrivacyInput;
}

/** Uma regra devolve as mensagens do passo, ou lista vazia se o passo não é dela. */
export type ConversationRule = (input: ConversationInput, step: Step) => readonly ConversationMessage[];

export const RETENTION_LIMITS: RetentionLimits = { defaultDays: RETENTION_DEFAULT_DAYS, minDays: RETENTION_MIN_DAYS, maxDays: RETENTION_MAX_DAYS };

/** Sem o aceite da versão atual dos avisos, nenhuma tela de trabalho abre (CA-01). */
export function needsAcceptance(settings: Settings): boolean {
  const terms = settings.acceptances.terms;
  return terms === undefined || terms.version < TERMS_VERSION;
}

const act = (id: ActionId, extra: Omit<Action, 'id'> = {}): Action => ({ id, ...extra });

function jobsOf(input: ConversationInput): { open: readonly Job[]; archived: readonly Job[] } {
  return { open: input.jobs.filter((job) => !job.archived), archived: input.jobs.filter((job) => job.archived) };
}

function listItem(job: Job, activeId: string | null): JobListItem {
  return { id: job.id, title: job.title, active: job.id === activeId, archived: job.archived, requirementCount: job.requirements.length };
}

/** Primeira abertura: avisos e aceite. É a única coisa que existe sem o aceite (CA-01). */
const firstRunRule: ConversationRule = ({ settings }) => [
  { id: 'notices', kind: 'notices', blocks: NOTICE_IDS, actions: [] },
  {
    id: 'accept_form',
    kind: 'accept_form',
    responsibleName: settings.responsibleName,
    responsibleContact: settings.responsibleContact,
    retentionDays: settings.retentionDays,
    retention: RETENTION_LIMITS,
    actions: [],
  },
];

const homeRule: ConversationRule = (input, step) => {
  if (step.name !== 'home') return [];
  const { open, archived } = jobsOf(input);
  const active = input.activeJob;
  if (active !== null && !active.archived) {
    const required = active.requirements.filter((r) => r.importance === 'required').length;
    const hasRequirements = active.requirements.length > 0;
    const { analysis, top } = homeTriage(input);
    const summary: ConversationMessage = {
        id: 'job_summary',
        kind: 'job_summary',
        jobId: active.id,
        title: active.title,
        requiredCount: required,
        preferredCount: active.requirements.length - required,
        excludedCount: active.excludedTerms.length,
        actions: [
          act('open_requirements', { primary: !hasRequirements }),
          act('open_paste', { primary: hasRequirements && top === null }),
          act('open_search'),
          act('edit_job', { jobId: active.id }),
          act('show_jobs'),
          act('create_job'),
          act('archive_job', { jobId: active.id }),
          act('delete_job', { jobId: active.id, danger: true }),
        ],
    };
    // Com uma análise recém-feita, o resultado e o Top 10 ocupam a conversa. Ao reabrir, o Top 10 vem antes do resumo (RF-61, RF-69).
    if (analysis !== null) return top === null ? [analysis] : [analysis, top];
    return top === null ? [summary] : [top, summary];
  }
  if (open.length === 0) return [{ id: 'no_job', kind: 'no_job', archivedCount: archived.length, actions: [act('create_job', { primary: true }), ...(archived.length > 0 ? [act('show_jobs')] : [])] }];
  return jobListMessages(input);
};

function jobListMessages(input: ConversationInput): readonly ConversationMessage[] {
  const activeId = input.activeJob?.id ?? null;
  return [{ id: 'job_list', kind: 'job_list', jobs: input.jobs.map((job) => listItem(job, activeId)), actions: [act('create_job', { primary: true }), act('go_home')] }];
}

const jobsRule: ConversationRule = (input, step) => {
  switch (step.name) {
    case 'job_list':
      return jobListMessages(input);
    case 'job_form': {
      const job = step.jobId === null ? null : (input.jobs.find((candidate) => candidate.id === step.jobId) ?? null);
      return [{ id: 'job_form', kind: 'job_form', job, actions: [act('go_home')] }];
    }
    case 'confirm_archive_job':
    case 'confirm_delete_job': {
      const job = input.jobs.find((candidate) => candidate.id === step.jobId);
      if (job === undefined) return [];
      const deleting = step.name === 'confirm_delete_job';
      return [
        {
          id: 'confirm',
          kind: 'confirm',
          what: deleting ? 'delete_job' : 'archive_job',
          jobId: job.id,
          title: job.title,
          actions: [act(deleting ? 'confirm_delete_job' : 'confirm_archive_job', { jobId: job.id, danger: deleting, primary: !deleting }), act('cancel')],
        },
      ];
    }
    default:
      return [];
  }
};

const requirementsRule: ConversationRule = ({ activeJob, jobs }, step) => {
  if (step.name !== 'requirements') return [];
  const job = step.jobId === undefined ? activeJob : (jobs.find((item) => item.id === step.jobId) ?? null);
  if (job === null) return [];
  // A busca e a ajuda falam da vaga ativa: numa vaga que não é a ativa, só se pode voltar.
  if (activeJob === null || job.id !== activeJob.id) return [{ id: 'requirements', kind: 'requirements', job, actions: [act('go_home', { primary: true })] }];
  const hasRequired = job.requirements.some((r) => r.importance === 'required');
  return [{ id: 'requirements', kind: 'requirements', job, actions: [act('open_search', { primary: hasRequired }), act('open_help'), act('go_home')] }];
};

const searchRule: ConversationRule = ({ activeJob }, step) => {
  if (step.name !== 'search' || activeJob === null) return [];
  const built = buildSearch({ requirements: activeJob.requirements, excludedTerms: activeJob.excludedTerms });
  const required = activeJob.requirements.filter((r) => r.importance === 'required' && r.kind !== 'total_experience');
  const searchableCount = Math.max(required.length - built.refusedRequirements.length, 0);
  return [
    {
      id: 'search',
      kind: 'search',
      jobId: activeJob.id,
      title: activeJob.title,
      searchableCount,
      built,
      // Depois de buscar, o próximo passo é analisar quem apareceu.
      actions: [...(built.full.text === '' ? [] : [act('open_paste')]), act('open_requirements', { primary: built.full.text === '' }), act('go_home')],
    },
  ];
};

const settingsRule: ConversationRule = ({ settings }, step) => {
  if (step.name !== 'settings') return [];
  return [
    {
      id: 'settings_form',
      kind: 'settings_form',
      responsibleName: settings.responsibleName,
      responsibleContact: settings.responsibleContact,
      retentionDays: settings.retentionDays,
      retention: RETENTION_LIMITS,
      templates: resolveTemplates(settings.messageTemplates, settings.retentionDays),
      actions: [act('open_privacy'), act('go_home')],
    },
  ];
};

const helpRule: ConversationRule = (_input, step) => (step.name === 'help_affirmative' ? [{ id: 'help_affirmative', kind: 'help_affirmative', actions: [act('open_requirements', { primary: true }), act('go_home')] }] : []);

/** As regras de trabalho, na ordem. A triagem (colar, resultado, Top 10, lista, detalhe e relatório) vem de triage.ts. */
export const DEFAULT_RULES: readonly ConversationRule[] = [homeRule, ...TRIAGE_RULES, jobsRule, requirementsRule, searchRule, settingsRule, helpRule, ...PRIVACY_RULES];

/**
 * Monta a conversa. Sem aceite dos avisos só saem os avisos e o formulário de aceite, qualquer que seja o passo (CA-01).
 * Passo que depende de uma vaga ativa e não a encontra volta ao início.
 */
export function buildConversation(input: ConversationInput, rules: readonly ConversationRule[] = DEFAULT_RULES): ConversationMessage[] {
  if (needsAcceptance(input.settings)) return [...firstRunRule(input, HOME)];
  const step = input.step ?? HOME;
  const out = rules.flatMap((rule) => rule(input, step));
  if (out.length > 0) return out;
  return step.name === 'home' ? [] : rules.flatMap((rule) => rule(input, HOME));
}
