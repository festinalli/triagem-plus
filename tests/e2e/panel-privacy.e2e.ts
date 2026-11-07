// F10b no Chromium: tela de Privacidade (RF-91 a RF-94, FL-9, CA-16). Perfis, nomes e links são inventados, e nenhum teste
// acessa o LinkedIn: o pedido seria abortado por context.route e só o endereço ficaria registrado.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from 'playwright';
import { ROOT, extensionRequests, launch, netLogExtensionJobs, openPanel, readSession, readStorage, resetSession, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';
import { ANA, BIA, CAIO, seedTwoJobs } from './panel-privacy-kit.ts';

const DIST = path.join(ROOT, 'dist');
const PROFILE_TEXT = ['Gosto de código simples', 'Texto único do perfil da Ana', 'Empresa Fictícia Alfa', 'Engenheira de Software'];

let h: Harness;
let linkedinHits: string[];

before(async () => {
  h = await launch(DIST);
  linkedinHits = await trapLinkedIn(h);
});

after(async () => {
  fs.rmSync(path.join(os.tmpdir(), 'triagem-e2e-privacy-downloads'), { recursive: true, force: true });
  if (h === undefined) return;
  const { fromExtension } = netLogExtensionJobs(await h.close());
  assert.deepEqual(fromExtension, [], 'nenhum pedido de rede começou na extensão');
});

beforeEach(async () => {
  await resetStorage(h);
  await resetSession(h);
  linkedinHits.length = 0;
});

async function saveDownload(page: Page, click: () => Promise<void>): Promise<{ name: string; text: string }> {
  const dir = path.join(os.tmpdir(), 'triagem-e2e-privacy-downloads');
  fs.mkdirSync(dir, { recursive: true });
  const [download] = await Promise.all([page.waitForEvent('download'), click()]);
  const file = path.join(dir, `${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(file);
  return { name: download.suggestedFilename(), text: fs.readFileSync(file, 'utf8') };
}

const candidateRecords = async (): Promise<{ id: string; jobId: string; name: string; profileUrl: string }[]> =>
  Object.entries(await readStorage(h))
    .filter(([key]) => key.startsWith('cand:'))
    .map(([, value]) => value as { id: string; jobId: string; name: string; profileUrl: string });

async function openPrivacy(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Privacidade', exact: true }).click();
  await page.getByRole('heading', { name: 'Privacidade e seus dados', level: 2 }).waitFor();
}

async function find(page: Page, query: string): Promise<void> {
  await page.getByLabel('Nome ou link').fill(query);
  await page.getByRole('button', { name: 'Achar', exact: true }).click();
}

describe('F10b: tela de Privacidade (RF-94, RNF-05)', { timeout: 300_000 }, () => {
  test('diz o que fica guardado, onde, por quanto tempo, o que não é protegido e o que cabe a quem usa', async () => {
    await seedTwoJobs(h, [{ ...ANA, jobs: ['a'] }]);
    const { page, errors } = await openPanel(h);
    await openPrivacy(page);
    const text = await page.locator('main').innerText();
    for (const part of ['O que fica guardado', 'Onde fica', 'Por quanto tempo', 'O que NÃO é protegido', 'O que cabe a você']) assert.ok(text.includes(part), part);
    assert.match(text, /Isto não é parecer jurídico/);
    assert.match(text, /sem criptografia/);
    assert.match(text, /Quem usa este perfil do Chrome neste computador consegue ler/);
    assert.match(text, /180 dias/);
    assert.match(text, /legítimo interesse/);
    assert.match(text, /advogado/);
    assert.match(text, /Avisar cada pessoa/);
    assert.match(text, /Atender os pedidos/);
    assert.match(text, /Não discriminar/);
    assert.match(await page.getByTestId('storage-used').innerText(), /^Você usa [\d,.]+ (bytes|KB|MB) de 10 MB\.$/);
    assert.equal(await page.getByText('Está perto do limite', { exact: false }).count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('aviso perto do limite de espaço', async () => {
    await seedTwoJobs(h, [{ ...ANA, jobs: ['a'] }]);
    // Enche o armazenamento com um registro que não é de ninguém, só para chegar a 80% de 10 MB.
    await h.worker.evaluate(() => chrome.storage.local.set({ enchimento: 'x'.repeat(8_500_000) }));
    const { page } = await openPanel(h);
    await openPrivacy(page);
    await page.getByText('Está perto do limite', { exact: false }).waitFor();
    await h.worker.evaluate(() => chrome.storage.local.remove('enchimento'));
    await page.close();
  });

  test('também abre pelos Ajustes', async () => {
    await seedTwoJobs(h, [{ ...ANA, jobs: ['a'] }]);
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('button', { name: 'Privacidade e seus dados' }).click();
    await page.getByRole('heading', { name: 'Privacidade e seus dados', level: 2 }).waitFor();
    await page.close();
  });
});

describe('F10b: achar pessoa (RF-91, FL-9, CA-16)', { timeout: 300_000 }, () => {
  test('acha sem acento, mostra tudo o que está guardado em todas as vagas e não mostra texto de perfil', async () => {
    await seedTwoJobs(h, [
      { ...ANA, jobs: ['a', 'b'], notes: 'Boa conversa.' },
      { ...BIA, jobs: ['a'] },
    ]);
    const { page, errors } = await openPanel(h);
    await openPrivacy(page);
    await find(page, 'ana ficticia muller');
    await page.getByText('Uma pessoa achada.').waitFor();
    const card = page.locator('li.tr-found');
    assert.equal(await card.count(), 1);
    await card.getByText('Guardada em 2 vagas.').waitFor();
    assert.equal(await card.locator('.tr-record').count(), 2);
    const facts = await card.innerText();
    for (const part of ['Pessoa desenvolvedora Java', 'Pessoa desenvolvedora Spring', 'Boa conversa.', 'Ainda não informado', 'Texto colado', 'Java', 'Spring', 'Kubernetes']) assert.ok(facts.includes(part), part);
    for (const secret of PROFILE_TEXT) assert.ok(!facts.includes(secret), `texto de perfil na tela: ${secret}`);
    // Pelo link também, e outra pessoa não entra.
    await find(page, 'LINKEDIN.com/in/ana-ficticia-muller');
    await page.getByText('Uma pessoa achada.').waitFor();
    await find(page, 'zzz sem ninguem');
    await page.getByText('Ninguém foi achado com esse texto.').waitFor();
    await find(page, '  ');
    await page.getByText('Escreva um nome ou um link.').first().waitFor();
    assert.deepEqual(linkedinHits, []);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('corrige nome e link em todas as vagas', async () => {
    await seedTwoJobs(h, [{ ...ANA, jobs: ['a', 'b'] }]);
    const { page, errors } = await openPanel(h);
    await openPrivacy(page);
    await find(page, 'ana');
    await page.getByRole('button', { name: /^Corrigir nome e link/ }).click();
    await page.locator('#person-link').fill('http://sem-https.test/ana');
    await page.getByRole('button', { name: 'Salvar a correção' }).click();
    await page.getByText('O link precisa começar com https://.').waitFor();
    await page.locator('#person-name').fill('Ana Corrigida Silva');
    await page.locator('#person-link').fill('https://www.linkedin.com/in/ana-corrigida/');
    await page.getByRole('button', { name: 'Salvar a correção' }).click();
    await page.getByText('Nome e link corrigidos em todas as vagas.').waitFor();
    const records = await candidateRecords();
    assert.equal(records.length, 2);
    assert.deepEqual(records.map((r) => r.name), ['Ana Corrigida Silva', 'Ana Corrigida Silva']);
    assert.deepEqual(records.map((r) => r.profileUrl), ['https://www.linkedin.com/in/ana-corrigida/', 'https://www.linkedin.com/in/ana-corrigida/']);
    assert.equal(await page.locator('li.tr-found').getByText('Ana Corrigida Silva').count() > 0, true);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('exporta a ficha em JSON, sem texto de perfil', async () => {
    await seedTwoJobs(h, [
      { ...ANA, jobs: ['a', 'b'], notes: 'Anotação minha.' },
      { ...BIA, jobs: ['a'] },
    ]);
    const { page, errors } = await openPanel(h);
    await openPrivacy(page);
    await find(page, 'ana');
    await page.getByText('Uma pessoa achada.').waitFor();
    const file = await saveDownload(page, () => page.getByRole('button', { name: /^Exportar a ficha/ }).click());
    assert.match(file.name, /^triagem-ficha-\d{4}-\d{2}-\d{2}\.json$/);
    assert.ok(!file.name.includes('Ana') && !file.name.toLowerCase().includes('ana-'), 'o nome do arquivo não leva o nome da pessoa');
    const json = JSON.parse(file.text) as { candidates: { name: string; notes: string }[]; jobs: unknown[] };
    assert.equal(json.candidates.length, 2);
    assert.ok(json.candidates.every((c) => c.name === ANA.name));
    assert.equal(json.jobs.length, 2);
    assert.ok(!file.text.includes(BIA.name), 'só a pessoa pedida');
    for (const secret of PROFILE_TEXT) assert.ok(!file.text.includes(secret), `texto de perfil no arquivo: ${secret}`);
    await page.getByText('Ficha baixada.', { exact: false }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('CA-16: apagar uma pessoa a remove de todas as vagas, com confirmação, e só ela', async () => {
    await seedTwoJobs(h, [
      { ...ANA, jobs: ['a', 'b'] },
      { ...BIA, jobs: ['a'] },
      { ...CAIO, jobs: ['b'] },
    ]);
    // O texto da última análise, na memória da sessão, é desta pessoa e deve sair junto.
    await h.worker.evaluate((id) => chrome.storage.session.set({ lastAnalysisText: { profileKey: '/in/ana-ficticia-muller/', candidateId: id, jobId: 'vaga-a', text: 'texto da ana' } }), `cand-${ANA.slug}-a`);
    const { page, errors } = await openPanel(h);
    assert.equal((await candidateRecords()).length, 4);
    await openPrivacy(page);
    await find(page, 'ana');
    await page.getByRole('button', { name: /^Apagar em todas as vagas/ }).click();
    await page.getByRole('heading', { name: 'Apagar esta pessoa de todas as vagas?', level: 2 }).waitFor();
    assert.equal((await candidateRecords()).length, 4, 'nada some antes de confirmar');
    // Voltar não apaga.
    await page.getByRole('button', { name: 'Voltar para a Privacidade' }).click();
    assert.equal((await candidateRecords()).length, 4);
    await page.getByRole('button', { name: /^Apagar em todas as vagas/ }).click();
    await page.getByRole('button', { name: 'Apagar a pessoa de vez' }).click();
    await page.getByText('A pessoa foi apagada de 2 vagas.').waitFor();
    const left = await candidateRecords();
    assert.deepEqual(left.map((r) => r.name).sort(), [BIA.name, CAIO.name].sort());
    assert.deepEqual(await readSession(h), {}, 'o texto da pessoa apagada sai da memória da sessão');
    await find(page, 'ana');
    await page.getByText('Ninguém foi achado com esse texto.').waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('texto malicioso em nome, link e notas aparece como texto', async () => {
    const evil = '<img src=x onerror="window.__invadido=1"> <b>Negrito</b>';
    await seedTwoJobs(h, [{ name: evil, slug: 'ataque', skills: ['Java'], jobs: ['a'], notes: '<script>window.__invadido=2</script><b>x</b>' }]);
    const { page, errors } = await openPanel(h);
    await openPrivacy(page);
    await find(page, 'negrito');
    await page.getByText('Uma pessoa achada.').waitFor();
    const card = page.locator('li.tr-found');
    assert.ok((await card.innerText()).includes(evil));
    assert.ok((await card.innerText()).includes('<script>window.__invadido=2</script>'));
    assert.equal(await page.locator('main img, main b, main script').count(), 0);
    assert.equal(await page.evaluate(() => (window as unknown as { __invadido?: number }).__invadido), undefined);
    assert.deepEqual(errors, []);
    await page.close();
  });
});

describe('F10b: exportar tudo e apagar tudo (RF-92, RF-93, CA-16)', { timeout: 300_000 }, () => {
  test('exportar tudo baixa JSON sem texto de perfil; na primeira vez pede o aceite do aviso', async () => {
    await seedTwoJobs(h, [
      { ...ANA, jobs: ['a', 'b'] },
      { ...BIA, jobs: ['a'] },
    ]);
    const { page, errors } = await openPanel(h);
    await openPrivacy(page);
    await page.getByText('O arquivo tem dados pessoais.', { exact: false }).first().waitFor();
    await page.getByText('É a primeira vez', { exact: false }).waitFor();
    const file = await saveDownload(page, () => page.getByRole('button', { name: 'Entendi o aviso e exportar tudo' }).click());
    assert.match(file.name, /^triagem-tudo-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse(file.text) as { jobs: unknown[]; candidates: { name: string }[]; settings: { responsibleName: string } };
    assert.equal(json.jobs.length, 2);
    assert.equal(json.candidates.length, 3);
    assert.equal(json.settings.responsibleName, 'Marina Souza');
    for (const secret of PROFILE_TEXT) assert.ok(!file.text.includes(secret), `texto de perfil no arquivo: ${secret}`);
    await page.getByText('Arquivo baixado.', { exact: false }).waitFor();
    // Depois do aceite o aviso continua visível, e o botão não pede mais nada.
    await page.getByRole('button', { name: 'Exportar tudo (JSON)' }).waitFor();
    assert.equal(await page.getByText('É a primeira vez', { exact: false }).count(), 0);
    assert.ok('fileExport' in ((await readStorage(h))['settings'] as { acceptances: object }).acceptances);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('CA-16: "Apagar tudo" exige digitar APAGAR, esvazia o armazenamento e a sessão e volta à primeira abertura', async () => {
    await seedTwoJobs(h, [
      { ...ANA, jobs: ['a', 'b'] },
      { ...BIA, jobs: ['a'] },
    ]);
    await h.worker.evaluate(() => chrome.storage.session.set({ lastAnalysisText: { profileKey: null, candidateId: 'x', jobId: 'y', text: 'texto da sessão' }, pendingRead: { ok: true } }));
    const { page, errors } = await openPanel(h);
    await openPrivacy(page);
    await page.getByText('Desinstalar a extensão também apaga o que está guardado nela, mas não os arquivos que você já baixou.').waitFor();

    // Sem a palavra certa, nada é apagado.
    await page.getByRole('button', { name: 'Apagar tudo', exact: true }).click();
    await page.getByText('Digite APAGAR', { exact: false }).first().waitFor();
    await page.getByLabel('Para confirmar, digite APAGAR').fill('apagar');
    await page.getByRole('button', { name: 'Apagar tudo', exact: true }).click();
    assert.ok(Object.keys(await readStorage(h)).length > 0);
    assert.equal((await candidateRecords()).length, 3);

    await page.getByLabel('Para confirmar, digite APAGAR').fill('APAGAR');
    await page.getByRole('button', { name: 'Apagar tudo', exact: true }).click();
    await page.getByRole('heading', { name: 'Antes de começar', level: 2 }).waitFor();
    assert.deepEqual(await readStorage(h), {}, 'o armazenamento fica vazio');
    assert.deepEqual(await readSession(h), {}, 'a memória da sessão também');
    assert.equal(await page.getByRole('button', { name: 'Ajustes', exact: true }).count(), 0, 'volta à primeira abertura');
    assert.equal(await page.getByRole('button', { name: 'Privacidade', exact: true }).count(), 0);
    // Recarregar não traz nada de volta.
    await page.reload();
    await page.getByRole('heading', { name: 'Antes de começar', level: 2 }).waitFor();
    assert.deepEqual(await readStorage(h), {});
    assert.deepEqual(extensionRequests(h), []);
    assert.deepEqual(linkedinHits, []);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
