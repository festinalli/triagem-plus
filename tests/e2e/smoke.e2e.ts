// Fumaça: a extensão carrega, o service worker vive, o painel abre sem erro, e a sessão inteira não faz pedido de
// rede para fora (RNF-01, CA-17). O controle positivo prova que o registrador pega um pedido quando ele existe.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT, launch, openPanel } from './harness.ts';
import type { Harness } from './harness.ts';

const DIST = path.join(ROOT, 'dist');
const DIST_PROOF = path.join(ROOT, 'dist-prova');

interface NetLogEvent {
  type: number;
  params?: Record<string, unknown>;
}

/** Pedidos que não são de rede: recursos da própria extensão e esquemas locais. */
const isLocalScheme = (url: string) => /^(chrome-extension|data|blob|about|chrome|devtools):/i.test(url);

/** Pedidos de páginas da extensão ou do service worker para qualquer coisa que não seja recurso local. */
function extensionRequests(h: Harness) {
  return h.requests.filter((r) => (r.origin === 'service-worker' || r.origin.startsWith('chrome-extension://')) && !isLocalScheme(r.url));
}

/** Pedidos de rede do net-log que têm a extensão como iniciadora. Os do próprio navegador não entram. */
function netLogExtensionJobs(rawLog: string) {
  const log = JSON.parse(rawLog) as { constants: { logEventTypes: Record<string, number> }; events: NetLogEvent[] };
  const startJob = log.constants.logEventTypes.URL_REQUEST_START_JOB;
  const jobs = log.events
    .filter((e) => e.type === startJob && typeof e.params?.url === 'string')
    .map((e) => ({ url: String(e.params?.url), initiator: String(e.params?.initiator ?? ''), key: String(e.params?.network_isolation_key ?? '') }));
  const fromExtension = jobs.filter(
    (j) => /^(https?|wss?|ftp):/i.test(j.url) && (j.initiator.includes('chrome-extension://') || j.key.includes('chrome-extension://')),
  );
  return { jobs, fromExtension };
}

describe('smoke da extensão (dist/)', { timeout: 120_000 }, () => {
  let h: Harness;
  before(async () => {
    h = await launch(DIST);
  });
  after(async () => {
    await (h as Harness | undefined)?.close();
  });

  test('carrega, o service worker vive e o painel abre sem erro de console', async () => {
    assert.match(h.extensionId, /^[a-p]{32}$/);
    assert.equal(await h.worker.evaluate(() => chrome.runtime.getManifest().name), 'Triagem+');
    const { page, errors } = await openPanel(h);
    assert.equal(await page.locator('h1').textContent(), 'Triagem+');
    assert.equal(await page.locator('#proof').isVisible(), false, 'a produção não mostra a leitura de prova');
    await page.waitForTimeout(500);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('a produção tem o gesto, mas sem a leitura ligada não existe item de menu', async () => {
    // Os ouvintes existem (o atalho precisa de um); o que faz o gesto agir é a leitura estar ligada em Ajustes (F09).
    const state = await h.worker.evaluate(
      () =>
        new Promise<{ menu: boolean; command: boolean; itemExists: boolean }>((resolve) => {
          const menu = chrome.contextMenus.onClicked.hasListeners();
          const command = chrome.commands.onCommand.hasListeners();
          chrome.contextMenus.update('analyze-profile', {}, () => resolve({ menu, command, itemExists: chrome.runtime.lastError === undefined }));
        }),
    );
    assert.deepEqual(state, { menu: true, command: true, itemExists: false });
  });

  test('o CSP da extensão bloqueia uma conexão do painel', async () => {
    const { page } = await openPanel(h);
    const outcome = await page.evaluate((url) => fetch(url + 'da-extensao').then(() => 'passou', () => 'bloqueado'), h.controlUrl);
    assert.equal(outcome, 'bloqueado');
    await page.close();
  });

  test('controle positivo: o registrador pega um pedido de uma página comum', async () => {
    const page = await h.context.newPage();
    await page.goto(h.controlUrl);
    await page.evaluate((url) => fetch(url + 'controle').then((r) => r.text()), h.controlUrl);
    await page.close();
    const seen = h.requests.find((r) => r.url === h.controlUrl + 'controle');
    assert.ok(seen, 'o registrador não viu o pedido do controle');
    assert.equal(seen.origin, h.controlUrl);
    assert.ok(h.serverHits.includes('/controle'), 'o servidor local não recebeu o pedido do controle');
  });

  test('rede zero: nenhum pedido de páginas da extensão ou do service worker sai dela', () => {
    assert.deepEqual(extensionRequests(h), []);
    // O servidor local só viu a página de controle e o pedido dela, nunca o fetch bloqueado do painel.
    assert.ok(!h.serverHits.includes('/da-extensao'));
    assert.ok(
      h.requests.some((r) => r.url.startsWith('chrome-extension://')),
      'o registrador não viu nem os recursos da extensão',
    );
  });

  test('rede zero no navegador inteiro (net-log): nenhum pedido tem a extensão como iniciadora', async () => {
    const { jobs, fromExtension } = netLogExtensionJobs(await h.close());
    // Controle positivo no net-log: o pedido da página local de controle aparece, com ela como iniciadora.
    const control = jobs.find((j) => j.url === h.controlUrl + 'controle');
    assert.ok(control, 'o net-log não registrou o pedido do controle');
    assert.ok(control.initiator.startsWith('http://127.0.0.1'), control.initiator);
    assert.deepEqual(fromExtension, []);
  });
});

describe('a construção de prova (dist-prova/) carrega e o painel mostra a leitura', { timeout: 120_000 }, () => {
  let h: Harness;
  before(async () => {
    h = await launch(DIST_PROOF);
  });
  after(async () => {
    await (h as Harness | undefined)?.close();
  });

  test('o gesto está ligado e o painel mostra origem, tamanho e começo do texto via textContent', async () => {
    const hasListeners = await h.worker.evaluate(() => ({
      menu: chrome.contextMenus.onClicked.hasListeners(),
      command: chrome.commands.onCommand.hasListeners(),
    }));
    assert.deepEqual(hasListeners, { menu: true, command: true });
    const itemExists = await h.worker.evaluate(
      () => new Promise<boolean>((resolve) => chrome.contextMenus.update('analyze-profile', {}, () => resolve(chrome.runtime.lastError === undefined))),
    );
    assert.equal(itemExists, true, 'na prova o item existe sem ligar nada');

    const { page, errors } = await openPanel(h);
    assert.equal(await page.locator('#proof').isVisible(), true);
    const text = '<img src=x onerror=alert(1)>' + 'a'.repeat(300);
    await h.worker.evaluate(
      (value) => chrome.storage.session.set({ pendingRead: { ok: true, at: 1, read: { text: value, url: 'https://exemplo.test/a/b?q=1', title: 't' } } }),
      text,
    );
    await page.locator('#proof-count').filter({ hasText: String(text.length) }).waitFor();
    assert.equal(await page.locator('#proof-origin').textContent(), 'https://exemplo.test');
    assert.equal(await page.locator('#proof-preview').textContent(), text.slice(0, 200));
    assert.equal(await page.locator('#proof-preview img').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('erro de leitura aparece como mensagem simples', async () => {
    const { page } = await openPanel(h);
    await h.worker.evaluate(() => chrome.storage.session.set({ pendingRead: { ok: false, at: 2, error: 'A Triagem+ não pode ler esta página.' } }));
    await page.getByText('A Triagem+ não pode ler esta página.').waitFor();
    await page.close();
  });
});

describe('controle do detector: um pedido que sai de uma página da extensão é pego', { timeout: 120_000 }, () => {
  test('uma imagem pedida pelo painel (o CSP não cobre img-src) aparece no registrador e no net-log', async () => {
    const h = await launch(DIST);
    try {
      const { page } = await openPanel(h);
      await page.evaluate(
        (url) => new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = url + 'imagem-da-extensao';
        }),
        h.controlUrl,
      );
      await page.close();
      assert.ok(extensionRequests(h).some((r) => r.url.endsWith('/imagem-da-extensao')), 'o registrador não pegou o pedido da extensão');
      assert.ok(h.serverHits.includes('/imagem-da-extensao'));
      const { fromExtension } = netLogExtensionJobs(await h.close());
      assert.ok(fromExtension.some((j) => j.url.endsWith('/imagem-da-extensao')), 'o net-log não atribuiu o pedido à extensão');
    } finally {
      await h.close();
    }
  });
});
