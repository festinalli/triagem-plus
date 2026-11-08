// F09 no Chromium: leitura por clique desligada de fábrica, aviso e aceite para ligar, item do menu que existe só com ela
// ligada (CA-19), painel que consome a leitura deixada pelo gesto, e a função de leitura numa página simulada.
// O gesto de verdade (botão direito e atalho) não dá para automatizar: é o roteiro manual CA-20/CA-21.
// Nenhum teste acessa o LinkedIn: o endereço de perfil é uma página simulada com context.route(...).fulfill, sem rede real,
// com dados inventados.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Page } from 'playwright';
import { readPage } from '../../src/background/read-page.ts';
import { ROOT, extensionRequests, launch, netLogExtensionJobs, openPanel, readSession, readStorage, resetSession, resetStorage } from './harness.ts';
import type { Harness } from './harness.ts';
import { profile, profileUrl, seedWorkspace } from './panel-triage-kit.ts';

const DIST = path.join(ROOT, 'dist');
const MENU_ID = 'analyze-profile';

let h: Harness;
/** Endereços de linkedin.com que o navegador tentou abrir: só as páginas simuladas, nunca a rede. */
const simulatedHits: string[] = [];

const PROFILE_ADDRESS = profileUrl('ficticia');

function simulatedProfile(lines: readonly string[]): string {
  const body = lines.map((line) => `<div>${line === '' ? '&nbsp;' : line}</div>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>(3) Clara Fictícia Exemplo | LinkedIn</title></head><body><header>BARRA-INVENTADA</header><main>${body}</main><aside>Pessoas que talvez você conheça LATERAL-INVENTADA</aside></body></html>`;
}

before(async () => {
  h = await launch(DIST);
  // Todo endereço do LinkedIn é respondido aqui, na própria máquina. Só o perfil simulado tem conteúdo.
  await h.context.route(/^https?:\/\/([^/]*\.)?linkedin\.com(\/|$)/i, (route) => {
    const url = route.request().url();
    simulatedHits.push(url);
    if (url.startsWith(PROFILE_ADDRESS)) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: simulatedProfile(profile('Clara Fictícia Exemplo', ['Java', 'Spring']).split('\n')) });
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'sem conteúdo' });
  });
});

after(async () => {
  if (h === undefined) return;
  const { fromExtension } = netLogExtensionJobs(await h.close());
  assert.deepEqual(fromExtension, [], 'nenhum pedido de rede começou na extensão');
});

beforeEach(async () => {
  // Um painel esquecido por um teste que falhou também consumiria a leitura do próximo.
  for (const open of h.context.pages()) if (open.url().startsWith('chrome-extension://')) await open.close();
  await resetStorage(h);
  await resetSession(h);
  simulatedHits.length = 0;
});

/** O item existe se o service worker consegue atualizá-lo; sem ele, o navegador devolve lastError. */
const menuExists = (): Promise<boolean> =>
  h.worker.evaluate(
    (id) =>
      new Promise<boolean>((resolve) => {
        chrome.contextMenus.update(id, {}, () => {
          const failed = chrome.runtime.lastError !== undefined;
          resolve(!failed);
        });
      }),
    MENU_ID,
  );

async function waitMenu(expected: boolean): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await menuExists()) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(await menuExists(), expected, expected ? 'o item do menu não apareceu' : 'o item do menu não sumiu');
}

async function settingsOf(): Promise<{ clickReadEnabled: boolean; acceptances: { clickRead?: { version: number; at: number } } }> {
  return (await readStorage(h))['settings'] as never;
}

const setPending = (value: { at: number; [key: string]: unknown }): Promise<void> => h.worker.evaluate((v) => chrome.storage.session.set({ pendingRead: v }), { ...value, at: Date.now() + value.at });

const topNames = (page: Page): Promise<string[]> => page.locator('[data-kind="top_ten"] li.tr-person .tr-person__name').allTextContents();

describe('F09: ligar e desligar a leitura por clique', { timeout: 120_000 }, () => {
  test('CA-19: desligada o item não existe; ligar exige o aviso e grava a data; desligada de novo, o item some', async () => {
    await seedWorkspace(h, []);
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('heading', { name: 'Leitura por clique', level: 3 }).waitFor();

    // De fábrica: desligada, e o item não existe.
    assert.equal(await page.getByTestId('click-read-status').textContent(), 'Desligada.');
    assert.equal((await settingsOf()).clickReadEnabled, false);
    assert.equal(await menuExists(), false);

    // Ligar mostra o aviso e ainda não liga nada.
    await page.getByRole('button', { name: 'Ligar a leitura por clique' }).click();
    const warning = page.getByTestId('click-read');
    await warning.getByText('não trazem exceção para leitura feita por clique').waitFor();
    await warning.getByText('sua conta pode ser limitada ou encerrada').waitFor();
    await warning.getByText('lê só quando você pede, uma página por vez').waitFor();
    await warning.getByText('Colar o texto do perfil continua disponível').waitFor();
    assert.equal((await settingsOf()).clickReadEnabled, false);
    assert.equal(await menuExists(), false);

    // Cancelar volta como estava.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Ligar a leitura por clique' }).waitFor();
    assert.equal((await settingsOf()).clickReadEnabled, false);

    // Aceitar liga, grava versão e data, e o item aparece.
    const before = Date.now();
    await page.getByRole('button', { name: 'Ligar a leitura por clique' }).click();
    await page.getByRole('button', { name: 'Entendi o risco, ligar' }).click();
    await page.getByRole('button', { name: 'Desligar a leitura por clique' }).waitFor();
    const on = await settingsOf();
    assert.equal(on.clickReadEnabled, true);
    assert.equal(on.acceptances.clickRead?.version, 2);
    assert.ok((on.acceptances.clickRead?.at ?? 0) >= before && (on.acceptances.clickRead?.at ?? 0) <= Date.now(), 'a data do aceite foi gravada');
    assert.match((await page.getByTestId('click-read-status').textContent()) ?? '', /^Ligada\. Aviso aceito em \d{2}\/\d{2}\/\d{4}\.$/u);
    await waitMenu(true);

    // O item sobrevive a reabrir o painel; desligar é um clique e o item some.
    await page.reload();
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Desligar a leitura por clique' }).click();
    await page.getByRole('button', { name: 'Ligar a leitura por clique' }).waitFor();
    assert.equal((await settingsOf()).clickReadEnabled, false);
    await waitMenu(false);

    // Ligar de novo pede o aviso outra vez.
    await page.getByRole('button', { name: 'Ligar a leitura por clique' }).click();
    await page.getByText('Antes de ligar, leia este aviso').waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('o gesto de produção só age com a leitura ligada: o service worker tem os ouvintes, mas o item não existe', async () => {
    const listeners = await h.worker.evaluate(() => ({ menu: chrome.contextMenus.onClicked.hasListeners(), command: chrome.commands.onCommand.hasListeners() }));
    assert.deepEqual(listeners, { menu: true, command: true });
    assert.equal(await menuExists(), false);
  });
});

describe('F09: o painel consome a leitura deixada pelo gesto', { timeout: 180_000 }, () => {
  test('a pessoa entra na lista, o Top 10 atualiza, e nem o texto nem o pendingRead ficam no armazenamento local', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const { page, errors } = await openPanel(h);
    await page.getByTestId('active-job').waitFor();

    const text = profile('Clara Fictícia Exemplo', ['Java', 'Spring']);
    await setPending({ ok: true, at: 1, read: { text, url: PROFILE_ADDRESS, title: '(3) Clara Fictícia Exemplo | LinkedIn' } });
    await page.getByRole('heading', { name: 'Análise: Clara Fictícia Exemplo', level: 2 }).waitFor();
    assert.deepEqual(await topNames(page), ['Clara Fictícia Exemplo']);

    const local = await readStorage(h);
    const candidates = Object.entries(local).filter(([key]) => key.startsWith('cand:'));
    assert.equal(candidates.length, 1);
    assert.equal((candidates[0]?.[1] as { source: string }).source, 'clicked');
    assert.ok(!('pendingRead' in local), 'pendingRead não vai para o armazenamento local');
    assert.ok(!JSON.stringify(local).includes('Gosto de código simples'), 'o texto da página não vai para o armazenamento local');

    // A leitura foi apagada na hora; o texto da análise fica só na memória da sessão (RF-34, RF-45).
    const session = await readSession(h);
    assert.ok(!('pendingRead' in session), 'pendingRead apagado depois de consumido');
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('uma leitura deixada com o painel fechado é consumida ao abrir, uma única vez', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    await setPending({ ok: true, at: 2, read: { text: profile('Bruno Imaginário Costa', ['Java']), url: profileUrl('bruno'), title: 'Bruno Imaginário Costa | LinkedIn' } });
    const { page } = await openPanel(h);
    await page.getByRole('heading', { name: 'Análise: Bruno Imaginário Costa', level: 2 }).waitFor();
    assert.ok(!('pendingRead' in (await readSession(h))));
    assert.deepEqual(await topNames(page), ['Bruno Imaginário Costa']);
    await page.reload();
    await page.getByTestId('active-job').waitFor();
    assert.equal(Object.keys(await readStorage(h)).filter((key) => key.startsWith('cand:')).length, 1, 'reabrir não analisa de novo');
    await page.close();
  });

  test('mesmo perfil de novo soma o texto (RF-34); o nome vem do leitor, e na falta dele, do título da aba', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const { page } = await openPanel(h);
    await page.getByTestId('active-job').waitFor();

    await setPending({ ok: true, at: 3, read: { text: profile('Dora Inventada Lima', ['Java']), url: profileUrl('dora'), title: 'x' } });
    await page.getByRole('heading', { name: 'Análise: Dora Inventada Lima', level: 2 }).waitFor();
    const score = async (): Promise<number[]> => Object.entries(await readStorage(h)).filter(([key]) => key.startsWith('cand:')).map(([, value]) => (value as { match: { score: number } }).match.score);
    assert.deepEqual(await score(), [43]);

    // Mais texto do mesmo perfil (Spring): o texto soma, a pessoa continua uma só, e a nota sobe de 43 para 86.
    await setPending({ ok: true, at: 4, read: { text: profile('Dora Inventada Lima', ['Spring']), url: profileUrl('dora'), title: 'x' } });
    await page.waitForFunction(() => document.body.innerText.includes('Dora Inventada Lima'));
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && (await score())[0] !== 86) await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(await score(), [86]);

    // Sem nome no texto, vale o título da aba, sem o contador e sem o sufixo.
    const lines = profile('Nome Que Nao Deve Valer', ['Java', 'Spring']).split('\n').slice(3);
    await setPending({ ok: true, at: 5, read: { text: lines.join('\n'), url: profileUrl('eva'), title: '(3) Eva Fictícia Prado | LinkedIn' } });
    await page.getByRole('heading', { name: 'Análise: Eva Fictícia Prado', level: 2 }).waitFor();
    await page.close();
  });

  test('sem nome no texto e no título, a conversa pede o nome e nada é guardado', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const { page } = await openPanel(h);
    await page.getByTestId('active-job').waitFor();
    const lines = profile('Nome Que Nao Deve Valer', ['Java']).split('\n').slice(3);
    await setPending({ ok: true, at: 6, read: { text: lines.join('\n'), url: profileUrl('sem-nome'), title: '| LinkedIn' } });
    await page.getByText('Não achamos o nome da pessoa.').first().waitFor();
    assert.equal(Object.keys(await readStorage(h)).filter((key) => key.startsWith('cand:')).length, 0);
    await page.close();
  });

  test('sem vaga ativa nada é guardado e a conversa orienta; erro de leitura vira mensagem simples', async () => {
    // Leitura por clique ligada, mas sem o aceite dos avisos: a conversa orienta.
    await h.worker.evaluate(() => chrome.storage.local.set({ settings: { responsibleName: '', responsibleContact: '', retentionDays: 180, clickReadEnabled: true, activeJobId: null, messageTemplates: [], acceptances: { clickRead: { version: 2, at: Date.now() } } } }));
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: /Li os avisos e aceito/ }).waitFor();
    await setPending({ ok: true, at: 7, read: { text: profile('Fábio Inventado', ['Java']), url: profileUrl('fabio'), title: 'x' } });
        await page.getByText('Aceite os avisos para analisar perfis. Nada foi guardado.').waitFor();
    await page.close();

    await resetStorage(h);
    await seedWorkspace(h, [], { clickRead: true });
    await h.worker.evaluate(async () => {
      const all = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(all['settings'] as object), activeJobId: null } });
    });
    const second = await openPanel(h);
    await setPending({ ok: true, at: 8, read: { text: profile('Gil Inventado', ['Java']), url: profileUrl('gil'), title: 'x' } });
    await second.page.getByText('Crie ou escolha uma vaga e repita o clique no perfil. Nada foi guardado.').waitFor();
    assert.equal(Object.keys(await readStorage(h)).filter((key) => key.startsWith('cand:')).length, 0);

    await setPending({ ok: false, at: 9, error: 'Ligue a leitura em Ajustes ou cole o texto.' });
    await second.page.getByText('Ligue a leitura em Ajustes ou cole o texto.').waitFor();
    await second.page.close();
  });
});

describe('F09: a função de leitura numa página simulada', { timeout: 120_000 }, () => {
  test('readPage(false) avaliada na página traz só o texto de main, sem barra nem lateral; nada é mudado na página', async () => {
    await seedWorkspace(h, []);
    const page = await h.context.newPage();
    await page.goto(PROFILE_ADDRESS);
    assert.deepEqual(simulatedHits, [PROFILE_ADDRESS], 'só a página simulada foi pedida');

    const htmlBefore = await page.content();
    const read = await page.evaluate(readPage, false);
    assert.equal(read.url, PROFILE_ADDRESS);
    assert.equal(read.title, '(3) Clara Fictícia Exemplo | LinkedIn');
    assert.ok(read.text.includes('Clara Fictícia Exemplo'));
    assert.ok(read.text.includes('Competências: Java, Spring'));
    assert.ok(read.text.split('\n').length > 10, 'as linhas do main continuam separadas (innerText real)');
    assert.ok(!read.text.includes('LATERAL-INVENTADA'), 'o aside não entra');
    assert.ok(!read.text.includes('BARRA-INVENTADA'), 'a barra não entra');
    assert.equal(await page.content(), htmlBefore, 'a leitura não muda a página');
    assert.deepEqual(simulatedHits, [PROFILE_ADDRESS], 'a leitura não faz pedido nenhum');

    // Sem main, a produção não lê o corpo da página.
    await page.setContent('<body><p>corpo sem main</p></body>');
    assert.equal((await page.evaluate(readPage, false)).text, '');
    await page.close();
  });

  test('da página lida até a lista, sem rede da extensão: o que a função devolveu entra pelo painel', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const tab = await h.context.newPage();
    await tab.goto(PROFILE_ADDRESS);
    const read = await tab.evaluate(readPage, false);
    await tab.close();

    const { page, errors } = await openPanel(h);
    await page.getByTestId('active-job').waitFor();
    await setPending({ ok: true, at: 10, read });
    await page.getByRole('heading', { name: 'Análise: Clara Fictícia Exemplo', level: 2 }).waitFor();
    assert.deepEqual(await topNames(page), ['Clara Fictícia Exemplo']);
    assert.deepEqual(errors, []);
    await page.close();

    // Rede zero: nenhuma página da extensão nem o service worker pediu algo para fora; só a página simulada foi aberta.
    assert.deepEqual(extensionRequests(h), []);
    assert.ok(simulatedHits.every((url) => url.startsWith(PROFILE_ADDRESS)));
  });
});
