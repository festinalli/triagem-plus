import { PENDING_READ_KEY } from '../core/page-read.ts';
import { purgeExpired } from '../core/store/retention.ts';
import { createStore } from '../core/store/store.ts';
import type { PageRead, PendingRead } from '../core/page-read.ts';
import { globalChrome } from '../platform/chrome/api.ts';
import { setPageMenuItem } from '../platform/chrome/context-menus.ts';
import type { PageMenuItem } from '../platform/chrome/context-menus.ts';
import { runInTab } from '../platform/chrome/scripting.ts';
import { openPanelOnActionClick, openSidePanel } from '../platform/chrome/side-panel.ts';
import { setSession } from '../platform/chrome/session.ts';
import { createChromeLocalArea } from '../platform/chrome/storage-area.ts';
import { clickReadActive, decideGesture, MESSAGES } from './gesture.ts';
import { readPage } from './read-page.ts';

const chrome = globalChrome();
const store = createStore(createChromeLocalArea());

const MENU_ID = 'analyze-profile';
const PROFILE_ITEM: PageMenuItem = { id: MENU_ID, title: 'Analisar este perfil com a Triagem+', patterns: ['https://www.linkedin.com/in/*'] };
// Só na construção de prova: qualquer página, para provar o gesto fora do LinkedIn.
const PROOF_ITEM: PageMenuItem = { id: MENU_ID, title: 'Analisar esta página com a Triagem+', patterns: ['http://*/*', 'https://*/*'] };

// Ao abrir o navegador, apaga quem passou do prazo de guarda (RF-90). Sem permissão de alarme. Nada de nome vai para o console (RNF-11).
chrome.runtime.onStartup.addListener(() => {
  void purgeExpired(store, Date.now()).catch(() => undefined);
});

// Clicar no ícone abre o painel.
void openPanelOnActionClick(chrome).catch(() => undefined);

// ---------- o item do menu: existe só com a leitura por clique ligada (RF-32, DP-20) ----------

let menuQueue: Promise<void> = Promise.resolve();

async function syncMenu(): Promise<void> {
  if (__PROOF_BUILD__) return setPageMenuItem(chrome, PROOF_ITEM);
  let active = false;
  try {
    active = clickReadActive(await store.getSettings());
  } catch {
    active = false;
  }
  return setPageMenuItem(chrome, active ? PROFILE_ITEM : null);
}

/** Uma sincronização por vez, para duas mudanças seguidas não deixarem o menu pela metade. */
function scheduleMenuSync(): void {
  menuQueue = menuQueue.then(syncMenu, syncMenu);
}

chrome.runtime.onInstalled.addListener(scheduleMenuSync);
chrome.runtime.onStartup.addListener(scheduleMenuSync);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['settings'] !== undefined) scheduleMenuSync();
});

// ---------- o gesto ----------

async function readTab(tabId: number): Promise<PendingRead> {
  try {
    // Uma vez, só a página principal, sem tentar de novo (RF-33). A função enviada à página é só leitura.
    const read = await runInTab<[boolean], PageRead>(chrome, tabId, readPage, [__PROOF_BUILD__]);
    return read === undefined ? { ok: false, error: MESSAGES.failed, at: Date.now() } : { ok: true, read, at: Date.now() };
  } catch (e) {
    const blocked = e instanceof Error && e.message.includes('Cannot access');
    return { ok: false, error: blocked ? MESSAGES.blocked : MESSAGES.failed, at: Date.now() };
  }
}

async function decideAndRead(tab: chrome.tabs.Tab | undefined): Promise<PendingRead> {
  const tabId = tab?.id;
  if (tabId === undefined) return { ok: false, error: MESSAGES.failed, at: Date.now() };
  if (__PROOF_BUILD__) return readTab(tabId);
  let enabled = false;
  try {
    enabled = clickReadActive(await store.getSettings());
  } catch {
    enabled = false;
  }
  const decision = decideGesture({ enabled, tabUrl: tab?.url });
  if (decision === 'off') return { ok: false, error: MESSAGES.off, at: Date.now() };
  if (decision === 'not_profile') return { ok: false, error: MESSAGES.notProfile, at: Date.now() };
  return readTab(tabId);
}

/**
 * Gesto de leitura. O painel abre na hora, antes de qualquer await, porque isso depende do gesto; abrir o painel é
 * inofensivo. Só depois se confere se a leitura está ligada e se a aba é um perfil. Nada de texto, nome ou endereço vai
 * para o console (RNF-11).
 */
function handleGesture(tab: chrome.tabs.Tab | undefined): void {
  const tabId = tab?.id;
  const opened = tabId === undefined ? undefined : openSidePanel(chrome, tabId).catch(() => undefined);
  void (async () => {
    const pending = await decideAndRead(tab);
    await opened;
    // A janela do gesto vai junto: só o painel dela consome a leitura (RF-64).
    const windowId = tab?.windowId;
    await setSession(chrome, PENDING_READ_KEY, windowId === undefined ? pending : { ...pending, windowId }).catch(() => undefined);
  })();
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) handleGesture(tab);
});
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'analyze-profile') handleGesture(tab);
});
