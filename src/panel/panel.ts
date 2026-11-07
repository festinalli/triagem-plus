import { needsAcceptance } from '../core/conversation/build.ts';
import { MEMORY_KEY, parseStoredText } from './text-memory.ts';
import type { TextMemory } from '../core/conversation/analyze-store.ts';
import { PENDING_READ_KEY } from '../core/page-read.ts';
import type { PendingRead } from '../core/page-read.ts';
import { purgeExpired } from '../core/store/retention.ts';
import { createStore } from '../core/store/store.ts';
import { globalChrome } from '../platform/chrome/api.ts';
import { createChromeLocalArea } from '../platform/chrome/storage-area.ts';
import { getSession, onSessionChanged, setSession } from '../platform/chrome/session.ts';
import { createController } from './app.ts';
import { startPendingConsumer } from './click-consume.ts';
import type { Controller } from './app.ts';
import { renderMessage } from './messages.ts';
import { SHELL } from './strings.ts';
import { Button, Notice } from './ui/components.ts';
import { h } from './ui/h.ts';
import { captureFields, restoreFields } from './ui/keep-fields.ts';
import { render } from './ui/render.ts';

const PREVIEW_CHARS = 200;

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`elemento ausente: ${id}`);
  return el;
}

// ---------- o texto da última análise ----------

/** Só o texto da última análise, em chrome.storage.session: some ao fechar o navegador e nunca vai para o armazenamento local (RF-34, RF-45). */
function sessionMemory(): TextMemory {
  const chrome = globalChrome();
  return {
    read: async () => parseStoredText(await getSession(chrome, MEMORY_KEY)),
    write: (value) => setSession(chrome, MEMORY_KEY, value),
    clear: () => chrome.storage.session.remove(MEMORY_KEY),
  };
}

// ---------- a conversa ----------

function jobBar(ctl: Controller): HTMLElement {
  const { activeJob } = ctl.snapshot();
  return h(
    'div',
    { class: 'tr-jobbar', role: 'region', 'aria-label': SHELL.activeJob },
    h('div', { class: 'tr-jobbar__text' }, h('span', { class: 'tr-jobbar__label' }, SHELL.activeJob), h('strong', { class: 'tr-jobbar__title', 'data-testid': 'active-job' }, activeJob === null ? SHELL.noActiveJob : activeJob.title)),
    Button({ label: activeJob === null ? SHELL.createJob : SHELL.switchJob, focusKey: 'jobbar-action', onClick: () => ctl.run({ id: activeJob === null ? 'create_job' : 'show_jobs' }) }),
  );
}

function startConversation(): { ctl: Controller; ready: Promise<void>; store: ReturnType<typeof createStore> } {
  const actions = byId('shell-actions');
  const bar = byId('shell-job');
  const main = byId('messages');

  const store = createStore(createChromeLocalArea());
  const box: { ctl: Controller | null } = { ctl: null };

  const paint = (focus: 'first' | 'error' | 'keep'): void => {
    const ctl = box.ctl;
    if (ctl === null) return;
    const accepted = !needsAcceptance(ctl.snapshot().settings) && !ctl.ui.loadFailed;
    render(actions, () =>
      accepted
        ? h(
            'div',
            { class: 'tr-shell__buttons' },
            Button({ label: SHELL.privacy, focusKey: 'open-privacy', onClick: () => ctl.run({ id: 'open_privacy' }) }),
            Button({ label: SHELL.settings, focusKey: 'open-settings', onClick: () => ctl.go({ name: 'settings' }) }),
          )
        : null,
    );
    render(bar, () => (accepted ? jobBar(ctl) : null));
    render(main, () => {
      if (ctl.ui.loadFailed) return Notice({ tone: 'error', text: SHELL.loadFailed, live: true });
      return [ctl.ui.banner === null ? null : Notice({ tone: 'error', text: ctl.ui.banner, live: true }), ctl.ui.flash === null ? null : Notice({ tone: 'success', text: ctl.ui.flash, live: true }), ...ctl.messages().map((message) => renderMessage(message, ctl))].filter((node): node is HTMLElement => node !== null);
    });
    if (focus === 'first') {
      main.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
      window.scrollTo(0, 0);
    } else if (focus === 'error') {
      main.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  };

  const { controller, load } = createController({ store, memory: sessionMemory(), now: () => Date.now(), newId: () => crypto.randomUUID(), paint, wipeSession: () => globalChrome().storage.session.clear() });
  box.ctl = controller;

  // O prazo vence ao abrir o painel (RF-90). Só a quantidade seria conhecida; nada sobre quem foi apagado vai para a tela.
  const ready = purgeExpired(store, Date.now())
    .catch(() => undefined)
    .then(load)
    .then(() => paint('keep'));
  // Outra janela gravou: relê e redesenha, sem perder o que a pessoa está digitando (RF-93).
  globalChrome().storage.onChanged.addListener((_changes, area) => {
    if (area !== 'local') return;
    const keep = captureFields(main);
    void controller.refresh().then(() => restoreFields(main, keep));
  });

  return { ctl: controller, ready, store };
}

// ---------- construção de prova ----------

function isPending(value: unknown): value is PendingRead {
  return typeof value === 'object' && value !== null && typeof (value as { ok?: unknown }).ok === 'boolean';
}

/** Mostra só a origem do endereço, o tamanho do texto e o começo dele. Sempre textContent. */
function show(value: unknown): void {
  if (!isPending(value)) return;
  const data = byId('proof-data');
  if (!value.ok) {
    byId('proof-status').textContent = value.error;
    data.hidden = true;
    return;
  }
  let origin = 'endereço inválido';
  try {
    origin = new URL(value.read.url).origin;
  } catch {
    // mantém o texto padrão
  }
  byId('proof-status').textContent = 'Página lida.';
  byId('proof-origin').textContent = origin;
  byId('proof-count').textContent = String(value.read.text.length);
  byId('proof-preview').textContent = value.read.text.slice(0, PREVIEW_CHARS);
  data.hidden = false;
}

const started = startConversation();

// Produção recebe a leitura do gesto; a construção de prova só mostra o que foi lido.
if (!__PROOF_BUILD__) {
  // Produção: recebe a leitura do gesto e a manda para a análise (RF-31, RF-34).
  startPendingConsumer(started.ctl, started.ready, () => started.store.getSettings());
} else {
  const chrome = globalChrome();
  byId('proof').hidden = false;
  void getSession(chrome, PENDING_READ_KEY).then(show);
  onSessionChanged(chrome, PENDING_READ_KEY, show);
}
