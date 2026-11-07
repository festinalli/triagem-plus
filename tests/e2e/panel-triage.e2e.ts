// F08 no Chromium: colar o perfil, analisar e guardar sozinho, Top 10 na conversa, Ver todos com filtros, detalhe, mudança de
// requisitos e Gerar PDF. Perfis, nomes e links são inventados, e nenhum teste acessa o LinkedIn: o pedido seria abortado por
// context.route e só o endereço ficaria registrado. O painel abre como aba comum, não como painel lateral.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from 'playwright';
import { readPdf } from '../unit/report/helpers.ts';
import { ROOT, extensionRequests, launch, netLogExtensionJobs, openPanel, readSession, readStorage, resetSession, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';
import { NAMES, expectedOrder, expectedScore, pasteOnScreen, profileUrl, requirement, seeds15, seedWorkspace } from './panel-triage-kit.ts';

const DIST = path.join(ROOT, 'dist');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'profiles');
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, `${name}.txt`), 'utf8');

let h: Harness;
let linkedinHits: string[];

before(async () => {
  h = await launch(DIST);
  linkedinHits = await trapLinkedIn(h);
});

after(async () => {
  fs.rmSync(path.join(os.tmpdir(), 'triagem-e2e-downloads'), { recursive: true, force: true });
  if (h === undefined) return;
  // O net-log do navegador inteiro, de todos os testes deste arquivo: nenhum pedido de rede começou na extensão.
  const { fromExtension } = netLogExtensionJobs(await h.close());
  assert.deepEqual(fromExtension, []);
});

beforeEach(async () => {
  await resetStorage(h);
  await resetSession(h);
  linkedinHits.length = 0;
});

const rows = (page: Page, kind = 'top_ten') => page.locator(`[data-kind="${kind}"] li.tr-person`);
const rowNames = (page: Page, kind = 'top_ten') => rows(page, kind).locator('.tr-person__name').allTextContents();
const candidateKeys = async (): Promise<string[]> => Object.keys(await readStorage(h)).filter((key) => key.startsWith('cand:'));

async function saveDownload(page: Page, click: () => Promise<void>): Promise<{ file: string; name: string }> {
  const dir = path.join(os.tmpdir(), 'triagem-e2e-downloads');
  fs.mkdirSync(dir, { recursive: true });
  const [download] = await Promise.all([page.waitForEvent('download'), click()]);
  const file = path.join(dir, `${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(file);
  return { file, name: download.suggestedFilename() };
}

describe('F08: colar, analisar e guardar sozinho', { timeout: 300_000 }, () => {
  test('colar: nome já preenchido e editável, link https obrigatório, aviso de link fora do padrão', async () => {
    await seedWorkspace(h, []);
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
    await page.getByRole('heading', { name: 'Colar o perfil', level: 2 }).waitFor();

    // O nome vem do que o leitor achou no começo do texto e continua editável.
    await page.getByLabel('Texto do perfil').fill(fixture('pt-um-cargo'));
    assert.equal(await page.getByLabel('Nome', { exact: true }).inputValue(), 'Clara Fictícia Exemplo');
    await page.getByLabel('Nome', { exact: true }).fill('Clara F. Exemplo');
    await page.getByLabel('Texto do perfil').fill(fixture('pt-varios-cargos'));
    assert.equal(await page.getByLabel('Nome', { exact: true }).inputValue(), 'Clara F. Exemplo', 'o que a pessoa escreveu não é trocado');

    // Link: obrigatório e https.
    await page.getByRole('button', { name: 'Analisar', exact: true }).click();
    await page.getByText('Escreva o link do perfil.').waitFor();
    await page.getByLabel('Link do perfil').fill('http://www.linkedin.com/in/clara/');
    await page.getByRole('button', { name: 'Analisar', exact: true }).click();
    await page.getByText('O link precisa começar com https://.').waitFor();
    assert.equal(await page.getByLabel('Texto do perfil').inputValue(), fixture('pt-varios-cargos'), 'o texto colado não se perde no erro');
    assert.deepEqual(await candidateKeys(), []);

    // Link https que não é de perfil: avisa e deixa seguir.
    await page.getByLabel('Link do perfil').fill('https://exemplo.test/pagina-da-clara');
    await page.getByText('não parece ser de um perfil do LinkedIn').first().waitFor();
    await page.getByRole('button', { name: 'Analisar', exact: true }).click();
    await page.getByRole('heading', { name: 'Análise: Clara F. Exemplo', level: 2 }).waitFor();
    await page.getByText('O link não parece ser de um perfil do LinkedIn. Se você colar esta pessoa de novo, ela entra como outra.').waitFor();
    assert.equal((await candidateKeys()).length, 1);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('sem vaga ativa pede para criar ou escolher; vaga sem requisito pede os requisitos (RF-37)', async () => {
    const { page } = await openPanel(h);
    await page.getByLabel('Seu nome').fill('Marina Souza');
    await page.getByLabel('Seu contato').fill('marina@exemplo.test');
    await page.getByRole('button', { name: 'Li os avisos e aceito' }).click();
    await page.getByRole('heading', { name: 'Vamos começar pela vaga' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Colar um perfil' }).count(), 0, 'sem vaga não há botão de colar');
    await page.close();

    // Uma vaga existe mas não está ativa.
    await seedWorkspace(h, []);
    await h.worker.evaluate(async () => {
      const all = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(all['settings'] as object), activeJobId: null } });
    });
    const second = await openPanel(h);
    await second.page.getByRole('heading', { name: 'Suas vagas' }).waitFor();
    await second.page.close();

    // Vaga ativa sem requisito: não há nota, então pede os requisitos.
    await resetStorage(h);
    await seedWorkspace(h, [], { requirements: [] });
    const third = await openPanel(h);
    await third.page.getByRole('button', { name: 'Colar um perfil' }).click();
    await third.page.getByRole('heading', { name: 'Falta cadastrar os requisitos' }).waitFor();
    await third.page.getByText('sem requisitos não há nota').waitFor();
    assert.equal(await third.page.getByLabel('Texto do perfil').count(), 0);
    await third.page.getByRole('button', { name: 'Requisitos', exact: true }).click();
    await third.page.getByRole('heading', { name: 'Requisitos', level: 2, exact: true }).waitFor();
    await third.page.close();
  });

  test('CA-25: depois de uma análise, sem outro clique, a pessoa está na lista, o Top 10 está atualizado e a posição aparece', async () => {
    await seedWorkspace(h, [{ name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java', 'Spring'] }]);
    const { page, errors } = await openPanel(h);
    await page.getByRole('heading', { name: 'Os melhores da lista' }).or(page.getByRole('heading', { name: /candidato/ })).first().waitFor();
    assert.deepEqual(await rowNames(page), ['Alice Fictícia Prado']);

    await pasteOnScreen(page, { name: 'Bruno Imaginário Costa', slug: 'bruno', skills: ['Java', 'Spring', 'Kubernetes'] });
    // Nenhum clique a mais: o resultado, a posição e o Top 10 já estão na conversa.
    await page.getByText('Bruno Imaginário Costa entrou em 1º.').waitFor();
    assert.deepEqual(await rowNames(page), ['Bruno Imaginário Costa', 'Alice Fictícia Prado']);
    assert.equal(await page.getByTestId('top-total').textContent(), 'Total da lista: 2.');
    assert.equal((await candidateKeys()).length, 2, 'já está guardado');
    const saved = Object.values(await readStorage(h)).filter((value) => (value as { name?: string }).name === 'Bruno Imaginário Costa');
    assert.equal(saved.length, 1);

    // Pior nota: entra em 3º.
    await pasteOnScreen(page, { name: 'Carla Inventada Nunes', slug: 'carla', skills: ['Kubernetes'] });
    await page.getByText('Carla Inventada Nunes entrou em 3º.').waitFor();
    assert.deepEqual(await rowNames(page), ['Bruno Imaginário Costa', 'Alice Fictícia Prado', 'Carla Inventada Nunes']);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('o resultado mostra nota, faixa, cada requisito com prova, avisos e as frases certas (RF-50, RF-51, RF-56)', async () => {
    await seedWorkspace(h, [], { requirements: [requirement('term', 'Java', 'required', 5), requirement('term', 'Spring'), requirement('term', 'Docker', 'preferred'), requirement('term', 'Zorgblat', 'preferred')] });
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
    await page.getByLabel('Texto do perfil').fill(fixture('pt-um-cargo'));
    await page.getByLabel('Link do perfil').fill('https://www.linkedin.com/in/clara-ficticia/');
    await page.getByRole('button', { name: 'Analisar', exact: true }).click();
    const result = page.locator('[data-kind="analysis_result"]');
    await result.getByRole('heading', { name: 'Análise: Clara Fictícia Exemplo' }).waitFor();
    await result.locator('.tr-score').waitFor();
    assert.match((await result.locator('.tr-score').textContent()) ?? '', /\d+(Forte|Parcial|Fraco)/);
    const status = async (label: string): Promise<string> => (await result.locator('li.tr-req', { hasText: label }).locator('.tr-pill__text').first().textContent()) ?? '';
    assert.equal(await status('Spring'), 'Bateu');
    assert.equal(await status('Docker'), 'Não encontrado no texto');
    assert.equal(await status('Zorgblat'), 'Não encontrado no texto');
    // Prova: seção, termo, cargo e tempo. Sem trecho de texto livre.
    await result.locator('li.tr-req', { hasText: 'Spring' }).getByText(/^Experiência: Spring · cargo .+ · /).waitFor();
    await result.locator('li.tr-req', { hasText: 'Spring' }).getByText(/^Competências: Spring/).waitFor();
    // Nunca "não tem".
    assert.equal(await page.getByText(/não tem/i).count(), 0);
    await result.getByText('A nota é apoio, e a decisão é sua.').waitFor();
    await result.getByRole('button', { name: 'Tirar da lista' }).waitFor();
    await result.getByRole('button', { name: 'Somar mais texto' }).waitFor();
    await result.getByRole('button', { name: 'Ver detalhe' }).waitFor();
    await page.close();
  });

  test('RF-55: ao editar os requisitos, a nota de todos é refeita pela ficha, e o termo novo fica "precisa analisar de novo"', async () => {
    await seedWorkspace(h, [
      { name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java', 'Spring'] },
      { name: 'Bruno Imaginário Costa', slug: 'bruno', skills: ['Java'] },
    ]);
    const { page, errors } = await openPanel(h);
    await page.getByRole('heading', { name: /candidatos da lista/ }).waitFor();
    assert.deepEqual(await page.locator('[data-kind="top_ten"] .tr-score__num').allTextContents(), [String(expectedScore(['Java', 'Spring'])), String(expectedScore(['Java']))]);
    await page.getByRole('button', { name: 'Requisitos', exact: true }).click();
    await page.getByRole('heading', { name: 'Requisitos', level: 2, exact: true }).waitFor();
    // Termo da lista que não está na ficha: "não encontrado". Termo livre que nunca foi procurado: "precisa analisar de novo".
    await page.getByLabel('Requisito', { exact: true }).fill('Docker');
    await page.locator('#hand-importance, select[name="importance"]').first().selectOption('preferred');
    await page.getByRole('button', { name: 'Adicionar requisito' }).click();
    // Espera o primeiro entrar na lista: a tela se refaz depois de guardar e apagaria o que fosse digitado nesse meio-tempo.
    await page.getByRole('list', { name: 'Requisitos cadastrados' }).getByText('Docker', { exact: true }).waitFor();
    await page.getByLabel('Requisito', { exact: true }).fill('Zorgblat');
    await page.getByRole('button', { name: 'Adicionar requisito' }).click();
    await page.getByRole('list', { name: 'Requisitos cadastrados' }).getByText('Zorgblat', { exact: true }).waitFor();
    const stored = Object.entries(await readStorage(h)).filter(([key]) => key.startsWith('cand:')).map(([, value]) => value as { name: string; match: { results: Array<{ status: string }> } });
    assert.equal(stored.length, 2);
    for (const candidate of stored) {
      assert.equal(candidate.match.results.length, 5, 'um resultado por requisito novo');
      assert.equal(candidate.match.results.filter((r) => r.status === 'needs_reanalysis').length, 1);
    }
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.locator('[data-kind="top_ten"]').waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });
});

describe('F08: Top 10, empate e total (CA-11)', { timeout: 420_000 }, () => {
  test('15 candidatos colados pela tela: Top 10 em ordem, empate pelas regras, total 15 e quem ficou fora', async () => {
    await seedWorkspace(h, []);
    const { page, errors } = await openPanel(h);
    const people = seeds15();
    for (const person of people) await pasteOnScreen(page, person);
    assert.equal((await candidateKeys()).length, 15);

    const order = expectedOrder(people);
    assert.deepEqual(await rowNames(page), order.slice(0, 10).map((person) => person.name), 'os 10 primeiros, na ordem');
    assert.deepEqual(
      await page.locator('[data-kind="top_ten"] .tr-person__rank').allTextContents(),
      Array.from({ length: 10 }, (_, i) => `${i + 1}º`),
    );
    assert.deepEqual(
      await page.locator('[data-kind="top_ten"] .tr-score__num').allTextContents(),
      order.slice(0, 10).map((person) => String(expectedScore(person.skills))),
    );
    assert.equal(await page.getByTestId('top-total').textContent(), 'Mostrando 10 de 15 na lista.');
    // O último colado ([Spring], 43) ficou entre os que não cabem: a mensagem diz que ficou fora dos 10.
    const last = people[14]!;
    assert.ok(!(await rowNames(page)).includes(last.name));
    await page.getByText(`${last.name} ficou fora dos 10: está em ${order.indexOf(last) + 1}º, entre 15.`).waitFor();

    // Empate em 100: quem entrou primeiro fica na frente.
    const hundreds = order.filter((person) => expectedScore(person.skills) === 100).map((person) => person.name);
    assert.deepEqual(hundreds, [NAMES[0], NAMES[2], NAMES[7], NAMES[12]]);

    // Ver todos traz os 15, sem filtro e sem ninguém de fora.
    await page.getByRole('button', { name: 'Ver todos' }).click();
    await page.getByRole('heading', { name: 'Todos da lista', level: 2 }).waitFor();
    assert.deepEqual(await rowNames(page, 'candidate_list'), order.map((person) => person.name));
    await page.getByText('Mostrando 15 de 15.').waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('reabrir o painel mostra o Top 10 a partir da lista, sem o resultado da última análise (RF-61, RF-69, CA-26)', async () => {
    await seedWorkspace(h, seeds15());
    const { page } = await openPanel(h);
    await page.locator('[data-kind="top_ten"]').waitFor();
    const order = expectedOrder(seeds15());
    assert.deepEqual(await rowNames(page), order.slice(0, 10).map((person) => person.name));
    assert.equal(await page.locator('[data-kind="analysis_result"]').count(), 0);
    assert.equal(await page.locator('[data-kind="top_ten"] .tr-notice').count(), 0, 'nenhuma frase de "entrou em" sem análise nova');
    // O Top 10 vem antes do resumo da vaga.
    const kinds = await page.locator('main [data-kind]').evaluateAll((els) => els.map((el) => el.getAttribute('data-kind')));
    assert.deepEqual(kinds, ['top_ten', 'job_summary']);
    await page.close();
  });
});

describe('F08: memória e privacidade (CA-09, CA-10, CA-26)', { timeout: 300_000 }, () => {
  const SENTINELAS = ['ZEBRAXPTO', 'QUIMERAXPTO', 'GIRASSOLXPTO', 'CAMBUCIXPTO'];

  test('CA-10: nenhum texto do perfil vai para o armazenamento local, só a ficha; o texto fica só na memória da sessão', async () => {
    await seedWorkspace(h, []);
    const { page } = await openPanel(h);
    const texto = [
      'Mariana Inventada Prado',
      `Gerente de ${SENTINELAS[0]} · Ela/Dela`,
      `${SENTINELAS[1]}, Minas Gerais, Brasil`,
      '',
      'Sobre',
      `Gosto de ${SENTINELAS[2]} e de Java.`,
      '',
      'Experiência',
      'Desenvolvedora Sênior',
      `Empresa ${SENTINELAS[3]} · Tempo integral`,
      'jan de 2020 - o momento · 6 anos 10 meses',
      'Belo Horizonte, Brasil',
      `Trabalho com ${SENTINELAS[0]} e Java.`,
      'Competências: Java, Spring',
      '',
      'Formação acadêmica',
      `Universidade ${SENTINELAS[1]}`,
      '',
      'Competências',
      'Java',
      'Spring',
    ].join('\n');
    await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
    await page.getByLabel('Texto do perfil').fill(texto);
    await page.getByLabel('Link do perfil').fill(profileUrl('mariana-inventada'));
    await page.getByRole('button', { name: 'Analisar', exact: true }).click();
    await page.getByRole('heading', { name: 'Análise: Mariana Inventada Prado', level: 2 }).waitFor();

    const local = JSON.stringify(await readStorage(h));
    for (const palavra of SENTINELAS) assert.ok(!local.includes(palavra), `${palavra} não pode estar no armazenamento local`);
    assert.ok(!local.includes('Ela/Dela') && !local.includes('Minas Gerais') && !local.includes('Belo Horizonte'));
    assert.ok(!local.includes('Desenvolvedora Sênior'), 'o texto do cargo não entra: só a palavra de cargo da lista fechada');

    // A ficha só tem os campos previstos, e nenhum dos que "nunca são guardados".
    const [cand] = Object.entries(await readStorage(h)).filter(([key]) => key.startsWith('cand:')).map(([, value]) => value as Record<string, unknown>);
    assert.ok(cand);
    assert.deepEqual(Object.keys(cand).sort(), ['addedAt', 'card', 'favorite', 'id', 'informedAt', 'jobId', 'match', 'name', 'notes', 'profileKey', 'profileUrl', 'source', 'stage', 'updatedAt']);
    assert.deepEqual(Object.keys(cand['card'] as object).sort(), ['currentTitle', 'searchedFreeTerms', 'sectionsRead', 'terms', 'totalMonths', 'truncated']);
    for (const proibido of ['headline', 'about', 'location', 'company', 'education', 'photo', 'age', 'gender', 'pronouns', 'text', 'contact']) {
      assert.ok(!(proibido in cand) && !(proibido in (cand['card'] as object)), proibido);
    }

    // O texto fica só na memória da sessão, com a chave do perfil.
    const session = await readSession(h);
    const memory = session['lastAnalysisText'] as { profileKey: string; text: string } | undefined;
    assert.ok(memory, 'o texto da última análise está na memória da sessão');
    assert.equal(memory.profileKey, '/in/mariana-inventada/');
    assert.ok(memory.text.includes(SENTINELAS[0]!));
    assert.deepEqual(Object.keys(session), ['lastAnalysisText']);
    await page.close();
  });

  test('CA-09: Tirar da lista apaga a ficha e o texto em memória; analisar outro perfil substitui o texto anterior', async () => {
    await seedWorkspace(h, []);
    const { page, errors } = await openPanel(h);
    await pasteOnScreen(page, { name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java', 'Spring'], extra: 'PALAVRAALICEXPTO' });
    assert.equal(((await readSession(h))['lastAnalysisText'] as { text: string }).text.includes('PALAVRAALICEXPTO'), true);

    // Analisar outro perfil: o texto da Alice some de todo lugar.
    await pasteOnScreen(page, { name: 'Bruno Imaginário Costa', slug: 'bruno', skills: ['Java'], extra: 'PALAVRABRUNOXPTO' });
    const memory = (await readSession(h))['lastAnalysisText'] as { profileKey: string; text: string };
    assert.equal(memory.profileKey, '/in/bruno/');
    assert.ok(memory.text.includes('PALAVRABRUNOXPTO'));
    assert.ok(!memory.text.includes('PALAVRAALICEXPTO'), 'o texto anterior não existe em lugar nenhum');
    assert.ok(!JSON.stringify(await readSession(h)).includes('PALAVRAALICEXPTO'));
    assert.ok(!JSON.stringify(await readStorage(h)).includes('PALAVRAALICEXPTO'));
    assert.equal((await candidateKeys()).length, 2);

    // Tirar da lista: ficha e texto em memória, de uma vez.
    await page.locator('[data-kind="analysis_result"]').getByRole('button', { name: 'Tirar da lista' }).click();
    await page.getByText('A pessoa saiu da lista e a ficha foi apagada.').waitFor();
    assert.deepEqual(await readSession(h), {}, 'nada fica na memória da sessão');
    const left = await readStorage(h);
    assert.equal(Object.keys(left).filter((key) => key.startsWith('cand:')).length, 1);
    assert.ok(!JSON.stringify(left).includes('Bruno'), 'nada do Bruno fica guardado');
    assert.equal(await page.getByText('Bruno Imaginário Costa').count(), 0, 'nem na tela');
    assert.deepEqual(await rowNames(page), ['Alice Fictícia Prado']);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('CA-26: reabrir mostra só o que está guardado, e apagar alguém o tira de todas as mensagens', async () => {
    await seedWorkspace(h, [
      { name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java', 'Spring', 'Kubernetes'] },
      { name: 'Bruno Imaginário Costa', slug: 'bruno', skills: ['Java', 'Spring'] },
      { name: 'Carla Inventada Nunes', slug: 'carla', skills: ['Java'] },
    ]);
    const first = await openPanel(h);
    await pasteOnScreen(first.page, { name: 'Davi Exemplo Ramos', slug: 'davi', skills: ['Spring'] });
    await first.page.close();

    // Painel novo: nada da conversa antiga, só a lista.
    const { page, errors } = await openPanel(h);
    await page.locator('[data-kind="top_ten"]').waitFor();
    assert.equal(await page.locator('[data-kind="analysis_result"]').count(), 0);
    assert.deepEqual(await rowNames(page), ['Alice Fictícia Prado', 'Bruno Imaginário Costa', 'Carla Inventada Nunes', 'Davi Exemplo Ramos']);

    // Apagar pelo detalhe, com confirmação.
    await rows(page).filter({ hasText: 'Carla Inventada Nunes' }).getByRole('button', { name: 'Ver detalhe' }).click();
    await page.getByRole('heading', { name: 'Detalhe: Carla Inventada Nunes', level: 2 }).waitFor();
    await page.getByRole('button', { name: 'Apagar a ficha', exact: true }).click();
    await page.getByRole('heading', { name: 'Apagar esta ficha?' }).waitFor();
    assert.equal((await candidateKeys()).length, 4, 'só confirmar apaga');
    await page.getByRole('button', { name: 'Apagar a ficha de vez' }).click();
    await page.getByText('A ficha foi apagada.').waitFor();
    assert.equal((await candidateKeys()).length, 3);
    assert.ok(!JSON.stringify(await readStorage(h)).includes('Carla Inventada'));
    assert.equal(await page.getByText('Carla Inventada Nunes').count(), 0, 'sumiu de todas as mensagens');
    await page.getByRole('button', { name: 'Ver todos' }).click();
    await page.getByRole('heading', { name: 'Todos da lista' }).waitFor();
    assert.equal(await page.getByText('Carla Inventada Nunes').count(), 0);
    await page.getByText('Mostrando 3 de 3.').waitFor();

    // E depois de fechar e abrir de novo, continua fora.
    await page.close();
    const again = await openPanel(h);
    await again.page.locator('[data-kind="top_ten"]').waitFor();
    assert.equal(await again.page.getByText('Carla Inventada Nunes').count(), 0);
    assert.deepEqual([...errors, ...again.errors], []);
    await again.page.close();
  });

  test('texto de terceiros é só texto: nome malicioso aparece como texto e não cria elemento (RNF-04)', async () => {
    await seedWorkspace(h, []);
    const { page, errors } = await openPanel(h);
    const malicioso = '<img src=x onerror="window.__invadido=1"> <b>Negrito</b> "&amp;';
    await pasteOnScreen(page, { name: malicioso, slug: 'ataque', skills: ['Java'], url: 'https://www.linkedin.com/in/ataque/' });
    for (const where of ['[data-kind="analysis_result"]', '[data-kind="top_ten"]']) {
      const box = page.locator(where);
      await box.getByText(malicioso, { exact: false }).first().waitFor();
      assert.equal(await box.locator('img, b').count(), 0, `nenhum elemento criado em ${where}`);
    }
    assert.equal(await page.evaluate(() => (window as unknown as { __invadido?: number }).__invadido), undefined);
    // Também no detalhe, na lista e no PDF que sai do painel.
    await page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    await page.getByRole('heading', { name: `Detalhe: ${malicioso}`, level: 2 }).waitFor();
    assert.equal(await page.locator('main img, main b').count(), 0);
    // Link que não é https não vira link clicável.
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    assert.equal(await page.locator('main a[href^="javascript"], main a[href^="http:"]').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });
});

describe('F08: Ver todos, filtros e detalhe (RF-60, RF-62 a RF-65, RF-90)', { timeout: 300_000 }, () => {
  test('CA-12: o filtro mostra quantos ficaram de fora e não apaga ninguém', async () => {
    const people = seeds15();
    await seedWorkspace(h, people);
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Ver todos' }).click();
    await page.getByRole('heading', { name: 'Todos da lista', level: 2 }).waitFor();
    await page.getByLabel('Tecnologia ou ferramenta').fill('kubernetes');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    const withK = people.filter((person) => person.skills.includes('Kubernetes'));
    await page.getByText(`Mostrando ${withK.length} de 15.`).waitFor();
    await page.getByText(`${15 - withK.length} ficaram de fora dos filtros. Ninguém foi apagado`).waitFor();
    assert.deepEqual(await rowNames(page, 'candidate_list'), expectedOrder(withK).map((person) => person.name));
    assert.equal((await candidateKeys()).length, 15, 'filtrar não apaga ninguém');

    // Faixa + etapa + obrigatórios: cada filtro mexe só no que aparece.
    await page.getByLabel('Faixa').selectOption('strong');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    const strong = withK.filter((person) => expectedScore(person.skills) >= 75 && ['Java', 'Spring'].every((term) => person.skills.includes(term)));
    await page.getByText(`Mostrando ${strong.length} de 15.`).waitFor();
    await page.getByLabel('Só quem atende a todos os obrigatórios').check();
    await page.getByLabel('Experiência mínima (anos)').fill('5');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    await page.getByText(`Mostrando ${strong.length} de 15.`).waitFor();
    await page.getByLabel('Experiência mínima (anos)').fill('9');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    await page.getByText('Mostrando 0 de 15.').waitFor();
    await page.getByText('Ninguém passa pelos filtros escolhidos.').waitFor();
    assert.equal((await candidateKeys()).length, 15);

    // Tirar os filtros traz todos de volta.
    await page.getByRole('button', { name: 'Tirar os filtros' }).click();
    await page.getByText('Mostrando 15 de 15.').waitFor();
    assert.equal(await page.getByText('ficaram de fora').count(), 0);
    // Termo da trava não vira filtro.
    await page.getByLabel('Tecnologia ou ferramenta').fill('solteiro');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    await page.getByText(/Estado civil/).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('detalhe: explicação, etapa, favorito e notas com alerta da trava (que avisa e não bloqueia)', async () => {
    await seedWorkspace(h, [{ name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java', 'Spring'] }]);
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Ver detalhe' }).click();
    const detail = page.locator('[data-kind="candidate_detail"]');
    await detail.getByRole('heading', { name: 'Detalhe: Alice Fictícia Prado', level: 2 }).waitFor();
    await detail.getByText('1º lugar entre 1.').waitFor();
    await detail.getByText('Ainda não informado.').waitFor();
    await detail.getByText('A nota é apoio, e a decisão é sua.').waitFor();
    const link = detail.locator('a.tr-person__link');
    assert.equal(await link.getAttribute('href'), profileUrl('alice'));
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await detail.locator('li.tr-req').count(), 3);

    await detail.getByLabel('Etapa', { exact: true }).selectOption('interview');
    await detail.getByLabel('Favorito', { exact: true }).check();
    await detail.getByLabel('Notas', { exact: true }).fill('Ligar na terça. Ela é casada e tem filhos pequenos.');
    await detail.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Alterações salvas.').waitFor();
    await detail.getByText('Cuidado com o que você anota').waitFor();
    const [saved] = Object.entries(await readStorage(h)).filter(([key]) => key.startsWith('cand:')).map(([, value]) => value as { stage: string; favorite: boolean; notes: string; match: { score: number } });
    assert.deepEqual([saved?.stage, saved?.favorite, saved?.notes], ['interview', true, 'Ligar na terça. Ela é casada e tem filhos pequenos.'], 'a nota foi guardada mesmo com o alerta');
    assert.equal(saved?.match.score, expectedScore(['Java', 'Spring']), 'notas nunca entram na nota');
    // Nota limpa: sem alerta.
    await detail.getByLabel('Notas', { exact: true }).fill('Ligar na terça. Boa conversa sobre Kafka.');
    await detail.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Alterações salvas.').waitFor();
    assert.equal(await detail.getByText('Cuidado com o que você anota').count(), 0);
    // A etapa aparece no Top 10.
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.getByText(/Entrevista/).first().waitFor();
    await page.getByText('Favorito', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('RF-90: nos 7 dias finais a tela avisa e deixa renovar pessoa por pessoa', async () => {
    await seedWorkspace(h, [
      { name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java', 'Spring'], ageDays: 176 },
      { name: 'Bruno Imaginário Costa', slug: 'bruno', skills: ['Java'], ageDays: 10 },
    ]);
    const { page, errors } = await openPanel(h);
    await page.locator('[data-kind="top_ten"]').waitFor();
    await rows(page).filter({ hasText: 'Alice' }).getByText('Prazo acabando').waitFor();
    assert.equal(await rows(page).filter({ hasText: 'Bruno' }).getByText('Prazo acabando').count(), 0);
    await rows(page).filter({ hasText: 'Bruno' }).getByRole('button', { name: 'Ver detalhe' }).click();
    assert.equal(await page.getByRole('button', { name: 'Renovar o prazo' }).count(), 0, 'fora da janela não aparece');
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await rows(page).filter({ hasText: 'Alice' }).getByRole('button', { name: 'Ver detalhe' }).click();
    await page.getByText('O prazo de guarda está acabando').waitFor();
    const before = Date.now();
    await page.getByRole('button', { name: 'Renovar o prazo' }).click();
    await page.getByText('Prazo renovado.').waitFor();
    assert.equal(await page.getByText('O prazo de guarda está acabando').count(), 0);
    const alice = Object.values(await readStorage(h)).find((value) => (value as { name?: string }).name === 'Alice Fictícia Prado') as { updatedAt: number };
    assert.ok(alice.updatedAt >= before);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('RF-35 e RF-34: leitura incompleta diz o que faltou; somar mais texto completa a ficha da mesma pessoa', async () => {
    await seedWorkspace(h, [], { requirements: [requirement('term', 'React'), requirement('term', 'TypeScript'), requirement('term', 'CSS', 'preferred')] });
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
    await page.getByLabel('Texto do perfil').fill(fixture('lista-cortada'));
    await page.getByLabel('Link do perfil').fill(profileUrl('olivia-ficticia'));
    await page.getByRole('button', { name: 'Analisar', exact: true }).click();
    const result = page.locator('[data-kind="analysis_result"]');
    await result.getByRole('heading', { name: 'Análise: Olívia Fictícia Ramos' }).waitFor();
    await result.getByText('A leitura pode estar incompleta').waitFor();
    await result.getByText('O perfil mostra listas cortadas', { exact: false }).waitFor();
    await result.getByText('role a página até o fim, abra “ver tudo” nas seções cortadas, ou cole o texto completo', { exact: false }).waitFor();
    // Somar o texto que faltou ao mesmo candidato.
    await result.getByRole('button', { name: 'Somar mais texto' }).click();
    await page.getByRole('heading', { name: 'Somar mais texto', level: 2 }).waitFor();
    assert.equal(await page.getByLabel('Nome', { exact: true }).inputValue(), 'Olívia Fictícia Ramos');
    assert.equal(await page.getByLabel('Link do perfil').inputValue(), profileUrl('olivia-ficticia'));
    await page.getByLabel('Texto do perfil').fill(fixture('detalhes-competencias'));
    await page.getByRole('button', { name: 'Somar e analisar de novo' }).click();
    await page.getByRole('heading', { name: 'Análise: Olívia Fictícia Ramos', level: 2 }).waitFor();
    await page.getByText('Esta pessoa já estava na lista. A ficha foi atualizada, sem duplicar.').waitFor();
    assert.equal((await candidateKeys()).length, 1, 'mesma pessoa, sem duplicar');
    const css = page.locator('[data-kind="analysis_result"] li.tr-req', { hasText: 'CSS' });
    assert.equal(await css.locator('.tr-pill__text').first().textContent(), 'Bateu', 'o termo que só estava na lista completa agora bate');
    assert.deepEqual(errors, []);
    await page.close();
  });
});

describe('F08: Gerar PDF (RF-70 a RF-75, CA-13)', { timeout: 420_000 }, () => {
  test('o clique baixa o PDF direto: nomes, notas e links https conferidos; aviso aceito na primeira vez e depois sempre visível', async () => {
    const people = seeds15();
    await seedWorkspace(h, people);
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Gerar PDF' }).click();
    await page.getByRole('heading', { name: 'Gerar PDF', level: 2 }).waitFor();
    await page.getByText('O arquivo tem dados pessoais. Ele sai do controle da Triagem+').waitFor();
    assert.equal(await page.getByLabel('Incluir as minhas notas sobre cada pessoa').isChecked(), false, 'notas desmarcadas por padrão');
    assert.equal(await page.getByLabel('Os 10 melhores').isChecked(), true);
    assert.equal(((await readStorage(h))['settings'] as { acceptances: { fileExport?: unknown } }).acceptances.fileExport, undefined);

    const { file, name } = await saveDownload(page, () => page.getByRole('button', { name: 'Entendi o aviso e gerar PDF' }).click());
    assert.match(name, /^triagem-pessoa-desenvolvedora-java-\d{4}-\d{2}-\d{2}\.pdf$/);
    const accepted = ((await readStorage(h))['settings'] as { acceptances: { fileExport?: { version: number; at: number } } }).acceptances.fileExport;
    assert.equal(accepted?.version, 1);
    assert.ok((accepted?.at ?? 0) > 0);

    const bytes = new Uint8Array(fs.readFileSync(file));
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('latin1'), '%PDF-');
    const pdf = await readPdf(bytes);
    const order = expectedOrder(people).slice(0, 10);
    for (const [index, person] of order.entries()) {
      assert.ok(pdf.text.includes(`${index + 1}. ${person.name.replace(/[^\x20-\x7e]/g, (c) => c)}`), `posição ${index + 1}: ${person.name}`);
    }
    assert.deepEqual(pdf.links, order.map((person) => profileUrl(person.slug)), 'link https clicável de cada um, na ordem');
    const flat = pdf.text.split('\n').join(' ');
    assert.ok(flat.includes('Os 10 melhores entre 15 candidatos'));
    assert.ok(flat.includes('A nota é apoio, e a decisão é sua.'));
    assert.ok(!pdf.text.includes(people[14]!.name) || order.includes(people[14]!), 'quem ficou de fora não entra');
    assert.ok(flat.includes('Este arquivo tem dados pessoais.'));

    // Depois: o aviso fica visível junto do botão, sem pedir outro aceite.
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.getByRole('button', { name: 'Gerar PDF' }).click();
    await page.getByText('O arquivo tem dados pessoais. Ele sai do controle da Triagem+').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Entendi o aviso e gerar PDF' }).count(), 0);
    assert.equal(await page.getByText('É a primeira vez').count(), 0);
    const second = await saveDownload(page, () => page.getByRole('button', { name: 'Gerar PDF', exact: true }).click());
    assert.ok(fs.statSync(second.file).size > 1000);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('todos os filtrados, notas só se marcadas, e a planilha com o mesmo conteúdo e a coluna "A rever"', async () => {
    const people = seeds15();
    await seedWorkspace(h, people, { fileExportAccepted: true });
    const { page, errors } = await openPanel(h);
    // Uma nota com palavra-sentinela na primeira pessoa do Top 10.
    const first = expectedOrder(people)[0]!;
    await rows(page).filter({ hasText: first.name }).getByRole('button', { name: 'Ver detalhe' }).click();
    await page.getByLabel('Notas', { exact: true }).fill('NOTAXPTO combinar horário');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Alterações salvas.').waitFor();

    // Filtro: só quem tem Kubernetes; o relatório usa a lista filtrada.
    await page.getByRole('button', { name: 'Ver todos' }).click();
    await page.getByLabel('Tecnologia ou ferramenta').fill('kubernetes');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    const withK = expectedOrder(people.filter((person) => person.skills.includes('Kubernetes')));
    await page.getByText(`Mostrando ${withK.length} de 15.`).waitFor();
    await page.getByRole('button', { name: 'Gerar PDF' }).click();
    await page.getByLabel(`Todos os que estão na lista filtrada (${withK.length})`).check();

    const plain = await saveDownload(page, () => page.getByRole('button', { name: 'Gerar PDF', exact: true }).click());
    const pdfPlain = await readPdf(new Uint8Array(fs.readFileSync(plain.file)));
    assert.deepEqual(pdfPlain.links, withK.map((person) => profileUrl(person.slug)), 'só os filtrados, na ordem');
    assert.ok(!pdfPlain.text.includes('NOTAXPTO'), 'notas fora por padrão');
    assert.ok(!pdfPlain.text.includes('Notas'));

    await page.getByLabel('Incluir as minhas notas sobre cada pessoa').check();
    const withNotes = await saveDownload(page, () => page.getByRole('button', { name: 'Gerar PDF', exact: true }).click());
    const pdfNotes = await readPdf(new Uint8Array(fs.readFileSync(withNotes.file)));
    assert.ok(pdfNotes.text.includes('NOTAXPTO combinar horário'));
    assert.equal([...pdfNotes.text.matchAll(/Sem notas/g)].length, withK.length - 1);

    // Planilha: mesmo conteúdo, com A rever em coluna própria.
    await page.getByLabel('Incluir as minhas notas sobre cada pessoa').uncheck();
    const csv = await saveDownload(page, () => page.getByRole('button', { name: 'Baixar planilha (CSV)' }).click());
    assert.match(csv.name, /\.csv$/);
    const text = fs.readFileSync(csv.file, 'utf8');
    const all = text.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line !== '');
    // Antes da tabela: título, data, requisitos, abrangência com os filtros, legenda de "Faltou" e avisos (RF-70 a RF-72).
    const headerAt = all.findIndex((line) => line.startsWith('Posição;'));
    assert.ok(headerAt > 0, 'há linhas antes da tabela');
    const intro = all.slice(0, headerAt);
    assert.equal(intro[0], 'Triagem+: Pessoa desenvolvedora Java');
    assert.ok(intro.some((line) => line.startsWith('Relatório gerado em ')));
    assert.ok(intro.includes('Java;Obrigatório'));
    // A frase tem aspas, então a célula vem entre aspas com as aspas dobradas.
    assert.ok(intro.includes(`"${withK.length} de 15 candidatos, com filtro: termo ""kubernetes"""`));
    assert.ok(intro.some((line) => line.includes('Faltou significa que não foi encontrado no texto do perfil')));
    assert.ok(intro.some((line) => line.includes('A nota é apoio, e a decisão é sua.')));
    assert.ok(intro.some((line) => line.includes('Este arquivo tem dados pessoais.')));
    const lines = all.slice(headerAt);
    assert.equal(lines[0], 'Posição;Nome;Link;Nota;Faixa;Experiência total;Cargo atual;Etapa;Bateu;Faltou;A rever');
    assert.equal(lines.length, withK.length + 1);
    assert.ok(lines[1]?.startsWith(`1;${withK[0]!.name};${profileUrl(withK[0]!.slug)};${expectedScore(withK[0]!.skills)};`));
    assert.ok(pdfPlain.text.replace(/\s+/g, ' ').includes('Faltou significa que não foi encontrado'), 'a legenda também está no PDF');
    assert.ok(pdfPlain.text.replace(/\s+/g, ' ').includes(`${withK.length} de 15 candidatos, com filtro: termo "kubernetes"`));
    assert.ok(!text.includes('NOTAXPTO'));
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('RF-75: nome em outro alfabeto sai com "?" e a tela avisa para conferir pelo link; texto malicioso no nome sai como texto', async () => {
    await seedWorkspace(h, [], { });
    const { page, errors } = await openPanel(h);
    await pasteOnScreen(page, { name: '山田 太郎', slug: 'yamada', skills: ['Java', 'Spring'] });
    await pasteOnScreen(page, { name: 'Maria ) Tj /F1 99 Tf (injetado', slug: 'maria', skills: ['Java'] });
    await page.getByRole('button', { name: 'Gerar PDF' }).click();
    await page.getByRole('heading', { name: 'Gerar PDF', level: 2 }).waitFor();
    const out = await saveDownload(page, () => page.getByRole('button', { name: 'Entendi o aviso e gerar PDF' }).click());
    await page.getByText('Confira alguns nomes pelo link').waitFor();
    await page.getByText('4 letras não existem no PDF e saíram como “?”', { exact: false }).waitFor();
    const pdf = await readPdf(new Uint8Array(fs.readFileSync(out.file)));
    assert.ok(pdf.text.includes('1. ?? ??'), 'o nome em japonês sai com ?');
    assert.ok(pdf.text.includes('2. Maria ) Tj /F1 99 Tf (injetado'), 'o texto malicioso sai como texto');
    assert.deepEqual(pdf.links, [profileUrl('yamada'), profileUrl('maria')]);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('o arquivo não traz código executável nem recurso externo (CA-13)', async () => {
    await seedWorkspace(h, seeds15().slice(0, 3), { fileExportAccepted: true });
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Gerar PDF' }).click();
    const out = await saveDownload(page, () => page.getByRole('button', { name: 'Gerar PDF', exact: true }).click());
    const raw = fs.readFileSync(out.file).toString('latin1');
    for (const proibido of ['/JavaScript', '/JS', '/OpenAction', '/Launch', '/EmbeddedFile', '/XObject', '/Image', '/AA']) assert.ok(!raw.includes(proibido), proibido);
    const uris = [...raw.matchAll(/\/URI \(([^)]*)\)/g)].map((match) => match[1]);
    assert.ok(uris.length >= 3 && uris.every((uri) => uri?.startsWith('https://')));
    await page.close();
  });
});

describe('F08: rede zero e LinkedIn intocado na jornada toda (RNF-01, CA-17)', { timeout: 120_000 }, () => {
  test('depois de colar, filtrar, ver detalhe e baixar, nenhum pedido saiu da extensão e o LinkedIn não foi acessado', async () => {
    await seedWorkspace(h, []);
    const { page, errors } = await openPanel(h);
    await pasteOnScreen(page, { name: 'Alice Fictícia Prado', slug: 'alice', skills: ['Java', 'Spring'] });
    await pasteOnScreen(page, { name: 'Bruno Imaginário Costa', slug: 'bruno', skills: ['Java', 'Kubernetes'] });
    await page.getByRole('button', { name: 'Ver todos' }).click();
    await page.getByLabel('Tecnologia ou ferramenta').fill('java');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    await page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.getByRole('button', { name: 'Gerar PDF' }).click();
    await saveDownload(page, () => page.getByRole('button', { name: 'Entendi o aviso e gerar PDF' }).click());
    await saveDownload(page, () => page.getByRole('button', { name: 'Entendi o aviso e baixar planilha' }).or(page.getByRole('button', { name: 'Baixar planilha (CSV)' })).click());
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.locator('[data-kind="top_ten"]').getByRole('button', { name: 'Ver detalhe' }).first().click();
    await page.getByRole('button', { name: 'Apagar a ficha', exact: true }).click();
    await page.getByRole('button', { name: 'Apagar a ficha de vez' }).click();
    await page.getByText('A ficha foi apagada.').waitFor();
    assert.deepEqual(errors, []);
    await page.close();

    // Controle positivo: uma página comum que pede algo é vista pelo registrador, então o zero abaixo vale.
    const control = await h.context.newPage();
    await control.goto(h.controlUrl);
    await control.evaluate((url) => fetch(url + 'controle').then((r) => r.text()), h.controlUrl);
    await control.close();
    assert.ok(h.serverHits.includes('/controle'));

    assert.deepEqual(extensionRequests(h), []);
    assert.deepEqual(linkedinHits, [], 'nenhum teste acessa o LinkedIn');
    assert.ok(h.requests.some((r) => r.url.startsWith('chrome-extension://')), 'o registrador viu o painel abrir');
  });
});
