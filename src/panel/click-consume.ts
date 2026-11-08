// Recebe a leitura feita pelo gesto (chrome.storage.session, chave pendingRead): lê, apaga na hora e manda para a análise
// com source 'clicked'. O painel nunca lê página nenhuma; só recebe o que o service worker deixou. Nada de nome, endereço ou
// texto vai para console ou para mensagem de erro (RNF-11).
import { nameFromTitle, PENDING_READ_KEY, PENDING_READ_MAX_AGE_MS } from '../core/page-read.ts';
import { clickReadActive } from '../background/gesture.ts';
import type { Settings } from '../core/model.ts';
import type { PageRead, PendingRead } from '../core/page-read.ts';
import type { AnalyzeFailure, AnalyzeOutcome } from '../core/conversation/analyze-store.ts';
import { HOME } from '../core/conversation/build.ts';
import { globalChrome } from '../platform/chrome/api.ts';
import { getSession, onSessionChanged, removeSession } from '../platform/chrome/session.ts';
import type { Controller } from './app.ts';
import { CLICK_MESSAGES } from './click-strings.ts';

function isRawResult(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['href'] === 'string' && typeof v['name'] === 'string' && typeof v['text'] === 'string';
}

export function isPendingRead(value: unknown): value is PendingRead {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['ok'] === false) return typeof v['error'] === 'string';
  if (v['ok'] !== true) return false;
  const results = v['results'] as Record<string, unknown> | null | undefined;
  if (typeof results === 'object' && results !== null) return typeof results['url'] === 'string' && Array.isArray(results['items']) && results['items'].every(isRawResult);
  const read = v['read'] as Record<string, unknown> | null | undefined;
  return typeof read === 'object' && read !== null && typeof read['text'] === 'string' && typeof read['url'] === 'string' && typeof read['title'] === 'string';
}

const FAILURE_TEXT: Readonly<Record<AnalyzeFailure, string>> = {
  no_acceptance: CLICK_MESSAGES.needAcceptance,
  no_job: CLICK_MESSAGES.needJob,
  no_requirements: CLICK_MESSAGES.needRequirements,
  empty_text: CLICK_MESSAGES.emptyText,
  nothing_read: CLICK_MESSAGES.nothingRead,
  bad_url: CLICK_MESSAGES.badUrl,
  no_name: CLICK_MESSAGES.noName,
  save_failed: CLICK_MESSAGES.saveFailed,
};

/** Mostra o motivo na conversa, voltando ao início. A conversa já orienta (sem vaga, sem requisitos, sem aceite). */
export function say(ctl: Controller, text: string): void {
  ctl.go(HOME);
  ctl.ui.banner = text;
  ctl.redraw();
}

/**
 * O nome do leitor tem prioridade; sem ele, o título da aba; sem ele, a conversa pede o nome (o texto fica só no rascunho da tela).
 * `candidateId`: a pessoa da lista que o botão Próximo perfil abriu (D-11), para somar a ela mesmo se o link mudou. Verdadeiro
 * quando a pessoa foi guardada.
 */
export async function analyzeRead(ctl: Controller, read: PageRead, candidateId?: string): Promise<boolean> {
  const base = { text: read.text, url: read.url, source: 'clicked' as const, ...(candidateId === undefined ? {} : { candidateId }) };
  let outcome: AnalyzeOutcome = await ctl.analyzeAndStore({ ...base, name: null });
  if (!outcome.ok && outcome.reason === 'no_name') {
    const fromTitle = nameFromTitle(read.title);
    if (fromTitle !== '') outcome = await ctl.analyzeAndStore({ ...base, name: fromTitle });
  }
  if (outcome.ok) return true;
  if (outcome.reason === 'no_name') {
    ctl.go({ name: 'paste' });
    ctl.ui.drafts = { text: read.text, url: read.url, name: '' };
    ctl.ui.errors = { name: CLICK_MESSAGES.noName };
    ctl.redraw({ focusError: true });
    return false;
  }
  say(ctl, FAILURE_TEXT[outcome.reason]);
  return false;
}

export async function handlePending(ctl: Controller, value: PendingRead): Promise<void> {
  if (!value.ok) return say(ctl, value.error);
  if ('results' in value) {
    const outcome = await ctl.analyzeResults(value.results.items);
    if (!outcome.ok) {
      const text = outcome.reason === 'nothing_read' ? CLICK_MESSAGES.noPeople : outcome.reason === 'no_listing_requirement' ? CLICK_MESSAGES.noListingRequirement : FAILURE_TEXT[outcome.reason];
      say(ctl, text);
    }
    return;
  }
  await analyzeRead(ctl, value.read);
}

/** O que o painel faz com um pendingRead que viu (RF-64, RF-32). */
export type PendingVerdict = 'take' | 'ignore' | 'drop';

/**
 * Decide sem efeito colateral. `take`: é desta janela, é recente e a leitura está ligada. `drop`: não vale (mais de 2 minutos,
 * ou leitura de página com a opção desligada) e qualquer painel pode apagar. `ignore`: é de outra janela ou não tem a forma
 * esperada, e fica onde está.
 */
export function judgePending(value: unknown, context: { windowId: number | undefined; now: number; clickReadOn: boolean }): PendingVerdict {
  if (!isPendingRead(value)) return 'ignore';
  if (context.now - value.at > PENDING_READ_MAX_AGE_MS) return 'drop';
  if (value.ok && !context.clickReadOn) return 'drop';
  if (value.windowId !== undefined && context.windowId !== undefined && value.windowId !== context.windowId) return 'ignore';
  return 'take';
}

export interface ConsumerDeps {
  readonly get: () => Promise<unknown>;
  readonly remove: () => Promise<void>;
  /** Avisa a cada mudança da chave. */
  readonly watch: (listener: (value: unknown) => void) => void;
  /** A janela deste painel. Indefinida se não der para saber. */
  readonly windowId: () => Promise<number | undefined>;
  readonly now: () => number;
  readonly clickReadOn: () => Promise<boolean>;
}

/**
 * Consome o pendingRead ao abrir e a cada mudança. Cada leitura é tratada uma vez: a chave é apagada antes de analisar,
 * e as leituras entram numa fila, uma de cada vez. Só o painel da janela do gesto consome. `ready` espera o painel terminar
 * de carregar os dados.
 */
export function createPendingConsumer(ctl: Controller, ready: Promise<void>, deps: ConsumerDeps): { start(): void } {
  let queue: Promise<void> = ready;
  const seen = new Set<number>();

  const take = (value: unknown): void => {
    if (!isPendingRead(value) || seen.has(value.at)) return;
    queue = queue.then(async () => {
      const verdict = judgePending(value, { windowId: await deps.windowId().catch(() => undefined), now: deps.now(), clickReadOn: await deps.clickReadOn().catch(() => false) });
      if (verdict === 'ignore') return;
      if (seen.has(value.at)) return;
      seen.add(value.at);
      await deps.remove().catch(() => undefined);
      if (verdict === 'drop') return;
      await handlePending(ctl, value).catch(() => say(ctl, CLICK_MESSAGES.readError));
    });
  };

  return {
    start: () => {
      void ready.then(async () => take(await deps.get().catch(() => undefined)));
      deps.watch(take);
    },
  };
}

export function startPendingConsumer(ctl: Controller, ready: Promise<void>, settings: () => Promise<Pick<Settings, 'clickReadEnabled' | 'acceptances'>>): void {
  const chrome = globalChrome();
  createPendingConsumer(ctl, ready, {
    get: () => getSession(chrome, PENDING_READ_KEY),
    remove: () => removeSession(chrome, PENDING_READ_KEY),
    watch: (listener) => onSessionChanged(chrome, PENDING_READ_KEY, listener),
    windowId: async () => (await chrome.windows.getCurrent()).id,
    now: () => Date.now(),
    clickReadOn: async () => clickReadActive(await settings()),
  }).start();
}
