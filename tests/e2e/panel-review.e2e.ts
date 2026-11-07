// Defeitos da revisão final, no Chromium com a extensão de verdade: prazo menor com confirmação, outra janela que apaga,
// rascunho que sobrevive a uma mudança vinda de fora, análise repetida e título de vaga recusado. Perfis, nomes e links
// são inventados, e nenhum teste acessa o LinkedIn: o pedido seria abortado por context.route.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Page } from 'playwright';
import { ROOT, launch, netLogExtensionJobs, openPanel, readSession, readStorage, resetSession, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';
import { profile, profileUrl, seedWorkspace } from './panel-triage-kit.ts';

const DIST = path.join(ROOT, 'dist');
const DAY = 86_400_000;

let h: Harness;
let linkedinHits: string[];

before(async () => {
  h = await launch(DIST);
  linkedinHits = await trapLinkedIn(h);
});

after(async () => {
  if (h === undefined) return;
  const { fromExtension } = netLogExtensionJobs(await h.close());
  assert.deepEqual(fromExtension, [], 'nenhum pedido de rede começou na extensão');
  assert.deepEqual(linkedinHits, [], 'nenhum teste abriu o LinkedIn');
});

beforeEach(async () => {
  for (const open of h.context.pages()) if (open.url().startsWith('chrome-extension://')) await open.close();
  await resetStorage(h);
  await resetSession(h);
  linkedinHits.length = 0;
});

const candidates = async (): Promise<{ id: string; name: string; notes: string; profileUrl: string }[]> =>
  Object.entries(await readStorage(h))
    .filter(([key]) => key.startsWith('cand:'))
    .map(([, value]) => value as { id: string; name: string; notes: string; profileUrl: string });

async function pasteByHand(page: Page, name: string, slug: string, click: 'click' | 'dblclick' = 'click'): Promise<void> {
  await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
  await page.getByLabel('Texto do perfil').fill(profile(name, ['Java']));
  await page.getByLabel('Link do perfil').fill(profileUrl(slug));
  await page.getByLabel('Nome', { exact: true }).fill(name);
  const button = page.getByRole('button', { name: 'Analisar', exact: true });
  if (click === 'dblclick') await button.dblclick();
  else await button.click();
}

describe('RF-90: reduzir o prazo apaga gente, então pergunta', { timeout: 120_000 }, () => {
  test('mostra quantas pessoas serão apagadas; voltar não muda nada; confirmar apaga e muda o prazo', async () => {
    await seedWorkspace(h, [
      { name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java'], ageDays: 100 },
      { name: 'Bruno Imaginário Costa', slug: 'bruno', skills: ['Java'] },
    ]);
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByLabel('Guardar candidatos por quantos dias').fill('30');
    await page.getByRole('button', { name: 'Salvar ajustes' }).click();
    await page.getByText('Este prazo apaga pessoas agora').waitFor();
    assert.ok((await page.locator('body').innerText()).includes('1 pessoa já passou do prazo e será apagada'));
    assert.equal(((await readStorage(h))['settings'] as { retentionDays: number }).retentionDays, 180, 'nada mudou ainda');
    assert.equal((await candidates()).length, 2);

    await page.getByRole('button', { name: 'Voltar sem mudar' }).click();
    assert.equal(await page.getByText('Este prazo apaga pessoas agora').count(), 0);
    assert.equal((await candidates()).length, 2);

    await page.getByRole('button', { name: 'Salvar ajustes' }).click();
    await page.getByRole('button', { name: 'Apagar 1 pessoa e mudar o prazo' }).click();
    await page.getByText('Ajustes salvos.').waitFor();
    assert.equal(((await readStorage(h))['settings'] as { retentionDays: number }).retentionDays, 30);
    assert.deepEqual((await candidates()).map((c) => c.name), ['Bruno Imaginário Costa']);
    assert.deepEqual(errors, []);
  });

  test('a ficha com o prazo já vencido não mostra data passada', async () => {
    await seedWorkspace(h, [{ name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java'] }]);
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    await page.getByText(/Guardada até/).waitFor();
    // O tempo anda com o painel aberto: a ficha passa do prazo. O painel só apaga ao abrir, então não mostra a data.
    await h.worker.evaluate(async (old) => {
      const all = (await chrome.storage.local.get(null)) as Record<string, object>;
      const key = Object.keys(all).find((k) => k.startsWith('cand:'))!;
      await chrome.storage.local.set({ [key]: { ...all[key], updatedAt: old } });
    }, Date.now() - 200 * DAY);
    await page.getByText('O prazo de guarda já passou').waitFor();
    assert.equal(await page.getByText(/Guardada até/).count(), 0);
    await page.close();
  });
});

describe('RF-93, RF-37: outra janela apaga', { timeout: 120_000 }, () => {
  test('apagar tudo noutra janela: a primeira recarrega, e Salvar não ressuscita ninguém', async () => {
    await seedWorkspace(h, [{ name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java'] }]);
    const a = await openPanel(h);
    await a.page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    await a.page.getByLabel('Notas', { exact: true }).fill('anotação em andamento');
    await h.worker.evaluate(() => chrome.storage.local.clear());
    await a.page.getByRole('button', { name: /Li os avisos e aceito/ }).waitFor();
    assert.deepEqual(await candidates(), []);
    assert.deepEqual(Object.keys(await readStorage(h)), [], 'nada voltou ao armazenamento');
    await a.page.close();
  });

  test('apagar a pessoa noutra janela tira a primeira do detalhe, sem gravar nada de volta', async () => {
    await seedWorkspace(h, [
      { name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java'] },
      { name: 'Bruno Imaginário Costa', slug: 'bruno', skills: ['Java'] },
    ]);
    const a = await openPanel(h);
    await a.page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    await a.page.getByRole('heading', { name: /^Detalhe: / }).waitFor();
    const shownName = (await a.page.getByRole('heading', { name: /^Detalhe: / }).innerText()).replace('Detalhe: ', '');
    const doomed = (await candidates()).find((c) => c.name === shownName)!;
    await h.worker.evaluate(async (id) => chrome.storage.local.remove(`cand:${id}`), doomed.id);
    await a.page.getByRole('heading', { name: /^Detalhe: / }).waitFor({ state: 'detached' });
    assert.ok(!(await candidates()).some((c) => c.id === doomed.id), 'a pessoa apagada não voltou');
    assert.equal((await candidates()).length, 1);
    await a.page.close();
  });

  test('rascunho de formulário sobrevive a uma mudança vinda de outra janela', async () => {
    await seedWorkspace(h, [{ name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java'] }]);
    const a = await openPanel(h);
    await a.page.getByRole('button', { name: 'Colar um perfil' }).first().click();
    await a.page.getByLabel('Texto do perfil').fill('texto que ainda estou colando');
    await h.worker.evaluate(async () => {
      const all = (await chrome.storage.local.get(null)) as Record<string, { updatedAt?: number }>;
      const key = Object.keys(all).find((k) => k.startsWith('cand:'))!;
      await chrome.storage.local.set({ [key]: { ...all[key], notes: 'mudou fora' } });
    });
    await a.page.waitForTimeout(500);
    assert.equal(await a.page.getByLabel('Texto do perfil').inputValue(), 'texto que ainda estou colando');
    await a.page.close();
  });
});

describe('RF-64: análise repetida', { timeout: 120_000 }, () => {
  test('duplo clique em Analisar guarda uma pessoa só', async () => {
    await seedWorkspace(h, []);
    const { page, errors } = await openPanel(h);
    await pasteByHand(page, 'Alice Fictícia Prado', 'alice', 'dblclick');
    await page.getByRole('heading', { name: 'Análise: Alice Fictícia Prado', level: 2 }).waitFor();
    await page.waitForTimeout(300);
    assert.equal((await candidates()).length, 1);
    assert.deepEqual(errors, []);
  });

  test('somar mais texto a quem tem link fora do LinkedIn não cria outro registro', async () => {
    await seedWorkspace(h, []);
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
    await page.getByLabel('Texto do perfil').fill(profile('Alice Fictícia Prado', ['Java']));
    await page.getByLabel('Link do perfil').fill('https://github.com/alice-ficticia');
    await page.getByLabel('Nome', { exact: true }).fill('Alice Fictícia Prado');
    await page.getByRole('button', { name: 'Analisar', exact: true }).click();
    await page.getByRole('heading', { name: 'Análise: Alice Fictícia Prado', level: 2 }).waitFor();
    await page.getByRole('button', { name: 'Somar mais texto' }).first().click();
    await page.getByLabel('Texto do perfil').fill('Competências\nDocker');
    await page.getByRole('button', { name: 'Somar e analisar de novo' }).click();
    await page.getByRole('heading', { name: 'Análise: Alice Fictícia Prado', level: 2 }).waitFor();
    assert.equal((await candidates()).length, 1);
    await page.close();
  });

  test('o texto da análise sai da sessão quando o candidato some, mesmo apagado em outra janela', async () => {
    await seedWorkspace(h, []);
    const { page } = await openPanel(h);
    await pasteByHand(page, 'Alice Fictícia Prado', 'alice');
    await page.getByRole('heading', { name: 'Análise: Alice Fictícia Prado', level: 2 }).waitFor();
    assert.ok('lastAnalysisText' in (await readSession(h)));
    await h.worker.evaluate(async () => {
      const all = (await chrome.storage.local.get(null)) as Record<string, unknown>;
      await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('cand:') || k.startsWith('job:')));
    });
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && 'lastAnalysisText' in (await readSession(h))) await new Promise((resolve) => setTimeout(resolve, 100));
    assert.ok(!('lastAnalysisText' in (await readSession(h))), 'sem candidato, sem texto na sessão');
    await page.close();
  });
});

describe('RF-13: título da vaga', { timeout: 120_000 }, () => {
  test('título com critério proibido é recusado com o motivo; cidade no título é permitida', async () => {
    await seedWorkspace(h, []);
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Trocar' }).click();
    await page.getByRole('button', { name: 'Nova vaga', exact: true }).click();
    await page.getByLabel('Título da vaga').fill('Dev Java homem até 30 anos');
    await page.getByRole('button', { name: 'Salvar e ver requisitos' }).click();
    await page.locator('[aria-invalid="true"]').first().waitFor();
    assert.equal(Object.keys(await readStorage(h)).filter((k) => k.startsWith('job:')).length, 1, 'a vaga nova não foi guardada');
    await page.getByLabel('Título da vaga').fill('Dev Java em São Paulo');
    await page.getByRole('button', { name: 'Salvar e ver requisitos' }).click();
    await page.getByTestId('active-job').filter({ hasText: 'Dev Java em São Paulo' }).waitFor();
    assert.equal(Object.keys(await readStorage(h)).filter((k) => k.startsWith('job:')).length, 2);
    await page.close();
  });
});

const setPending = (value: Record<string, unknown>): Promise<void> => h.worker.evaluate((v) => chrome.storage.session.set({ pendingRead: v }), value);
const windowIdOf = (page: Page): Promise<number | undefined> => page.evaluate(() => chrome.windows.getCurrent().then((w) => w.id));

describe('RF-64: a leitura do gesto', { timeout: 120_000 }, () => {
  const read = (name: string, slug: string, title: string, withName = true) => ({
    text: withName ? profile(name, ['Java']) : profile(name, ['Java']).split('\n').slice(1).join('\n'),
    url: profileUrl(slug),
    title,
  });

  test('só o painel da janela do gesto consome; leitura velha ou com a opção desligada é apagada', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const { page } = await openPanel(h);
    await page.getByTestId('active-job').waitFor();
    const mine = await windowIdOf(page);
    assert.equal(typeof mine, 'number');

    await setPending({ ok: true, at: Date.now(), windowId: (mine as number) + 1000, read: read('Alice Fictícia Prado', 'alice', 'x') });
    await page.waitForTimeout(700);
    assert.equal((await candidates()).length, 0, 'leitura de outra janela não entra neste painel');
    assert.ok('pendingRead' in (await readSession(h)), 'e fica onde está para o painel certo');

    await setPending({ ok: true, at: Date.now(), windowId: mine, read: read('Alice Fictícia Prado', 'alice', 'x') });
    await page.getByRole('heading', { name: 'Análise: Alice Fictícia Prado', level: 2 }).waitFor();
    assert.ok(!('pendingRead' in (await readSession(h))));
    assert.equal((await candidates()).length, 1);

    await setPending({ ok: true, at: Date.now() - 3 * 60_000, windowId: mine, read: read('Bruno Imaginário Costa', 'bruno', 'x') });
    await page.waitForTimeout(700);
    assert.equal((await candidates()).length, 1, 'leitura de mais de 2 minutos não entra');
    assert.ok(!('pendingRead' in (await readSession(h))), 'e é apagada');
    await page.close();
  });

  test('com a leitura por clique desligada, a leitura guardada é apagada sem ser analisada', async () => {
    await seedWorkspace(h, []);
    const { page } = await openPanel(h);
    await page.getByTestId('active-job').waitFor();
    await setPending({ ok: true, at: Date.now(), read: read('Alice Fictícia Prado', 'alice', 'x') });
    await page.waitForTimeout(700);
    assert.equal((await candidates()).length, 0);
    assert.ok(!('pendingRead' in (await readSession(h))));
    await page.close();
  });

  test('sem nome no texto, o título da aba passa pelo limpador: pronomes e cargo não entram (RF-44)', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const { page } = await openPanel(h);
    await page.getByTestId('active-job').waitFor();
    await setPending({ ok: true, at: Date.now(), read: read('x', 'ana', 'Ana Souza (Ela/Dela) | LinkedIn', false) });
    await page.getByRole('heading', { name: 'Análise: Ana Souza', level: 2 }).waitFor();
    await setPending({ ok: true, at: Date.now() + 1, read: read('x', 'bia', 'Bia Souza - Engenheira de Software - Banco Alfa', false) });
    await page.getByRole('heading', { name: 'Análise: Bia Souza', level: 2 }).waitFor();
    assert.deepEqual((await candidates()).map((c) => c.name).sort(), ['Ana Souza', 'Bia Souza']);
    await setPending({ ok: true, at: Date.now() + 2, read: read('x', 'caio', 'Engenheira de Software - Banco Alfa', false) });
    await page.getByText('Não achamos o nome da pessoa.').first().waitFor();
    assert.equal((await candidates()).length, 2, 'sem nome válido, a conversa pede o nome e nada é guardado');
    await page.close();
  });
});

describe('RF-10, RF-11: editar uma vaga que não é a ativa', { timeout: 120_000 }, () => {
  test('o texto novo gera sugestões para a vaga editada, e a ativa fica como estava', async () => {
    await seedWorkspace(h, [{ name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java', 'Spring'] }]);
    const before = await candidates();
    await h.worker.evaluate(async () => {
      const now = Date.now();
      await chrome.storage.local.set({ 'job:vaga-b': { id: 'vaga-b', title: 'Vaga B', text: '', requirements: [], excludedTerms: [], archived: false, createdAt: now, updatedAt: now } });
    });
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Trocar' }).click();
    await page.getByRole('button', { name: 'Editar vaga: Vaga B' }).click();
    await page.getByLabel('Texto da vaga').fill('Requisitos:\nRust\nKotlin\nErlang');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByRole('button', { name: 'Usar os marcados' }).click();
    await page.getByText('Rust').first().waitFor();
    const stored = await readStorage(h);
    const labels = (id: string): string[] => ((stored[`job:${id}`] as { requirements: { label: string }[] }).requirements ?? []).map((r) => r.label);
    const after = await readStorage(h);
    const activeLabels = ((after['job:vaga-e2e'] as { requirements: { label: string }[] }).requirements).map((r) => r.label);
    assert.deepEqual(activeLabels, ['Java', 'Spring', 'Kubernetes'], 'a vaga ativa não mudou');
    const bLabels = ((after['job:vaga-b'] as { requirements: { label: string }[] }).requirements).map((r) => r.label);
    for (const wanted of ['Rust', 'Kotlin', 'Erlang']) assert.ok(bLabels.includes(wanted), wanted);
    assert.ok(labels('vaga-e2e').length > 0);
    const [alice] = await candidates();
    assert.equal((alice as unknown as { match: { score: number } }).match.score, (before[0] as unknown as { match: { score: number } }).match.score, 'a nota de quem está na vaga ativa não caiu');
    await page.close();
  });
});
