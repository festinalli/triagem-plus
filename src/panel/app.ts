// O controlador do painel: guarda o passo atual e os rascunhos (só em memória, RF-69), fala com o armazenamento e
// redesenha a conversa. As regras vivem em src/core; aqui só se liga o clique à regra e o resultado à tela.
// Nenhuma mensagem de erro ou registro leva nome, texto de vaga ou dado de candidato (RNF-11).
import { buildConversation, HOME, TERMS_VERSION } from '../core/conversation/build.ts';
import type { Action, ConversationMessage, Step } from '../core/conversation/build.ts';
import { reconcileMemory, recomputeMatches } from '../core/conversation/analyze-store.ts';
import type { AnalyzeInput, AnalyzeOutcome, TextMemory } from '../core/conversation/analyze-store.ts';
import { NO_FILTERS } from '../core/conversation/filters.ts';
import type { CandidateFilters } from '../core/conversation/filters.ts';
import { DEFAULT_REPORT_CHOICE } from '../core/conversation/triage.ts';
import type { AnalysisNote, ReportChoice } from '../core/conversation/triage.ts';
import { extractRequirements } from '../core/job/extract.ts';
import type { IgnoredLine } from '../core/job/extract.ts';
import { addRequirement, makeRequirement } from '../core/job/requirements.ts';
import type { RequirementInput } from '../core/job/requirements.ts';
import { checkTerm, findForbidden, MAX_TERM_CHARS } from '../core/guard/index.ts';
import { RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from '../core/model.ts';
import type { Candidate, Importance, Job, Requirement, RequirementKind, Settings } from '../core/model.ts';
import { purgeExpired, retentionState } from '../core/store/retention.ts';
import type { Store } from '../core/store/store.ts';
import { ERRORS } from './strings.ts';
import { createClickReadControl } from './click-controller.ts';
import type { ClickReadControl } from './click-controller.ts';
import { createContactControl } from './contact-controller.ts';
import type { ContactControl } from './contact-controller.ts';
import { createPrivacyControl } from './privacy-controller.ts';
import type { PrivacyControl } from './privacy-controller.ts';
import { createTriage } from './triage-controller.ts';
import type { ReportFormat } from './report-files.ts';

export interface SuggestionItem {
  readonly requirement: Requirement;
  readonly use: boolean;
  readonly error?: string;
}

export interface Suggestion {
  /** A vaga de onde veio o texto: a sugestão vale para ela, esteja ativa ou não (RF-10, RF-11). */
  readonly jobId: string;
  readonly items: readonly SuggestionItem[];
  readonly ignored: readonly IgnoredLine[];
  readonly truncated: boolean;
  readonly needsManualEntry: boolean;
  /** Erro que vale para o bloco todo, como “marque pelo menos uma”. */
  readonly error?: string;
}

export type SearchVersion = 'full' | 'short';
export type CopyStatus = 'copied' | 'manual' | null;

/** Tudo o que só existe enquanto o painel está aberto. Nada daqui é guardado. */
export interface UiState {
  step: Step;
  suggestion: Suggestion | null;
  /** Valores digitados que a validação devolveu, por nome do campo. */
  drafts: Record<string, string>;
  /** Erro por id de campo ou de requisito. */
  errors: Record<string, string>;
  searchVersion: SearchVersion;
  copyStatus: CopyStatus;
  settingsSaved: boolean;
  banner: string | null;
  /** Aviso de sucesso depois de uma ação, como “Prazo renovado.”. */
  flash: string | null;
  loadFailed: boolean;
  /** A análise mais recente. Vive só na memória do painel: reabrir mostra o Top 10 a partir da lista (RF-69, CA-26). */
  analysis: AnalysisNote | null;
  filters: CandidateFilters;
  report: ReportChoice;
  /** Prazo menor que apagaria gente: espera a confirmação (RF-90). */
  retentionConfirm: { days: number; count: number } | null;
  /** Uma análise em andamento: o botão fica desligado e a repetição é ignorada. */
  busy: boolean;
}

export interface Snapshot {
  readonly settings: Settings;
  readonly jobs: readonly Job[];
  readonly activeJob: Job | null;
  /** Candidatos da vaga ativa, como estão guardados. */
  readonly candidates: readonly Candidate[];
}

export interface Controller {
  readonly ui: UiState;
  snapshot(): Snapshot;
  messages(): ConversationMessage[];
  go(step: Step, flash?: string | null): void;
  run(action: Action): void;
  redraw(options?: { focusError?: boolean }): void;
  accept(values: Record<string, string>): Promise<void>;
  saveSettings(values: Record<string, string>): Promise<void>;
  saveJob(jobId: string | null, values: Record<string, string>): Promise<void>;
  suggestAgain(): void;
  discardSuggestion(): void;
  applySuggestion(values: Record<string, string>): Promise<void>;
  addRequirementByHand(values: Record<string, string>): Promise<void>;
  changeRequirement(id: string, patch: { importance?: Importance; years?: string }): Promise<void>;
  removeRequirement(id: string): Promise<void>;
  addExcluded(term: string): Promise<void>;
  removeExcluded(term: string): Promise<void>;
  setSearchVersion(version: SearchVersion): void;
  setCopyStatus(status: CopyStatus): void;
  /** Analisa e guarda o perfil sem outro clique (RF-36). A leitura por clique chama isto com source 'clicked'. */
  analyzeAndStore(input: AnalyzeInput): Promise<AnalyzeOutcome>;
  submitPaste(values: Record<string, string>): Promise<void>;
  saveCandidateDetails(candidateId: string, values: Record<string, string>): Promise<void>;
  setFilters(values: Record<string, string>): void;
  clearFilters(): void;
  /** Outra janela mudou o armazenamento: relê, confere o passo atual e redesenha (RF-93). */
  refresh(): Promise<void>;
  confirmRetention(): Promise<void>;
  cancelRetention(): void;
  setReport(patch: Partial<Pick<ReportChoice, 'scope' | 'includeNotes'>>): void;
  download(format: ReportFormat): Promise<void>;
  /** Liga e desliga a leitura por clique em Ajustes (RF-32). */
  readonly clickRead: ClickReadControl;
  /** Modelos de mensagem: escolher, copiar, marcar "informado em" e editar em Ajustes (RF-80 a RF-82). */
  readonly contact: ContactControl;
  /** Tela de Privacidade: achar, corrigir, exportar e apagar pessoas, exportar tudo e apagar tudo (RF-91 a RF-94). */
  readonly privacy: PrivacyControl;
}

export interface ControllerDeps {
  readonly store: Store;
  /** O texto da última análise, na memória da sessão (RF-34). */
  readonly memory: TextMemory;
  readonly now: () => number;
  readonly newId: () => string;
  /** Desenha a tela inteira. `focus` diz o que ganha o foco depois. */
  readonly paint: (focus: 'first' | 'error' | 'keep') => void;
  /** Esvazia a memória da sessão inteira, no Apagar tudo (RF-93). */
  readonly wipeSession?: () => Promise<void>;
}

const YEARS_KINDS: ReadonlySet<RequirementKind> = new Set<RequirementKind>(['term', 'total_experience']);

export function totalLabel(years: number): string {
  return years === 1 ? '1 ano de experiência' : `${years} anos de experiência`;
}

/** Texto digitado de anos: vazio = sem anos; número inteiro = ok; o resto = inválido (nulo). */
export function parseYears(text: string | undefined): number | undefined | null {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return undefined;
  if (!/^\d{1,3}$/u.test(trimmed)) return null;
  return Number(trimmed);
}

function clean(text: string | undefined): string {
  return (text ?? '').replace(/\p{Cs}/gu, '').trim();
}

export function createController(deps: ControllerDeps): { controller: Controller; load: () => Promise<void> } {
  const { store } = deps;
  let data: Snapshot = { settings: { responsibleName: '', responsibleContact: '', retentionDays: 180, clickReadEnabled: false, activeJobId: null, messageTemplates: [], acceptances: {} }, jobs: [], activeJob: null, candidates: [] };
  const ui: UiState = {
    step: HOME,
    suggestion: null,
    drafts: {},
    errors: {},
    searchVersion: 'full',
    copyStatus: null,
    settingsSaved: false,
    banner: null,
    flash: null,
    loadFailed: false,
    analysis: null,
    filters: NO_FILTERS,
    report: DEFAULT_REPORT_CHOICE,
    retentionConfirm: null,
    busy: false,
  };

  async function load(): Promise<void> {
    try {
      // O texto da sessão acompanha o candidato: sem ele, sai (RF-36, RF-45).
      await reconcileMemory(store, deps.memory);
      const settings = await store.getSettings();
      const jobs = [...(await store.listJobs()).items].sort((a, b) => b.createdAt - a.createdAt);
      const activeJob = jobs.find((job) => job.id === settings.activeJobId && !job.archived) ?? null;
      const candidates = activeJob === null ? [] : (await store.listCandidates(activeJob.id)).items;
      // Filtro é da vaga em que foi posto: outra vaga começa sem filtro (RF-60).
      if ((data.activeJob?.id ?? null) !== (activeJob?.id ?? null)) ui.filters = NO_FILTERS;
      data = { settings, jobs, activeJob, candidates };
      ui.loadFailed = false;
    } catch {
      ui.loadFailed = true;
    }
  }

  function clearTransient(): void {
    ui.drafts = {};
    ui.errors = {};
    ui.copyStatus = null;
    ui.settingsSaved = false;
    ui.banner = null;
    ui.flash = null;
    ui.retentionConfirm = null;
    clickRead.reset();
    contact.reset();
    privacy.sync();
  }

  function go(step: Step, flash: string | null = null): void {
    ui.step = step;
    clearTransient();
    ui.flash = flash;
    if (step.name !== 'requirements') ui.suggestion = null;
    deps.paint('first');
  }

  function redraw(options: { focusError?: boolean } = {}): void {
    deps.paint(options.focusError === true ? 'error' : 'keep');
  }

  /** Grava e relê. Falha vira o aviso simples da tela, sem detalhe do erro. */
  async function commit(write: () => Promise<void>): Promise<boolean> {
    try {
      await write();
      await load();
      return true;
    } catch {
      ui.banner = ERRORS.saveFailed;
      return false;
    }
  }

  /** A vaga que a tela de requisitos mostra: a que acabou de ser editada, se houver, senão a ativa. */
  function currentJob(): Job | null {
    if (ui.step.name === 'requirements' && ui.step.jobId !== undefined) {
      const wanted = ui.step.jobId;
      return data.jobs.find((job) => job.id === wanted) ?? null;
    }
    return data.activeJob;
  }

  /** Grava a vaga. Se os requisitos mudaram, refaz a nota de todos pela ficha (RF-55). */
  async function saveJobRecord(job: Job): Promise<boolean> {
    const before = data.jobs.find((item) => item.id === job.id);
    const changed = before !== undefined && JSON.stringify(before.requirements) !== JSON.stringify(job.requirements);
    return commit(async () => {
      const saved = { ...job, updatedAt: deps.now() };
      await store.saveJob(saved);
      if (changed) await recomputeMatches(store, saved);
    });
  }

  function startSuggestion(job: Job): void {
    if (job.text.trim() === '') {
      ui.suggestion = null;
      return;
    }
    const found = extractRequirements(job.text);
    ui.suggestion = {
      jobId: job.id,
      items: found.requirements.map((requirement) => ({ requirement, use: true })),
      ignored: found.ignored,
      truncated: found.truncated,
      needsManualEntry: found.needsManualEntry,
    };
  }

  function retentionFrom(values: Record<string, string>): number | null {
    const text = clean(values['retentionDays']);
    if (!/^\d{1,4}$/u.test(text)) return null;
    const days = Number(text);
    return days >= RETENTION_MIN_DAYS && days <= RETENTION_MAX_DAYS ? days : null;
  }

  /** Confere os três campos dos ajustes. Devolve os erros por campo; vazio quando está tudo certo. */
  function checkResponsible(values: Record<string, string>): Record<string, string> {
    const errors: Record<string, string> = {};
    if (clean(values['responsibleName']) === '') errors['responsibleName'] = ERRORS.name;
    if (clean(values['responsibleContact']) === '') errors['responsibleContact'] = ERRORS.contact;
    if (retentionFrom(values) === null) errors['retentionDays'] = ERRORS.retention(RETENTION_MIN_DAYS, RETENTION_MAX_DAYS);
    return errors;
  }

  function fail(errors: Record<string, string>, values: Record<string, string>): void {
    ui.errors = errors;
    ui.drafts = values;
    redraw({ focusError: true });
  }

  async function accept(values: Record<string, string>): Promise<void> {
    const errors = checkResponsible(values);
    if (Object.keys(errors).length > 0) return fail(errors, values);
    const days = retentionFrom(values) as number;
    const ok = await commit(async () => {
      const current = await store.getSettings();
      await store.updateSettings({
        responsibleName: clean(values['responsibleName']),
        responsibleContact: clean(values['responsibleContact']),
        retentionDays: days,
        acceptances: { ...current.acceptances, terms: { version: TERMS_VERSION, at: deps.now() } },
      });
    });
    if (ok) go(HOME);
    else fail({}, values);
  }

  /** Quantas pessoas ficariam vencidas com este prazo. Conta a pessoa uma vez, mesmo em várias vagas. */
  async function peopleExpiredBy(days: number): Promise<number> {
    const { items } = await store.listAllCandidates();
    const now = deps.now();
    const people = new Set(items.filter((item) => retentionState(item, days, now) === 'expired').map((item) => item.profileKey ?? `id:${item.id}`));
    return people.size;
  }

  async function saveSettings(values: Record<string, string>): Promise<void> {
    const errors = checkResponsible(values);
    if (Object.keys(errors).length > 0) return fail(errors, values);
    const days = retentionFrom(values) as number;
    // Reduzir o prazo apaga gente: mostra quantas pessoas e espera a confirmação (RF-90).
    if (days !== data.settings.retentionDays) {
      let count = 0;
      try {
        count = await peopleExpiredBy(days);
      } catch {
        count = 0;
      }
      if (count > 0) {
        ui.retentionConfirm = { days, count };
        ui.errors = {};
        ui.drafts = values;
        ui.settingsSaved = false;
        return redraw();
      }
    }
    await persistSettings(values, days, false);
  }

  async function persistSettings(values: Record<string, string>, days: number, purge: boolean): Promise<void> {
    const ok = await commit(async () => {
      await store.updateSettings({ responsibleName: clean(values['responsibleName']), responsibleContact: clean(values['responsibleContact']), retentionDays: days });
      if (purge) await purgeExpired(store, deps.now());
    });
    clearTransient();
    ui.analysis = purge ? null : ui.analysis;
    ui.settingsSaved = ok;
    if (!ok) ui.banner = ERRORS.saveFailed;
    deps.paint('first');
  }

  async function confirmRetention(): Promise<void> {
    const pending = ui.retentionConfirm;
    if (pending === null) return;
    await persistSettings(ui.drafts, pending.days, true);
  }

  function cancelRetention(): void {
    ui.retentionConfirm = null;
    redraw();
  }

  async function saveJob(jobId: string | null, values: Record<string, string>): Promise<void> {
    const title = clean(values['title']).slice(0, 120);
    if (title === '') return fail({ title: ERRORS.jobTitle }, values);
    // O título vai para a mensagem ao candidato: passa pela mesma trava do texto da vaga (RF-13, RF-80).
    const forbidden = findForbidden(title)[0];
    if (forbidden !== undefined) return fail({ title: forbidden.reason }, values);
    const text = (values['text'] ?? '').replace(/\p{Cs}/gu, '');
    const existing = jobId === null ? null : (data.jobs.find((job) => job.id === jobId) ?? null);
    const now = deps.now();
    let job: Job;
    if (existing === null) {
      job = { id: deps.newId(), title, text, requirements: [], excludedTerms: [], archived: false, createdAt: now, updatedAt: now };
    } else {
      job = { ...existing, title, text, updatedAt: now };
    }
    const textChanged = existing === null || existing.text !== text;
    const ok = await commit(async () => {
      await store.saveJob(job);
      if (existing === null) await store.updateSettings({ activeJobId: job.id });
    });
    if (!ok) return fail({}, values);
    if (textChanged && text.trim() !== '') {
      ui.step = { name: 'requirements', jobId: job.id };
      clearTransient();
      startSuggestion(job);
      deps.paint('first');
    } else {
      go(HOME);
    }
  }

  async function setJobFlag(jobId: string, archived: boolean): Promise<void> {
    const job = data.jobs.find((candidate) => candidate.id === jobId);
    if (job === undefined) return;
    await commit(async () => {
      await store.saveJob({ ...job, archived, updatedAt: deps.now() });
      if (archived && data.settings.activeJobId === jobId) await store.updateSettings({ activeJobId: null });
    });
  }

  function run(action: Action): void {
    const id = action.jobId;
    switch (action.id) {
      case 'create_job':
        return go({ name: 'job_form', jobId: null });
      case 'show_jobs':
        return go({ name: 'job_list' });
      case 'edit_job':
        return go({ name: 'job_form', jobId: id ?? data.activeJob?.id ?? null });
      case 'archive_job':
        return id === undefined ? undefined : go({ name: 'confirm_archive_job', jobId: id });
      case 'delete_job':
        return id === undefined ? undefined : go({ name: 'confirm_delete_job', jobId: id });
      case 'activate_job':
        if (id === undefined) return;
        void commit(async () => {
          await store.updateSettings({ activeJobId: id });
        }).then(() => {
          ui.analysis = null;
          go(HOME);
        });
        return;
      case 'confirm_archive_job':
        if (id === undefined) return;
        void setJobFlag(id, true).then(() => go(HOME));
        return;
      case 'unarchive_job':
        if (id === undefined) return;
        void setJobFlag(id, false).then(() => go({ name: 'job_list' }));
        return;
      case 'confirm_delete_job':
        if (id === undefined) return;
        void commit(() => store.deleteJob(id)).then(() => go(HOME));
        return;
      case 'cancel':
      case 'go_home':
        ui.analysis = null;
        return go(HOME);
      case 'open_requirements':
        return go({ name: 'requirements' });
      case 'open_search':
        return go({ name: 'search' });
      case 'open_help':
        return go({ name: 'help_affirmative' });
      default:
        if (!triage.run(action)) privacy.run(action);
    }
  }

  // ---------- requisitos ----------

  function mergeInto(list: readonly Requirement[], next: Requirement): { ok: true; list: readonly Requirement[] } | { ok: false; reason: string } {
    const found = list.find((item) => item.id === next.id);
    if (found !== undefined) {
      const importance: Importance = found.importance === 'required' || next.importance === 'required' ? 'required' : 'preferred';
      const years = Math.max(found.minYears ?? 0, next.minYears ?? 0);
      const merged: Requirement = { ...found, importance, ...(years > 0 ? { minYears: years } : {}) };
      return { ok: true, list: list.map((item) => (item.id === next.id ? merged : item)) };
    }
    const added = addRequirement(list, next);
    return added.ok ? { ok: true, list: added.list } : { ok: false, reason: added.reason };
  }

  function inputFor(kind: RequirementKind, label: string, importance: Importance, years: number | undefined): RequirementInput {
    const withYears = kind === 'total_experience' ? { label: years === undefined ? label : totalLabel(years) } : { label };
    return { kind, importance, ...withYears, ...(years === undefined || !YEARS_KINDS.has(kind) ? {} : { minYears: years }) };
  }

  async function applySuggestion(values: Record<string, string>): Promise<void> {
    const suggestion = ui.suggestion;
    // A sugestão pertence à vaga de onde veio o texto, não à que está ativa agora (RF-10, RF-11).
    const job = suggestion === null ? null : (data.jobs.find((item) => item.id === suggestion.jobId) ?? null);
    if (job === null || suggestion === null) return;
    let list: readonly Requirement[] = job.requirements;
    const remaining: SuggestionItem[] = [];
    let used = 0;
    suggestion.items.forEach((item, index) => {
      const use = values[`use-${index}`] === 'on';
      const label = clean(values[`label-${index}`] ?? item.requirement.label);
      const importance: Importance = values[`imp-${index}`] === 'preferred' ? 'preferred' : 'required';
      const yearsText = values[`years-${index}`];
      const edited: Requirement = { ...item.requirement, label, importance };
      if (!use) return;
      used++;
      const years = YEARS_KINDS.has(item.requirement.kind) ? parseYears(yearsText) : undefined;
      if (years === null) return void remaining.push({ requirement: edited, use, error: ERRORS.yearsTotal });
      const made = makeRequirement(inputFor(item.requirement.kind, label, importance, years));
      if (!made.ok) return void remaining.push({ requirement: edited, use, error: made.reason });
      const merged = mergeInto(list, made.requirement);
      if (!merged.ok) return void remaining.push({ requirement: edited, use, error: merged.reason });
      list = merged.list;
    });
    if (used === 0) {
      ui.suggestion = { ...suggestion, items: suggestion.items.map((item, index) => ({ ...item, use: values[`use-${index}`] === 'on' })), error: ERRORS.nothingChecked };
      return redraw({ focusError: false });
    }
    const ok = await saveJobRecord({ ...job, requirements: list });
    if (!ok) return redraw();
    ui.suggestion = remaining.length === 0 ? null : { ...suggestion, items: remaining, needsManualEntry: false };
    ui.errors = {};
    redraw({ focusError: remaining.length > 0 });
  }

  async function addRequirementByHand(values: Record<string, string>): Promise<void> {
    const job = currentJob();
    if (job === null) return;
    const kind = (values['kind'] ?? 'term') as RequirementKind;
    const importance: Importance = values['importance'] === 'preferred' ? 'preferred' : 'required';
    const years = YEARS_KINDS.has(kind) ? parseYears(values['years']) : undefined;
    if (years === null) return fail({ 'hand-years': ERRORS.yearsTotal }, values);
    if (kind === 'total_experience' && years === undefined) return fail({ 'hand-years': ERRORS.yearsTotal }, values);
    const made = makeRequirement(inputFor(kind, clean(values['label']), importance, years));
    if (!made.ok) return fail({ 'hand-label': made.reason }, values);
    const merged = mergeInto(job.requirements, made.requirement);
    if (!merged.ok) return fail({ 'hand-label': merged.reason }, values);
    if (!(await saveJobRecord({ ...job, requirements: merged.list }))) return redraw();
    ui.drafts = {};
    ui.errors = {};
    redraw();
  }

  async function changeRequirement(id: string, patch: { importance?: Importance; years?: string }): Promise<void> {
    const job = currentJob();
    const current = job?.requirements.find((item) => item.id === id);
    if (job === null || current === undefined) return;
    const years = patch.years === undefined ? current.minYears : parseYears(patch.years);
    delete ui.errors[id];
    if (years === null) {
      ui.errors[id] = ERRORS.yearsTotal;
      return redraw({ focusError: true });
    }
    const made = makeRequirement(inputFor(current.kind, current.label, patch.importance ?? current.importance, years));
    if (!made.ok) {
      ui.errors[id] = made.reason;
      return redraw({ focusError: true });
    }
    const next = made.requirement.id === id ? made.requirement : current;
    const requirements = job.requirements.map((item) => (item.id === id ? { ...next, id } : item));
    await saveJobRecord({ ...job, requirements });
    redraw();
  }

  async function removeRequirement(id: string): Promise<void> {
    const job = currentJob();
    if (job === null) return;
    await saveJobRecord({ ...job, requirements: job.requirements.filter((item) => item.id !== id) });
    delete ui.errors[id];
    redraw();
  }

  async function addExcluded(rawTerm: string): Promise<void> {
    const job = currentJob();
    if (job === null) return;
    const term = clean(rawTerm).replace(/\s+/gu, ' ');
    const values = { excluded: rawTerm };
    if (term === '') return fail({ excluded: ERRORS.excludedEmpty }, values);
    if (term.length > MAX_TERM_CHARS) return fail({ excluded: ERRORS.excludedLong }, values);
    const check = checkTerm(term);
    if (!check.allowed) return fail({ excluded: check.reason }, values);
    if (job.excludedTerms.some((item) => item.toLowerCase() === term.toLowerCase())) return fail({ excluded: ERRORS.excludedDuplicate }, values);
    if (!(await saveJobRecord({ ...job, excludedTerms: [...job.excludedTerms, term] }))) return redraw();
    ui.drafts = {};
    ui.errors = {};
    redraw();
  }

  async function removeExcluded(term: string): Promise<void> {
    const job = currentJob();
    if (job === null) return;
    await saveJobRecord({ ...job, excludedTerms: job.excludedTerms.filter((item) => item !== term) });
    redraw();
  }

  const triage = createTriage({ store, memory: deps.memory, now: deps.now, newId: deps.newId, ui, data: () => data, load, go, redraw, fail });

  const clickRead = createClickReadControl({ store, ui, now: deps.now, load, redraw: () => redraw() });

  const contact = createContactControl({ store, ui, data: () => data, now: deps.now, load, redraw });

  const privacy = createPrivacyControl({ store, memory: deps.memory, ui, now: deps.now, load, go, redraw, ...(deps.wipeSession === undefined ? {} : { wipeSession: deps.wipeSession }) });

  /** Outra janela gravou: relê tudo e confere se o passo atual ainda aponta para algo que existe (RF-93). */
  async function refresh(): Promise<void> {
    // Durante uma análise, o próprio fim dela relê e redesenha.
    if (ui.busy) return;
    await load();
    const step = ui.step;
    const gone =
      ((step.name === 'detail' || step.name === 'confirm_delete_candidate') && !data.candidates.some((item) => item.id === step.candidateId)) ||
      (step.name === 'paste' && step.candidateId !== undefined && !data.candidates.some((item) => item.id === step.candidateId)) ||
      (step.name === 'job_form' && step.jobId !== null && !data.jobs.some((item) => item.id === step.jobId)) ||
      (step.name === 'requirements' && step.jobId !== undefined && !data.jobs.some((item) => item.id === step.jobId)) ||
      ((step.name === 'confirm_delete_job' || step.name === 'confirm_archive_job') && !data.jobs.some((item) => item.id === step.jobId));
    if (gone) {
      ui.analysis = null;
      return go(HOME);
    }
    if (ui.analysis !== null && !data.candidates.some((item) => item.id === ui.analysis?.candidateId)) ui.analysis = null;
    await privacy.refresh();
    redraw();
  }

  const controller: Controller = {
    ui,
    snapshot: () => data,
    messages: () =>
      buildConversation({ settings: data.settings, jobs: data.jobs, activeJob: data.activeJob, step: ui.step, candidates: data.candidates, now: deps.now(), analysis: ui.analysis, filters: ui.filters, report: ui.report, privacy: privacy.input() }),
    go,
    run,
    redraw,
    accept,
    saveSettings,
    saveJob,
    suggestAgain: () => {
      const job = currentJob();
      if (job !== null) startSuggestion(job);
      redraw();
    },
    discardSuggestion: () => {
      ui.suggestion = null;
      redraw();
    },
    applySuggestion,
    addRequirementByHand,
    changeRequirement,
    removeRequirement,
    addExcluded,
    removeExcluded,
    setSearchVersion: (version) => {
      ui.searchVersion = version;
      ui.copyStatus = null;
      redraw();
    },
    setCopyStatus: (status) => {
      ui.copyStatus = status;
      redraw();
    },
    analyzeAndStore: triage.analyzeAndStore,
    submitPaste: triage.submitPaste,
    saveCandidateDetails: triage.saveDetails,
    setFilters: triage.setFilters,
    clearFilters: triage.clearFilters,
    refresh,
    confirmRetention,
    cancelRetention,
    setReport: triage.setReport,
    download: triage.download,
    clickRead,
    contact,
    privacy,
  };

  return { controller, load };
}
