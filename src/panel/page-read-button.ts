// O botão "Ler esta página" (D-10, RF-25): faz no painel o mesmo que o gesto do botão direito. Lê a aba aberta da janela do
// painel, uma vez, só quando a pessoa clica. Nada é rolado, clicado ou aberto (RF-23). A leitura vai para o mesmo caminho do
// gesto (handlePending), sem passar pela sessão. Nada de nome, endereço ou texto vai para console ou mensagem (RNF-11).
import { clickReadActive, decideGesture, MESSAGES } from '../background/gesture.ts';
import { readPage } from '../background/read-page.ts';
import { readResults } from '../background/read-results.ts';
import type { PageRead, PendingRead } from '../core/page-read.ts';
import type { ResultsRead } from '../core/results/parse.ts';
import { globalChrome } from '../platform/chrome/api.ts';
import { requestLinkedInAccess } from '../platform/chrome/permissions.ts';
import { runInTab } from '../platform/chrome/scripting.ts';
import type { Controller } from './app.ts';
import { handlePending, say } from './click-consume.ts';
import { CLICK_MESSAGES, PAGE_BUTTON } from './click-strings.ts';

/** Na construção de prova, o painel só mostra a contagem do gesto: o botão não aparece lá. */
export const PAGE_BUTTON_AVAILABLE = !(typeof __PROOF_BUILD__ !== 'undefined' && __PROOF_BUILD__);

export interface OpenTab {
  readonly id?: number;
  readonly url?: string;
}

export interface PanelReadDeps {
  /** O pedido de permissão, já feito no clique. */
  readonly access: Promise<boolean>;
  readonly activeTab: () => Promise<OpenTab | undefined>;
  readonly readResults: (tabId: number) => Promise<ResultsRead | undefined>;
  readonly readProfile: (tabId: number) => Promise<PageRead | undefined>;
  readonly now: () => number;
}

/** Lê a aba aberta e devolve a leitura no mesmo formato do gesto. Só a busca de pessoas e o perfil do LinkedIn são lidos. */
export async function readOpenTab(deps: PanelReadDeps): Promise<PendingRead> {
  const at = deps.now();
  const failed: PendingRead = { ok: false, error: MESSAGES.failed, at };
  if (!(await deps.access.catch(() => false))) return { ok: false, error: PAGE_BUTTON.noAccess, at };
  const tab = await deps.activeTab().catch(() => undefined);
  if (tab?.id === undefined) return failed;
  const decision = decideGesture({ enabled: true, tabUrl: tab.url });
  if (decision !== 'read' && decision !== 'read_results') return { ok: false, error: PAGE_BUTTON.notLinkedIn, at };
  try {
    if (decision === 'read_results') {
      const results = await deps.readResults(tab.id);
      return results === undefined ? failed : { ok: true, results, at };
    }
    const read = await deps.readProfile(tab.id);
    return read === undefined ? failed : { ok: true, read, at };
  } catch (e) {
    return e instanceof Error && e.message.includes('Cannot access') ? { ok: false, error: MESSAGES.blocked, at } : failed;
  }
}

let reading = false;

/** O clique no botão. Repetir o clique enquanto lê não faz nada. */
export function readThisPage(ctl: Controller): void {
  if (reading) return;
  if (!clickReadActive(ctl.snapshot().settings)) return say(ctl, MESSAGES.off);
  const chrome = globalChrome();
  // O Chrome só mostra o pedido de permissão durante o clique: ele vem antes de qualquer espera.
  const access = requestLinkedInAccess(chrome);
  reading = true;
  void readOpenTab({
    access,
    activeTab: async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0],
    readResults: (tabId) => runInTab<[], ResultsRead>(chrome, tabId, readResults, []),
    readProfile: (tabId) => runInTab<[boolean], PageRead>(chrome, tabId, readPage, [false]),
    now: () => Date.now(),
  })
    .then((pending) => handlePending(ctl, pending))
    .catch(() => say(ctl, CLICK_MESSAGES.readError))
    .finally(() => {
      reading = false;
    });
}
