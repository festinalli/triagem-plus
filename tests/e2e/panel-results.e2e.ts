// A página de resultados no Chromium (D-09, RF-38, RF-39): a função de leitura numa página simulada e o painel consumindo a leitura.
// O gesto de verdade não dá para automatizar, e a página real pode ter outra estrutura: é o roteiro manual.
// Nenhum teste acessa o LinkedIn. Pessoas e empresas inventadas.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Page } from 'playwright';
import { readResults } from '../../src/background/read-results.ts';
import { waitForMain } from '../../src/background/wait-main.ts';
import { parseResults } from '../../src/core/results/parse.ts';
import { ROOT, launch, openPanel, readSession, readStorage, resetSession, resetStorage } from './harness.ts';
import type { Harness } from './harness.ts';
import { profile, seedWorkspace } from './panel-triage-kit.ts';

const DIST = path.join(ROOT, 'dist');
const PAGE_URL = 'https://www.linkedin.com/search/results/people/?keywords=teste';

let h: Harness;

before(async () => {
  h = await launch(DIST);
  await h.context.route('https://www.linkedin.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
});
after(async () => {
  await h.close();
});
beforeEach(async () => {
  await resetStorage(h);
  await resetSession(h);
});

interface Person {
  readonly slug: string;
  readonly name: string;
  readonly headline: string;
  readonly mutual?: boolean;
}

const PEOPLE: readonly Person[] = [
  { slug: 'ana-exemplo', name: 'Ana Exemplo', headline: 'Desenvolvedora | Java | Spring', mutual: true },
  { slug: 'bia-exemplo', name: 'Bia Exemplo', headline: 'Engenheira de software | Java' },
  { slug: 'caio-exemplo', name: 'Caio Exemplo', headline: 'Coordenador de marketing' },
];

/** Cartão no formato visto nos resultados: foto com link sem texto, nome com texto escondido, conexões em comum com links de perfil. */
const cardHtml = (person: Person): string => `
  <div class="card">
    <a href="https://www.linkedin.com/in/${person.slug}?miniProfileUrn=abc"><img alt=""></a>
    <div>
      <a href="https://www.linkedin.com/in/${person.slug}?miniProfileUrn=abc"><span aria-hidden="true">${person.name}</span></a>
      <span> • 2º</span>
      <div>${person.headline}</div>
      <div>Cidade Inventada, Brasil</div>
      <p>Atual: trabalho com Git na Empresa Fictícia</p>
      ${person.mutual === true ? '<a href="https://www.linkedin.com/in/pessoa-colega">Pessoa Colega</a> e mais 2 conexões em comum' : ''}
    </div>
    <button>Conectar</button>
  </div>`;

const asList = (people: readonly Person[]): string => `
  <header><a href="https://www.linkedin.com/in/eu-mesmo">Eu</a></header>
  <main>
    <ul>${people.map((person) => `<li>${cardHtml(person)}</li>`).join('')}
      <li><div class="card"><h3>Premium</h3><p>Você está procurando emprego?</p></div></li>
    </ul>
    <aside><a href="https://www.linkedin.com/in/anuncio-exemplo">Anúncio</a></aside>
  </main>`;

async function resultsPage(html: string): Promise<Page> {
  const tab = await h.context.newPage();
  await tab.goto(PAGE_URL);
  await tab.setContent(`<!doctype html><html><body>${html}</body></html>`);
  return tab;
}

describe('readResults numa página simulada', { timeout: 120_000 }, () => {
  test('em lista: uma entrada por pessoa, com o nome visível, sem barra, lateral, anúncio nem conexão em comum', async () => {
    const tab = await resultsPage(asList(PEOPLE));
    const before = await tab.content();
    const read = await tab.evaluate(readResults);
    assert.equal(await tab.content(), before, 'a página não muda');
    assert.equal(new URL(read.url).pathname, '/search/results/people/');
    const entries = parseResults(read.items);
    assert.deepEqual(entries.map((entry) => entry.key), ['/in/ana-exemplo/', '/in/bia-exemplo/', '/in/caio-exemplo/']);
    assert.deepEqual(entries.map((entry) => entry.name), ['Ana Exemplo', 'Bia Exemplo', 'Caio Exemplo']);
    assert.equal(entries[0]?.headline, 'Desenvolvedora | Java | Spring');
    assert.equal(entries[0]?.details, 'Atual: trabalho com Git na Empresa Fictícia');
    for (const entry of entries) assert.ok(!JSON.stringify(entry).includes('Colega'), 'nome de terceiro não entra');
    await tab.close();
  });

  test('sem lista: sobe só até o bloco da pessoa, e o bloco de conexão em comum não vira ninguém', async () => {
    const tab = await resultsPage(`<main><section>${PEOPLE.map((person) => `<div class="linha">${cardHtml(person)}</div>`).join('')}</section></main>`);
    const entries = parseResults((await tab.evaluate(readResults)).items);
    assert.ok(entries.some((entry) => entry.key === '/in/bia-exemplo/' && entry.headline.includes('Engenheira')));
    assert.ok(!entries.some((entry) => entry.key === '/in/pessoa-colega/' && entry.headline !== ''), 'quem só aparece como conexão em comum fica de fora');
    await tab.close();
  });

  test('lista grande dentro de outra lista: o item de fora não engole todo mundo', async () => {
    const more: Person[] = Array.from({ length: 6 }, (_, index) => ({ slug: `pessoa-${index}-ex`, name: `Pessoa Numero${String.fromCharCode(65 + index)}`, headline: 'Dev Java' }));
    const tab = await resultsPage(`<main><ul><li><ul>${more.map((person) => `<li>${cardHtml(person)}</li>`).join('')}</ul></li></ul></main>`);
    assert.equal(parseResults((await tab.evaluate(readResults)).items).length, 6);
    await tab.close();
  });

  test('página sem pessoas: nada', async () => {
    const tab = await resultsPage('<main><h1>Nenhum resultado encontrado</h1></main>');
    assert.deepEqual((await tab.evaluate(readResults)).items, []);
    await tab.close();
  });
});

const setPending = (value: { at: number; [key: string]: unknown }): Promise<void> => h.worker.evaluate((v) => chrome.storage.session.set({ pendingRead: v }), value);

const topNames = (page: Page): Promise<string[]> => page.locator('[data-kind="top_ten"] li.tr-person .tr-person__name').allTextContents();

describe('o painel recebe a página lida', { timeout: 120_000 }, () => {
  test('a lista enche sozinha, com pré-nota, resumo sem nomes e nada de texto guardado', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const tab = await resultsPage(asList(PEOPLE));
    const results = await tab.evaluate(readResults);
    await tab.close();
    const { page, errors } = await openPanel(h);
    await setPending({ ok: true, results, at: Date.now() });

    await page.getByText(/^Li 3 pessoas nesta página: 2 novas\./).waitFor();
    await page.getByText('1 pessoa não mostrou nada do que a vaga pede e não foi guardada.').waitFor();
    assert.deepEqual(await topNames(page), ['Ana Exemplo', 'Bia Exemplo']);
    await page.locator('[data-kind="top_ten"] .tr-score__band', { hasText: 'Pré-nota' }).first().waitFor();
    await page.getByText('Pré-nota usa só o que a lista de resultados mostra').waitFor();

    const local = JSON.stringify(await readStorage(h));
    for (const word of ['Cidade Inventada', 'Pessoa Colega', 'Coordenador de marketing', 'Caio Exemplo', 'Empresa Fictícia']) assert.ok(!local.includes(word), word);
    assert.ok(!('pendingRead' in (await readSession(h))), 'a leitura sai da sessão');

    // O detalhe explica a pré-nota e diz o que não foi visto.
    await page.locator('li.tr-person', { hasText: 'Ana Exemplo' }).getByRole('button', { name: 'Ver detalhe' }).click();
    const detail = page.locator('[data-kind="candidate_detail"]');
    await detail.getByText('Esta é uma pré-nota').waitFor();
    await detail.getByText('Não visto na lista').first().waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('a próxima página soma à lista, sem repetir quem já estava', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const { page } = await openPanel(h);
    const first = await resultsPage(asList(PEOPLE.slice(0, 2)));
    await setPending({ ok: true, results: await first.evaluate(readResults), at: Date.now() });
    await first.close();
    await page.getByText(/^Li 2 pessoas nesta página: 2 novas\./).waitFor();

    const second = await resultsPage(asList([PEOPLE[1] as Person, { slug: 'dora-exemplo', name: 'Dora Exemplo', headline: 'Dev Java | Spring' }]));
    await setPending({ ok: true, results: await second.evaluate(readResults), at: Date.now() + 1 });
    await second.close();
    await page.getByText(/^Li 2 pessoas nesta página: 1 nova, 1 atualizada\./).waitFor();
    assert.equal((await topNames(page)).length, 3);
    await page.close();
  });

  test('página sem pessoas: diz o que fazer e não guarda nada', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const { page } = await openPanel(h);
    await setPending({ ok: true, results: { url: PAGE_URL, items: [] }, at: Date.now() });
    await page.getByText('Não achamos pessoas nesta página.').waitFor();
    assert.equal(await page.locator('[data-kind="top_ten"]').count(), 0);
    await page.close();
  });

  test('a tela da busca liga a leitura ali mesmo, com o aviso, e então mostra o botão', async () => {
    await seedWorkspace(h, []);
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: /Montar a busca/ }).click();
    assert.equal(await page.getByRole('button', { name: 'Ler esta página' }).count(), 0);
    await page.getByRole('button', { name: 'Ligar a leitura por clique' }).click();
    await page.getByText('Antes de ligar, leia este aviso').waitFor();
    await page.getByRole('button', { name: 'Entendi o risco, ligar' }).click();
    await page.getByRole('button', { name: 'Ler esta página' }).waitFor();
    await page.getByText('o aviso dele fala em "ler e alterar" dados do LinkedIn').waitFor();
    await page.getByRole('heading', { name: 'Busca para o LinkedIn' }).waitFor();
    await page.close();
  });
});

/**
 * O botão do painel (D-10). O pedido de permissão do Chrome, a aba aberta e a leitura são trocados na página do painel: o teste
 * prova o caminho do botão até a lista e o PDF, não a janela de permissão do Chrome nem a leitura na aba de verdade.
 */
describe('o botão Ler esta página', { timeout: 120_000 }, () => {
  const stub = (page: Page, value: { granted: boolean; url: string; results: unknown }): Promise<void> =>
    page.evaluate((v) => {
      const api = chrome as unknown as { permissions: Record<string, unknown>; tabs: Record<string, unknown>; scripting: Record<string, unknown> };
      api.permissions['request'] = () => Promise.resolve(v.granted);
      api.tabs['query'] = () => Promise.resolve([{ id: 4242, url: v.url }]);
      api.scripting['executeScript'] = () => Promise.resolve([{ result: v.results }]);
    }, value);

  test('lê a página, enche a lista, oferece a próxima e o PDF já vem com todos os lidos', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const tab = await resultsPage(asList(PEOPLE));
    const results = await tab.evaluate(readResults);
    await tab.close();
    const { page, errors } = await openPanel(h);
    await stub(page, { granted: true, url: PAGE_URL, results });
    await page.getByRole('button', { name: /Montar a busca/ }).click();
    await page.getByRole('button', { name: 'Ler esta página' }).click();

    await page.getByText(/^Li 3 pessoas nesta página: 2 novas\..*clique em Ler esta página de novo\.$/).waitFor();
    assert.deepEqual(await topNames(page), ['Ana Exemplo', 'Bia Exemplo']);
    await page.locator('[data-kind="top_ten"]').getByRole('button', { name: 'Ler esta página' }).waitFor();
    await page.locator('[data-kind="top_ten"]').getByRole('button', { name: 'Gerar PDF' }).first().click();
    assert.equal(await page.getByLabel('Todos da lista (2)').isChecked(), true);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('sem a permissão, ou fora da busca e do perfil: diz o que fazer e não guarda nada', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const { page } = await openPanel(h);
    await stub(page, { granted: false, url: PAGE_URL, results: { url: PAGE_URL, items: [] } });
    await page.getByRole('button', { name: /Montar a busca/ }).click();
    await page.getByRole('button', { name: 'Ler esta página' }).click();
    await page.getByText('O Chrome não deu a permissão, então nada foi lido.').waitFor();

    await stub(page, { granted: true, url: 'https://www.linkedin.com/feed/', results: { url: PAGE_URL, items: [] } });
    await page.getByRole('button', { name: /Montar a busca/ }).click();
    await page.getByRole('button', { name: 'Ler esta página' }).click();
    await page.getByText('A aba aberta nesta janela não é uma busca de pessoas nem um perfil do LinkedIn.').waitFor();
    assert.equal(await page.locator('[data-kind="top_ten"]').count(), 0);
    await page.close();
  });
});

describe('o botão Próximo perfil', { timeout: 120_000 }, () => {
  /** Troca as partes do Chrome na página do painel: a lista lida, a aba dos perfis e o texto de cada perfil. */
  const stub = (page: Page, value: { results: unknown; profiles: Record<string, string>; landOn?: string }): Promise<void> =>
    page.evaluate((v) => {
      const api = chrome as unknown as { permissions: Record<string, unknown>; tabs: Record<string, unknown>; scripting: Record<string, unknown> };
      const state = { opened: [] as string[], url: '', listeners: [] as Array<(id: number, change: { status: string }) => void> };
      (window as unknown as { __next: typeof state }).__next = state;
      const load = (id: number, url: string) => {
        state.url = v.landOn ?? url;
        setTimeout(() => state.listeners.forEach((listener) => listener(id, { status: 'complete' })), 20);
        return Promise.resolve({ id, url });
      };
      api.permissions['request'] = () => Promise.resolve(true);
      api.tabs['query'] = () => Promise.resolve([{ id: 4242, url: 'https://www.linkedin.com/search/results/people/?keywords=teste' }]);
      api.tabs['onUpdated'] = { addListener: (f: (id: number, change: { status: string }) => void) => state.listeners.push(f), removeListener: (f: unknown) => (state.listeners = state.listeners.filter((g) => g !== f)) };
      api.tabs['create'] = (options: { url: string }) => (state.opened.push(`create ${options.url}`), load(4300, options.url));
      api.tabs['update'] = (id: number, options: { url: string }) => (state.opened.push(`update ${id} ${options.url}`), load(id, options.url));
      api.tabs['get'] = (id: number) => (id === 4300 && state.url !== '' ? Promise.resolve({ id, url: state.url }) : Promise.reject(new Error('sem aba')));
      api.scripting['executeScript'] = (details: { target: { tabId: number }; args: unknown[] }) => {
        if (details.target.tabId === 4242) return Promise.resolve([{ result: v.results }]);
        if (details.args.length === 2) return Promise.resolve([{ result: true }]);
        const text = v.profiles[state.url] ?? '';
        return Promise.resolve([{ result: { url: state.url, title: 'Perfil | LinkedIn', text } }]);
      };
    }, value);
  const opened = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __next: { opened: string[] } }).__next.opened);

  async function readList(page: Page): Promise<void> {
    await page.getByRole('button', { name: /Montar a busca/ }).click();
    await page.getByRole('button', { name: 'Ler esta página' }).click();
    await page.getByText(/^Li 3 pessoas nesta página: 2 novas./).waitFor();
  }

  test('cada clique abre e lê um perfil, na ordem da lista, e a pré-nota vira nota completa', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const tab = await resultsPage(asList(PEOPLE));
    const results = await tab.evaluate(readResults);
    await tab.close();
    const { page, errors } = await openPanel(h);
    await stub(page, {
      results,
      profiles: {
        'https://www.linkedin.com/in/ana-exemplo/': profile('Ana Exemplo', ['Java', 'Spring']),
        'https://www.linkedin.com/in/bia-exemplo/': profile('Bia Exemplo', ['Java']),
      },
    });
    await readList(page);

    await page.locator('[data-testid="next-profile-top"]').getByRole('button', { name: 'Abrir e ler o próximo perfil (faltam 2)' }).click();
    const result = page.locator('[data-testid="next-profile-result"]');
    await result.getByRole('button', { name: 'Abrir e ler o próximo perfil (falta 1)' }).waitFor();
    assert.deepEqual(await opened(page), ['create https://www.linkedin.com/in/ana-exemplo/']);

    await result.getByRole('button').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="next-profile"]').length === 0);
    assert.deepEqual(await opened(page), ['create https://www.linkedin.com/in/ana-exemplo/', 'update 4300 https://www.linkedin.com/in/bia-exemplo/']);
    assert.deepEqual(await topNames(page), ['Ana Exemplo', 'Bia Exemplo']);
    assert.equal(await page.locator('[data-kind="top_ten"]').getByText('Pré-nota').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('o LinkedIn mostrou o login no lugar do perfil: nada é lido, e a pessoa continua com pré-nota', async () => {
    await seedWorkspace(h, [], { clickRead: true });
    const tab = await resultsPage(asList(PEOPLE));
    const results = await tab.evaluate(readResults);
    await tab.close();
    const { page } = await openPanel(h);
    await stub(page, { results, profiles: {}, landOn: 'https://www.linkedin.com/authwall?trk=teste' });
    await readList(page);
    await page.getByRole('button', { name: 'Abrir e ler o próximo perfil (faltam 2)' }).click();
    await page.getByText('O LinkedIn não mostrou o perfil.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Abrir e ler o próximo perfil (faltam 2)' }).waitFor();
    assert.equal(await page.locator('[data-kind="analysis_result"]').count(), 0);
    await page.close();
  });

  test('a espera olha o texto da página até ele parar de mudar, sem rolar nem clicar', async () => {
    const tab = await h.context.newPage();
    await tab.goto('https://www.linkedin.com/in/pessoa-inventada/');
    await tab.setContent('<!doctype html><html><body><main><p id="t">Nome</p></main></body></html>');
    await tab.evaluate(() => {
      let n = 0;
      const timer = setInterval(() => {
        document.getElementById('t')?.append(' Experiência');
        if ((n += 1) === 4) clearInterval(timer);
      }, 200);
    });
    // A função vai para a página como texto, como faz o executeScript.
    const wait = (max: number, stable: number): Promise<boolean> => tab.evaluate(`(${waitForMain.toString()})(${max}, ${stable})`);
    assert.equal(await wait(10_000, 600), true);
    assert.equal(await tab.evaluate(() => window.scrollY), 0);
    await tab.setContent('<!doctype html><html><body><div>sem main</div></body></html>');
    assert.equal(await wait(800, 300), false);
    await tab.close();
  });
});
