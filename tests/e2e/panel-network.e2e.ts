// Rede zero na jornada inteira do painel (RNF-01, CA-17) e apagamento por prazo ao abrir o painel e o navegador (RF-90).
// Nenhum teste acessa o LinkedIn. A jornada aqui não clica em "Abrir no LinkedIn": essa aba é do navegador e tem teste próprio.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Candidate } from '../../src/core/model.ts';
import { DAY_MS } from '../../src/core/store/retention.ts';
import { ROOT, extensionRequests, launch, netLogExtensionJobs, openPanel, readStorage, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';

const DIST = path.join(ROOT, 'dist');

function candidate(id: string, updatedAt: number): Candidate {
  return {
    id,
    jobId: 'job-1',
    name: `Pessoa ${id}`,
    profileUrl: `https://www.linkedin.com/in/${id}/`,
    profileKey: `/in/${id}/`,
    card: { totalMonths: 12, currentTitle: null, terms: [], searchedFreeTerms: [], sectionsRead: ['experience'], truncated: false },
    match: { score: 50, band: 'partial', results: [], requiredMet: 0, requiredTotal: 0 },
    stage: 'new',
    favorite: false,
    notes: '',
    informedAt: null,
    source: 'pasted',
    addedAt: updatedAt,
    updatedAt,
  };
}

describe('painel: rede zero e prazo', { timeout: 180_000 }, () => {
  let h: Harness;
  before(async () => {
    h = await launch(DIST);
    await trapLinkedIn(h);
  });
  after(async () => {
    await (h as Harness | undefined)?.close();
  });

  test('o apagamento por prazo roda ao abrir o painel e só leva quem venceu', async () => {
    await resetStorage(h);
    const now = Date.now();
    const job = { id: 'job-1', title: 'Vaga', text: '', requirements: [], excludedTerms: [], archived: false, createdAt: now, updatedAt: now };
    await h.worker.evaluate(
      (items) => chrome.storage.local.set(items),
      {
        settings: { responsibleName: 'Ana', responsibleContact: 'a@x.test', retentionDays: 30, clickReadEnabled: false, activeJobId: 'job-1', messageTemplates: [], acceptances: { terms: { version: 1, at: now } } },
        'job:job-1': job,
        'cand:vencida': candidate('vencida', now - 31 * DAY_MS),
        'cand:no-limite': candidate('no-limite', now - 29 * DAY_MS),
        'cand:recente': candidate('recente', now),
      },
    );
    const { page, errors } = await openPanel(h);
    await page.getByRole('heading', { name: 'Vaga ativa' }).waitFor();
    const keys = Object.keys(await readStorage(h)).filter((key) => key.startsWith('cand:')).sort();
    assert.deepEqual(keys, ['cand:no-limite', 'cand:recente']);
    // Nada de nome ou endereço no console do painel (RNF-11).
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('o service worker apaga por prazo ao abrir o navegador: ouvinte de onStartup presente, sem permissão nova', async () => {
    assert.equal(await h.worker.evaluate(() => chrome.runtime.onStartup.hasListeners()), true);
    const permissions = await h.worker.evaluate(() => chrome.runtime.getManifest().permissions);
    assert.deepEqual([...(permissions ?? [])].sort(), ['activeTab', 'contextMenus', 'scripting', 'sidePanel', 'storage']);
  });

  test('a jornada inteira (aceite, vaga, requisitos, termo recusado, busca, copiar, ajustes, arquivar, apagar) não faz pedido de rede', async () => {
    await resetStorage(h);
    const { page, errors } = await openPanel(h);
    await page.getByLabel('Seu nome').fill('Marina Souza');
    await page.getByLabel('Seu contato').fill('marina@exemplo.test');
    await page.getByRole('button', { name: 'Li os avisos e aceito' }).click();
    await page.getByRole('button', { name: 'Nova vaga' }).click();
    await page.getByLabel('Título da vaga').fill('Vaga da jornada');
    await page.getByLabel('Texto da vaga').fill('Requisitos:\n- Java\n- Kafka\n- Aceitamos até 35 anos\nDiferenciais:\n- Docker');
    await page.getByRole('button', { name: 'Salvar e ver requisitos' }).click();
    await page.getByRole('button', { name: 'Usar os marcados' }).click();
    await page.getByLabel('Requisito', { exact: true }).fill('solteiro');
    await page.getByRole('button', { name: 'Adicionar requisito' }).click();
    await page.getByText('Estado civil, filhos ou família não entra como critério').waitFor();
    await page.getByRole('button', { name: 'Montar a busca' }).click();
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.getByTestId('copy-status').filter({ hasText: /\S/ }).waitFor();
    await page.getByLabel(/^Curta/).check();
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByLabel('Guardar candidatos por quantos dias').fill('60');
    await page.getByRole('button', { name: 'Salvar ajustes' }).click();
    await page.getByText('Ajustes salvos.').waitFor();
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
    await page.getByRole('button', { name: 'Arquivar a vaga', exact: true }).click();
    await page.getByRole('button', { name: 'Ver vagas' }).click();
    await page.getByRole('button', { name: 'Apagar: Vaga da jornada' }).click();
    await page.getByRole('button', { name: 'Apagar a vaga e os candidatos' }).click();
    await page.getByRole('heading', { name: 'Vamos começar pela vaga' }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();

    // Controle positivo: uma página comum que pede algo é vista pelo registrador, então o zero acima vale.
    const control = await h.context.newPage();
    await control.goto(h.controlUrl);
    await control.evaluate((url) => fetch(url + 'controle').then((r) => r.text()), h.controlUrl);
    await control.close();
    assert.ok(h.serverHits.includes('/controle'));
    assert.ok(h.requests.some((r) => r.url === h.controlUrl + 'controle'));

    assert.deepEqual(extensionRequests(h), []);
    assert.ok(h.requests.some((r) => r.url.startsWith('chrome-extension://')), 'o registrador viu o painel abrir');
    const { jobs, fromExtension } = netLogExtensionJobs(await h.close());
    assert.ok(jobs.some((j) => j.url === h.controlUrl + 'controle'), 'o net-log registrou o controle');
    assert.deepEqual(fromExtension, []);
    assert.deepEqual(h.serverHits.filter((hit) => hit !== '/' && hit !== '/controle'), []);
  });
});
