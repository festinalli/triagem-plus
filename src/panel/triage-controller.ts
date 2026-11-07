// A parte do controlador que cuida da triagem: colar e analisar, tirar da lista, detalhe, filtros e relatório.
// Fala com o armazenamento pelas funções de src/core e guarda só o que vive na memória do painel (RF-69).
// Nada daqui escreve nome, link ou texto de candidato em registro ou em mensagem de erro (RNF-11).
import { analyzeAndStore, removeCandidate } from '../core/conversation/analyze-store.ts';
import type { AnalyzeFailure, AnalyzeInput, AnalyzeOutcome, TextMemory } from '../core/conversation/analyze-store.ts';
import { HOME } from '../core/conversation/build.ts';
import type { Action } from '../core/conversation/build.ts';
import { applyFilters, describeFilters, filtersActive, NO_FILTERS } from '../core/conversation/filters.ts';
import type { CandidateFilters } from '../core/conversation/filters.ts';
import { startsWithHttps } from '../core/conversation/links.ts';
import type { ReportChoice } from '../core/conversation/triage.ts';
import { checkTerm, MAX_TERM_CHARS } from '../core/guard/index.ts';
import { STAGES } from '../core/model.ts';
import type { Band, Stage } from '../core/model.ts';
import { renew } from '../core/store/retention.ts';
import type { Store } from '../core/store/store.ts';
import { buildReportFiles } from './report-files.ts';
import type { ReportFormat } from './report-files.ts';
import type { Snapshot, UiState } from './app.ts';
import { DETAIL, LIST, PASTE_ERRORS, REPORT } from './strings.ts';
import { startDownload } from './ui/download-link.ts';

/** Versão do texto do aviso de arquivo (RF-73). Se subir, o aceite é pedido de novo. */
export const FILE_EXPORT_VERSION = 1;

const MAX_NOTES_CHARS = 5000;
const MAX_YEARS = 60;
const BANDS: readonly Band[] = ['strong', 'partial', 'weak'];

export interface TriageContext {
  readonly store: Store;
  readonly memory: TextMemory;
  readonly now: () => number;
  readonly newId: () => string;
  readonly ui: UiState;
  readonly data: () => Snapshot;
  readonly load: () => Promise<void>;
  readonly go: (step: UiState['step'], flash?: string | null) => void;
  readonly redraw: (options?: { focusError?: boolean }) => void;
  readonly fail: (errors: Record<string, string>, values: Record<string, string>) => void;
}

export interface TriageController {
  /** Analisa o texto e põe a pessoa na lista da vaga ativa, sem outro clique. Serve ao colar e ao clique (source 'clicked'). */
  analyzeAndStore(input: AnalyzeInput): Promise<AnalyzeOutcome>;
  submitPaste(values: Record<string, string>): Promise<void>;
  /** Trata os botões da triagem. Falso quando o botão não é daqui. */
  run(action: Action): boolean;
  saveDetails(candidateId: string, values: Record<string, string>): Promise<void>;
  setFilters(values: Record<string, string>): void;
  clearFilters(): void;
  setReport(patch: Partial<Pick<ReportChoice, 'scope' | 'includeNotes'>>): void;
  download(format: ReportFormat): Promise<void>;
}

function clean(text: string | undefined): string {
  return (text ?? '').replace(/\p{Cs}/gu, '').trim();
}

const FAILURE_FIELD: Readonly<Record<AnalyzeFailure, { field: string; text: string }>> = {
  no_acceptance: { field: 'text', text: PASTE_ERRORS.noAcceptance },
  no_job: { field: 'text', text: PASTE_ERRORS.noJob },
  no_requirements: { field: 'text', text: PASTE_ERRORS.noRequirements },
  empty_text: { field: 'text', text: PASTE_ERRORS.text },
  nothing_read: { field: 'text', text: PASTE_ERRORS.nothingRead },
  bad_url: { field: 'url', text: PASTE_ERRORS.urlHttps },
  no_name: { field: 'name', text: PASTE_ERRORS.name },
  save_failed: { field: 'text', text: PASTE_ERRORS.saveFailed },
};

/** Grava o aceite do aviso de arquivo, se ainda não existe. Verdadeiro quando gravou agora. Serve ao PDF e à exportação em JSON. */
export async function acceptFileExport(store: Store, now: number): Promise<boolean> {
  const current = await store.getSettings();
  if (current.acceptances.fileExport !== undefined) return false;
  await store.updateSettings({ acceptances: { ...current.acceptances, fileExport: { version: FILE_EXPORT_VERSION, at: now } } });
  return true;
}

export function createTriage(ctx: TriageContext): TriageController {
  const { store, ui } = ctx;

  // Uma análise de cada vez: duas ao mesmo tempo da mesma pessoa criariam dois registros (RF-64).
  let queue: Promise<unknown> = Promise.resolve();

  function analyze(input: AnalyzeInput): Promise<AnalyzeOutcome> {
    const next = queue.then(() => analyzeNow(input));
    queue = next.catch(() => undefined);
    return next;
  }

  async function analyzeNow(input: AnalyzeInput): Promise<AnalyzeOutcome> {
    const outcome = await analyzeAndStore({ store, memory: ctx.memory, now: ctx.now, newId: ctx.newId }, input);
    if (!outcome.ok) return outcome;
    await ctx.load();
    ui.analysis = { candidateId: outcome.candidateId, updated: outcome.updated, addedNothing: outcome.addedNothing, notProfileLink: outcome.notProfileLink };
    ctx.go(HOME);
    return outcome;
  }

  async function submitPaste(values: Record<string, string>): Promise<void> {
    const errors: Record<string, string> = {};
    const text = values['text'] ?? '';
    const url = clean(values['url']);
    if (text.trim() === '') errors['text'] = PASTE_ERRORS.text;
    if (url === '') errors['url'] = PASTE_ERRORS.url;
    else if (!startsWithHttps(url)) errors['url'] = PASTE_ERRORS.urlHttps;
    if (Object.keys(errors).length > 0) return ctx.fail(errors, values);
    // Repetição do clique é ignorada, e o botão fica desligado enquanto analisa.
    if (ui.busy) return;
    ui.busy = true;
    ui.drafts = values;
    ctx.redraw();
    try {
      // A vaga mostrada precisa ser a guardada: se outra janela trocou a vaga ativa, avisa em vez de analisar na errada.
      const shown = ctx.data().activeJob?.id ?? null;
      await ctx.load();
      if ((ctx.data().activeJob?.id ?? null) !== shown) {
        ui.banner = PASTE_ERRORS.jobChanged;
        ui.drafts = values;
        return;
      }
      const adding = ui.step.name === 'paste' ? ui.step.candidateId : undefined;
      const outcome = await analyze({ text, url, name: values['name'] ?? '', source: 'pasted', ...(adding === undefined ? {} : { candidateId: adding }) });
      if (!outcome.ok) {
        const failure = FAILURE_FIELD[outcome.reason];
        ctx.fail({ [failure.field]: failure.text }, values);
      }
    } finally {
      ui.busy = false;
      ctx.redraw();
    }
  }

  async function leave(candidateId: string, flash: string): Promise<void> {
    const ok = await removeCandidate({ store, memory: ctx.memory }, candidateId);
    if (!ok) {
      ui.banner = DETAIL.saveFailed;
      return ctx.redraw();
    }
    ui.analysis = null;
    await ctx.load();
    ctx.go(HOME, flash);
  }

  function run(action: Action): boolean {
    const id = action.candidateId;
    switch (action.id) {
      case 'open_paste':
        ctx.go({ name: 'paste' });
        return true;
      case 'add_more_text':
        ctx.go(id === undefined ? { name: 'paste' } : { name: 'paste', candidateId: id });
        return true;
      case 'show_detail':
        if (id !== undefined) ctx.go({ name: 'detail', candidateId: id });
        return true;
      case 'show_all':
        ctx.go({ name: 'list' });
        return true;
      case 'open_report':
        ctx.go({ name: 'report' });
        return true;
      case 'remove_from_list':
        if (id !== undefined) void leave(id, DETAIL.removed);
        return true;
      case 'delete_candidate':
        if (id !== undefined) ctx.go({ name: 'confirm_delete_candidate', candidateId: id });
        return true;
      case 'confirm_delete_candidate':
        if (id !== undefined) void leave(id, DETAIL.deleted);
        return true;
      case 'renew_candidate':
        if (id !== undefined) {
          void renew(store, id, ctx.now())
            .then(() => ctx.load())
            .then(() => {
              ui.flash = DETAIL.renewed;
              ctx.redraw();
            })
            .catch(() => {
              ui.banner = DETAIL.saveFailed;
              ctx.redraw();
            });
        }
        return true;
      default:
        return false;
    }
  }

  async function saveDetails(candidateId: string, values: Record<string, string>): Promise<void> {
    // Só atualiza quem ainda existe: outra janela pode ter apagado a pessoa (RF-93, RF-37).
    const current = await store.getCandidate(candidateId).catch(() => null);
    if (current === null) {
      ui.analysis = null;
      await ctx.load();
      ctx.go(HOME);
      ui.banner = DETAIL.gone;
      return ctx.redraw();
    }
    const stage = STAGES.find((item) => item === values['stage']) ?? current.stage;
    const notes = (values['notes'] ?? '').replace(/\p{Cs}/gu, '');
    if (notes.length > MAX_NOTES_CHARS) return ctx.fail({ notes: DETAIL.notesTooLong }, values);
    try {
      await store.saveCandidate({ ...current, stage: stage as Stage, favorite: values['favorite'] === 'on', notes });
      await ctx.load();
      ui.errors = {};
      ui.drafts = {};
      ui.flash = DETAIL.saved;
    } catch {
      ui.banner = DETAIL.saveFailed;
    }
    ctx.redraw();
  }

  function setFilters(values: Record<string, string>): void {
    const errors: Record<string, string> = {};
    const term = clean(values['term']).replace(/\s+/gu, ' ').slice(0, MAX_TERM_CHARS);
    if (term !== '') {
      const check = checkTerm(term);
      if (!check.allowed) errors['term'] = check.reason;
    }
    const yearsText = clean(values['minYears']);
    let minYears: number | null = null;
    if (yearsText !== '') {
      if (/^\d{1,2}$/u.test(yearsText) && Number(yearsText) <= MAX_YEARS) minYears = Number(yearsText);
      else errors['minYears'] = LIST.years;
    }
    if (Object.keys(errors).length > 0) return ctx.fail(errors, values);
    const band = BANDS.find((item) => item === values['band']) ?? 'any';
    const stage = STAGES.find((item) => item === values['stage']) ?? 'any';
    const filters: CandidateFilters = { term, minYears, band, stage, favoriteOnly: values['favoriteOnly'] === 'on', allRequired: values['allRequired'] === 'on' };
    ui.filters = filters;
    ui.errors = {};
    ui.drafts = {};
    ctx.redraw();
  }

  function clearFilters(): void {
    ui.filters = NO_FILTERS;
    ui.errors = {};
    ui.drafts = {};
    ctx.redraw();
  }

  function setReport(patch: Partial<Pick<ReportChoice, 'scope' | 'includeNotes'>>): void {
    ui.report = { ...ui.report, ...patch, replacedCount: null };
    ctx.redraw();
  }

  /** Aceite do aviso de arquivo, uma vez só (RF-73). Depois disso o aviso fica visível junto do botão. */
  async function ensureExportAccepted(): Promise<void> {
    if (await acceptFileExport(store, ctx.now())) await ctx.load();
  }

  async function download(format: ReportFormat): Promise<void> {
    const job = ctx.data().activeJob;
    if (job === null) return;
    try {
      await ensureExportAccepted();
      const candidates = ctx.data().candidates;
      const filtered = ui.report.scope !== 'top10' && filtersActive(ui.filters);
      const chosen = ui.report.scope === 'top10' ? candidates : applyFilters(candidates, job, ui.filters);
      const file = buildReportFiles({
        job,
        candidates: chosen,
        scope: ui.report.scope === 'top10' ? 'top10' : 'all',
        includeNotes: ui.report.includeNotes,
        now: ctx.now(),
        format,
        ...(filtered ? { allCount: candidates.length, filterTexts: describeFilters(ui.filters) } : {}),
      });
      startDownload(file.blob, file.name);
      ui.report = { ...ui.report, replacedCount: file.replacedCount };
      ui.banner = null;
      ui.flash = REPORT.done;
    } catch {
      ui.banner = REPORT.failed;
    }
    ctx.redraw();
  }

  return { analyzeAndStore: analyze, submitPaste, run, saveDetails, setFilters, clearFilters, setReport, download };
}
