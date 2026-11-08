// A página de resultados, do texto à lista (D-09, RF-38, RF-39). Pessoas e empresas inventadas. O formato das linhas segue o que a
// página real mostrou nos testes do dono, mas o texto daqui foi escrito do zero.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAndStore, analyzeListing, NAME_NOT_READ, recomputeMatches } from '../../../src/core/conversation/analyze-store.ts';
import type { AnalyzeDeps, StoredText, TextMemory } from '../../../src/core/conversation/analyze-store.ts';
import { applyFilters, NO_FILTERS } from '../../../src/core/conversation/filters.ts';
import { readNoticeOf } from '../../../src/core/conversation/triage.ts';
import { buildListingCard } from '../../../src/core/match/card.ts';
import { computeMatch, isListingOnly } from '../../../src/core/match/score.ts';
import type { Job, Requirement } from '../../../src/core/model.ts';
import { isProfileAddress, isResultsAddress } from '../../../src/core/page-read.ts';
import { buildReport, PREVIEW_NOTICE } from '../../../src/core/report/model.ts';
import { renderCsv } from '../../../src/core/report/csv.ts';
import { MAX_RESULTS, parseResults } from '../../../src/core/results/parse.ts';
import type { RawResult } from '../../../src/core/results/parse.ts';
import { createMemoryArea } from '../../../src/core/store/area.ts';
import { createStore } from '../../../src/core/store/store.ts';

const NOW = Date.UTC(2026, 10, 6, 12);

function raw(slug: string, name: string, lines: readonly string[]): RawResult {
  return { href: `https://www.linkedin.com/in/${slug}/?miniProfileUrn=abc`, name, text: [name, ...lines].join('\n') };
}

const card = (slug: string, name: string, headline: string, details: readonly string[] = [], city = 'Cidade Inventada, Brasil'): RawResult =>
  raw(slug, name, ['• 2º', headline, city, ...details, 'Pessoa Colega e mais 2 conexões em comum', 'Conectar']);

const term = (label: string, importance: Requirement['importance'] = 'required', extra: Partial<Requirement> = {}): Requirement => ({ id: `t:${label}`, kind: 'term', importance, label, canonical: label, ...extra });
const NET_JOB: readonly Requirement[] = [term('C#'), term('.NET'), term('ASP.NET'), term('Git'), { id: 'x', kind: 'total_experience', importance: 'required', label: '5 anos', minYears: 5 }, term('Docker', 'preferred')];

describe('endereço da página de resultados', () => {
  test('só a busca de pessoas', () => {
    assert.equal(isResultsAddress('https://www.linkedin.com/search/results/people/?keywords=C%23'), true);
    assert.equal(isResultsAddress('https://www.linkedin.com/search/results/people?keywords=x'), true);
    assert.equal(isResultsAddress('https://www.linkedin.com/search/results/all/?keywords=x'), false);
    assert.equal(isResultsAddress('https://www.linkedin.com/search/results/people-falso/'), false);
    assert.equal(isResultsAddress('https://exemplo.test/search/results/people/'), false);
    assert.equal(isResultsAddress('https://www.linkedin.com/in/pessoa/'), false);
    assert.equal(isResultsAddress(undefined), false);
    assert.equal(isProfileAddress('https://www.linkedin.com/search/results/people/?keywords=x'), false);
  });
});

describe('parseResults', () => {
  test('separa nome, link, título e trecho, sem local, conexões em comum e botões', () => {
    const [entry, ...others] = parseResults([card('ana-exemplo', 'Ana Exemplo', 'Desenvolvedora @ Empresa Fictícia | .NET | C#', ['Atual: Desenvolvedora de software na Empresa Fictícia - APIs com .NET'])]);
    assert.equal(others.length, 0);
    assert.deepEqual(entry, {
      name: 'Ana Exemplo',
      url: 'https://www.linkedin.com/in/ana-exemplo/',
      key: '/in/ana-exemplo/',
      headline: 'Desenvolvedora | .NET | C#',
      details: 'Atual: Desenvolvedora de software - APIs com .NET',
    });
  });

  test('nome e grau na mesma linha, e nome escondido para leitor de tela', () => {
    const entries = parseResults([
      { href: 'https://www.linkedin.com/in/bia-exemplo/', name: 'Bia Exemplo • 2º', text: 'Bia Exemplo • 2º\nDesenvolvedora .NET\nCidade Inventada' },
      { href: 'https://www.linkedin.com/in/caio-exemplo/', name: 'Ver perfil de Caio Exemplo', text: 'Ver perfil de Caio Exemplo\nCaio Exemplo\n· 3º e +\nDesenvolvedor Java\nCidade Inventada' },
    ]);
    assert.deepEqual(entries.map((entry) => [entry.name, entry.headline]), [['Bia Exemplo', 'Desenvolvedora .NET'], ['Caio Exemplo', 'Desenvolvedor Java']]);
  });

  test('sem local na lista, o trecho com rótulo não se perde', () => {
    const [entry] = parseResults([raw('dora-exemplo', 'Dora Exemplo', ['Desenvolvedora', 'Competências: C#, Git'])]);
    assert.equal(entry?.details, 'Competências: C#, Git');
  });

  test('a mesma pessoa uma vez, link fora do padrão fica de fora, bloco sem título não é pessoa', () => {
    const entries = parseResults([
      card('eva-exemplo', 'Eva Exemplo', 'Dev C#'),
      { ...card('eva-exemplo', 'Eva Exemplo', 'Dev C#'), href: 'https://www.linkedin.com/in/Eva-Exemplo' },
      { href: 'https://exemplo.test/pessoa', name: 'Fora', text: 'Fora\nDev C#' },
      raw('colega-exemplo', 'Pessoa Colega', ['Pessoa Colega e mais 2 conexões em comum']),
    ]);
    assert.deepEqual(entries.map((entry) => entry.key), ['/in/eva-exemplo/']);
  });

  test('título com seguidores, ou com palavras de outras linhas, continua sendo título', () => {
    const headlineOf = (line: string): string | undefined => parseResults([card('ana-exemplo', 'Ana Exemplo', line)])[0]?.headline;
    assert.equal(headlineOf('Dev C# | Criador de conteúdo | 12 mil seguidores'), 'Dev C# | Criador de conteúdo | 12 mil seguidores');
    assert.equal(headlineOf('Java Developer | 5k followers'), 'Java Developer | 5k followers');
    assert.equal(headlineOf('Status: dev C# para vagas remotas'), 'Status: dev C# para vagas remotas');
    assert.equal(headlineOf('Dev C# (mutual connection of CTO)'), 'Dev C# (mutual connection of CTO)');
  });

  test('linhas soltas de seguidores e de relação não viram título', () => {
    for (const line of ['• Seguindo', 'Following', 'Fora da sua rede', 'Out of network', '12 mil seguidores', '5K followers']) {
      const [entry] = parseResults([raw('ana-exemplo', 'Ana Exemplo', [line, 'Dev C#', 'Cidade Inventada'])]);
      assert.equal(entry?.headline, 'Dev C#', line);
      assert.equal(entry?.details, '', line);
    }
  });

  test('quem só tem o local fica de fora', () => {
    for (const place of ['São Paulo e Região', 'Porto Alegre, Rio Grande do Sul, Brasil', 'Greater São Paulo Area', 'Curitiba']) {
      assert.deepEqual(parseResults([raw('ana-exemplo', 'Ana Exemplo', ['• 2º', place])]), [], place);
    }
  });

  test('sobrenome Júnior é nome, e cargo continua não sendo', () => {
    const nameOf = (text: string): string | null | undefined => parseResults([card('ana-exemplo', text, 'Dev C#')])[0]?.name;
    assert.equal(nameOf('João Pedro Júnior'), 'João Pedro Júnior');
    assert.equal(nameOf('Carlos Souza Junior'), 'Carlos Souza Junior');
    assert.equal(nameOf('Desenvolvedor Júnior'), null);
  });

  test('nome que não parece nome fica nulo, e a página tem um teto', () => {
    assert.equal(parseResults([card('gil-exemplo', 'Desenvolvedor Sênior', 'Dev C#')])[0]?.name, null);
    const many = Array.from({ length: MAX_RESULTS + 5 }, (_, index) => card(`pessoa-${index}-ex`, `Pessoa Numero${String.fromCharCode(65 + (index % 26))}`, 'Dev C#'));
    assert.equal(parseResults(many).length, MAX_RESULTS);
  });
});

describe('pré-nota', () => {
  const previewOf = (headline: string, details = '', requirements: readonly Requirement[] = NET_JOB) => {
    const listing = buildListingCard({ headline, details }, requirements);
    return { listing, match: computeMatch(listing, requirements) };
  };

  test('títulos no formato que a página real mostra: cada tecnologia é achada', () => {
    const { listing } = previewOf('.NET | C# • ASP.NET • VB.NET • SQL Server • JavaScript');
    for (const key of ['.NET', 'C#', 'ASP.NET', 'SQL Server', 'JavaScript']) assert.ok(listing.terms.some((item) => item.key === key), key);
    assert.ok(previewOf('Full-Stack .NET Developer | C#, ASP.NET Core, React, TypeScript').listing.terms.some((item) => item.key === 'ASP.NET'));
    assert.ok(previewOf('Desenvolvedor .Net | C# | ASP.Net MVC | Angular').listing.terms.some((item) => item.key === 'ASP.NET'));
    assert.ok(previewOf('Dev', 'Atual: Engenheira na Empresa Fictícia - backend com .NET e C#').listing.terms.some((item) => item.key === 'C#'));
  });

  test('a conta: visto conta, não visto conta zero, tempo total fica fora', () => {
    const { listing, match } = previewOf('Desenvolvedor | C# | .NET');
    assert.equal(isListingOnly(listing), true);
    // Pesos: C#, .NET, ASP.NET e Git valem 3 e Docker vale 1. Visto: 6 de 13.
    assert.equal(match.score, 46);
    assert.equal(match.requiredMet, 2);
    assert.equal(match.requiredTotal, 4);
    const statuses = new Map(match.results.map((result) => [result.requirementId, result]));
    assert.equal(statuses.get('t:C#')?.status, 'met');
    assert.equal(statuses.get('t:Git')?.status, 'not_found');
    assert.equal(statuses.get('t:Git')?.note, 'not_in_listing');
    assert.equal(statuses.get('x')?.status, 'needs_reanalysis');
    assert.equal(statuses.get('x')?.note, 'not_in_listing');
    assert.equal(listing.totalMonths, null);
  });

  test('termo com anos mínimos que aparece na lista conta inteiro, e o tempo fica a conferir (DP-27)', () => {
    const withYears = NET_JOB.map((item) => (item.kind === 'term' ? { ...item, minYears: 5 } : item));
    const { match } = previewOf('Desenvolvedor | C# | .NET', '', withYears);
    // A lista nunca mostra tempo: cortar pela metade baixaria todo mundo do mesmo jeito. A mesma conta de sem anos.
    assert.equal(match.score, 46);
    assert.equal(match.requiredMet, 2);
    const csharp = match.results.find((result) => result.requirementId === 't:C#');
    assert.equal(csharp?.status, 'met');
    assert.equal(csharp?.credit, 1);
    assert.equal(csharp?.note, 'time_not_measurable');
  });

  test('nunca vira Forte, mesmo com tudo visto, e fica fora do filtro de faixa', async () => {
    const requirements = [term('C#')];
    const { match } = previewOf('Dev C#', '', requirements);
    assert.equal(match.score, 100);
    assert.equal(match.band, 'partial');
    const candidate = { card: buildListingCard({ headline: 'Dev C#', details: '' }, requirements), match } as never;
    const job = { requirements } as never;
    assert.equal(applyFilters([candidate], job, { ...NO_FILTERS, band: 'partial' }).length, 0);
    assert.equal(readNoticeOf(candidate).level, 'listing');
  });

  test('termo livre não é procurado no título nem no trecho (DP-25), e palavra de cargo só no título', () => {
    const free: Requirement = { id: 'livre', kind: 'term', importance: 'required', label: 'Campinas' };
    const title: Requirement = { id: 'cargo', kind: 'title_word', importance: 'required', label: 'Sênior' };
    const { match } = previewOf('Desenvolvedor Sênior em Campinas', 'Atual: ...', [free, title, term('C#')]);
    const byId = new Map(match.results.map((result) => [result.requirementId, result]));
    assert.equal(byId.get('livre')?.status, 'needs_reanalysis');
    assert.equal(byId.get('cargo')?.status, 'met');
    assert.equal(previewOf('Desenvolvedor', 'Atual: Sênior na Empresa', [title]).match.results[0]?.status, 'not_found');
  });

  test('prova dos gêmeos: nome, cidade, grau e conexões não mudam a ficha', () => {
    const items: RawResult[] = [
      card('gemeo-um', 'Ruby Swift', 'Desenvolvedora | C# | .NET', ['Atual: backend com Git'], 'Goiânia, GO'),
      card('gemeo-dois', 'Maria Oliveira', 'Desenvolvedora | C# | .NET', ['Atual: backend com Git'], 'Porto Alegre, Brasil'),
    ];
    const [one, two] = parseResults(items);
    assert.ok(one && two);
    const cardOne = buildListingCard(one, NET_JOB);
    assert.deepEqual(cardOne, buildListingCard(two, NET_JOB));
    assert.ok(!cardOne.terms.some((item) => item.key === 'Ruby' || item.key === 'Swift' || item.key === 'Go'));
  });

  test('nome de empresa depois de um cargo não vira tecnologia, e o resto da linha continua valendo', () => {
    const keysOf = (headline: string, details: readonly string[] = []): string[] => {
      const [entry] = parseResults([card('ana-exemplo', 'Ana Exemplo', headline, details)]);
      assert.ok(entry);
      return buildListingCard(entry, NET_JOB).terms.map((item) => item.key);
    };
    assert.deepEqual(keysOf('Analista de RH na Oracle'), []);
    assert.deepEqual(keysOf('Gerente Comercial na Java Café'), []);
    assert.deepEqual(keysOf('Gerente Comercial at Java Coffee'), []);
    assert.deepEqual(keysOf('Coordenador @ Flutter Cafe'), []);
    assert.deepEqual(keysOf('Pessoa', ['Atual: Gerente na Java Café']), []);
    assert.ok(keysOf('Desenvolvedor .NET na Empresa Fictícia | C#').includes('.NET'));
    assert.ok(keysOf('Desenvolvedor .NET na Empresa Fictícia | C#').includes('C#'));
    assert.ok(keysOf('Dev', ['Atual: Desenvolvedora na Java Café - APIs com C# e Git']).includes('C#'));
    assert.ok(!keysOf('Dev', ['Atual: Desenvolvedora na Java Café - APIs com C# e Git']).includes('Java'));
    assert.ok(keysOf('Experiência em Java').includes('Java'));
  });

  test('o que está na ficha são chaves da lista: nada do título em texto livre', () => {
    const text = JSON.stringify(previewOf('Mãe de dois, 38 anos | Desenvolvedora | C#').listing);
    for (const word of ['Mãe', 'dois', '38 anos']) assert.ok(!text.includes(word), word);
  });
});

function memoryPort(): TextMemory & { value: StoredText | null } {
  const port = {
    value: null as StoredText | null,
    read: async () => port.value,
    write: async (value: StoredText) => {
      port.value = value;
    },
    clear: async () => {
      port.value = null;
    },
  };
  return port;
}

async function setup(requirements: readonly Requirement[] = NET_JOB, accept = true) {
  const store = createStore(createMemoryArea());
  const job: Job = { id: 'vaga-1', title: 'Vaga', text: '', requirements, excludedTerms: [], archived: false, createdAt: 1, updatedAt: 1 };
  await store.saveJob(job);
  await store.updateSettings({ activeJobId: job.id, responsibleName: 'Ana', responsibleContact: 'ana@exemplo.test', ...(accept ? { acceptances: { terms: { version: 1, at: 1 } } } : {}) });
  const memory = memoryPort();
  let counter = 0;
  const deps: AnalyzeDeps = { store, memory, now: () => NOW, newId: () => `novo-${++counter}` };
  return { store, memory, deps, job };
}

const PAGE: readonly RawResult[] = [
  card('ana-exemplo', 'Ana Exemplo', 'Desenvolvedora | C# | .NET | ASP.NET Core'),
  card('bia-exemplo', 'Bia Exemplo', 'Desenvolvedora | Git'),
  card('caio-exemplo', 'Caio Exemplo', 'Coordenador de marketing'),
  card('gil-exemplo', 'Desenvolvedor Sênior', 'Dev C#'),
];

describe('analyzeListing', () => {
  test('guarda quem mostrou algo da vaga, e conta o resto', async () => {
    const { store, deps } = await setup();
    const outcome = await analyzeListing(deps, PAGE);
    assert.deepEqual(outcome, { ok: true, read: 4, created: 3, updated: 0, kept: 0, nothingSeen: 1, noName: 1, failed: 0 });
    const { items } = await store.listCandidates('vaga-1');
    // Sem nome legível, a pessoa não some: fica com o link, para conferir.
    assert.deepEqual(items.map((item) => item.name).sort(), ['Ana Exemplo', 'Bia Exemplo', NAME_NOT_READ]);
    const ana = items.find((item) => item.name === 'Ana Exemplo');
    assert.equal(ana?.source, 'results');
    assert.equal(ana?.profileUrl, 'https://www.linkedin.com/in/ana-exemplo/');
    assert.equal(ana?.card.currentTitle, 'Desenvolvedor(a)');
  });

  test('nada do texto da página fica guardado, e o texto da última análise sai da memória', async () => {
    const { store, deps, memory } = await setup();
    memory.value = { profileKey: null, candidateId: 'x', jobId: 'vaga-1', text: 'antigo' };
    await analyzeListing(deps, [card('ana-exemplo', 'Ana Exemplo', 'Desenvolvedora | C# | .NET', ['Atual: trecho que não fica'], 'Cidade Secreta')]);
    const saved = JSON.stringify(await store.exportAll(NOW));
    for (const word of ['trecho que não fica', 'Cidade Secreta', 'Pessoa Colega', 'Conectar']) assert.ok(!saved.includes(word), word);
    assert.equal(memory.value, null);
  });

  test('ler de novo não duplica e soma o que veio; o que a pessoa escreveu fica', async () => {
    const { store, deps } = await setup();
    await analyzeListing(deps, [card('ana-exemplo', 'Ana Exemplo', 'Dev | C#')]);
    const first = (await store.listCandidates('vaga-1')).items[0];
    assert.ok(first);
    await store.saveCandidate({ ...first, name: 'Ana Corrigida', notes: 'minha nota', stage: 'reviewing' });
    const outcome = await analyzeListing(deps, [card('ana-exemplo', 'Ana Exemplo', 'Dev | .NET')]);
    assert.equal(outcome.ok && outcome.updated, 1);
    const { items } = await store.listCandidates('vaga-1');
    assert.equal(items.length, 1);
    assert.deepEqual([items[0]?.name, items[0]?.notes, items[0]?.stage], ['Ana Corrigida', 'minha nota', 'reviewing']);
    assert.ok(items[0]?.card.terms.some((item) => item.key === 'C#') && items[0]?.card.terms.some((item) => item.key === '.NET'));
  });

  const FULL = ['Ana Exemplo', 'Experiência', 'Desenvolvedora', 'Empresa Fictícia · Tempo integral', 'jan de 2020 - o momento · 6 anos', 'C#, .NET, Git', 'Competências', 'ASP.NET'].join('\n');

  test('abrir o perfil troca a pré-nota pela nota completa, na mesma pessoa', async () => {
    const { store, deps } = await setup();
    await analyzeListing(deps, [card('ana-exemplo', 'Ana Exemplo', 'Dev | C#')]);
    const out = await analyzeAndStore(deps, { text: FULL, url: 'https://www.linkedin.com/in/ana-exemplo/', name: null, source: 'clicked' });
    assert.equal(out.ok && out.updated, true);
    const { items } = await store.listCandidates('vaga-1');
    assert.equal(items.length, 1);
    assert.equal(isListingOnly(items[0]?.card ?? { sectionsRead: [] }), false);
    assert.equal(items[0]?.source, 'clicked');
    assert.equal(items[0]?.card.totalMonths !== null, true);
    assert.notEqual(items[0]?.match.results.find((result) => result.requirementId === 'x')?.status, 'needs_reanalysis');
  });

  test('quem entrou sem nome ganha o nome ao abrir o perfil, e o nome corrigido não se perde', async () => {
    const { store, deps } = await setup();
    await analyzeListing(deps, [card('ana-exemplo', 'Desenvolvedor Sênior', 'Dev | C#')]);
    assert.equal((await store.listCandidates('vaga-1')).items[0]?.name, NAME_NOT_READ);
    await analyzeListing(deps, [card('ana-exemplo', 'Desenvolvedor Sênior', 'Dev | .NET')]);
    assert.equal((await store.listCandidates('vaga-1')).items.length, 1);
    await analyzeAndStore(deps, { text: FULL, url: 'https://www.linkedin.com/in/ana-exemplo/', name: null, source: 'clicked' });
    assert.equal((await store.listCandidates('vaga-1')).items[0]?.name, 'Ana Exemplo');
  });

  test('ler a lista depois não mexe em quem já tem nota completa', async () => {
    const { store, deps } = await setup();
    await analyzeAndStore(deps, { text: FULL, url: 'https://www.linkedin.com/in/ana-exemplo/', name: null, source: 'pasted' });
    const before = (await store.listCandidates('vaga-1')).items[0];
    const outcome = await analyzeListing(deps, [card('ana-exemplo', 'Ana Exemplo', 'Dev | Docker')]);
    assert.equal(outcome.ok && outcome.kept, 1);
    assert.deepEqual((await store.listCandidates('vaga-1')).items[0], before);
  });

  test('mudar a vaga refaz a pré-nota sem virar nota completa', async () => {
    const { store, deps, job } = await setup();
    await analyzeListing(deps, [card('ana-exemplo', 'Ana Exemplo', 'Dev | C# | Docker')]);
    const changed: Job = { ...job, requirements: [term('Docker')] };
    await store.saveJob(changed);
    assert.equal(await recomputeMatches(store, changed), 1);
    const candidate = (await store.listCandidates('vaga-1')).items[0];
    assert.equal(candidate?.match.score, 100);
    assert.equal(candidate?.match.band, 'partial');
  });

  test('vaga só com o que a lista nunca mostra: não diz que as pessoas não mostraram', async () => {
    const free: Requirement = { id: 'livre', kind: 'term', importance: 'required', label: 'Campinas' };
    const total: Requirement = { id: 'x', kind: 'total_experience', importance: 'required', label: '5 anos', minYears: 5 };
    const { deps, store } = await setup([free, total]);
    assert.deepEqual(await analyzeListing(deps, PAGE), { ok: false, reason: 'no_listing_requirement' });
    assert.equal((await store.listCandidates('vaga-1')).items.length, 0);
  });

  test('sem aceite, sem vaga, sem requisitos, ou página sem pessoas: nada é guardado', async () => {
    assert.deepEqual(await analyzeListing((await setup(NET_JOB, false)).deps, PAGE), { ok: false, reason: 'no_acceptance' });
    assert.deepEqual(await analyzeListing((await setup([])).deps, PAGE), { ok: false, reason: 'no_requirements' });
    const { deps, store } = await setup();
    assert.deepEqual(await analyzeListing(deps, []), { ok: false, reason: 'nothing_read' });
    await store.updateSettings({ activeJobId: null });
    assert.deepEqual(await analyzeListing(deps, PAGE), { ok: false, reason: 'no_job' });
  });
});

describe('relatório com pré-nota', () => {
  test('a pessoa sai com "Pré-nota", o não visto vai para "A rever", e a legenda explica', async () => {
    const { store, deps, job } = await setup();
    await analyzeListing(deps, [card('ana-exemplo', 'Ana Exemplo', 'Dev | C#')]);
    const { items } = await store.listCandidates('vaga-1');
    const model = buildReport({ job, candidates: items, scope: 'top10', includeNotes: false, now: NOW });
    const row = model.rows[0];
    assert.equal(row?.bandLabel, 'Pré-nota');
    assert.equal(row?.band, null);
    assert.deepEqual(row?.met, ['C#']);
    assert.deepEqual(row?.missing, []);
    assert.deepEqual(row?.review, ['.NET', 'ASP.NET', 'Git', '5 anos', 'Docker']);
    assert.equal(row?.reviewLabel, 'Não visto na lista');
    assert.equal(model.hasPreview, true);
    assert.equal(model.hasReview, false);
    assert.ok(renderCsv(model).includes(PREVIEW_NOTICE.split('.')[0] ?? ''));
    assert.equal(buildReport({ job, candidates: [], scope: 'top10', includeNotes: false, now: NOW }).hasPreview, false);
  });

  test('termo com anos: "tempo a conferir" no que bateu, e os anos na lista de requisitos', async () => {
    const { store, deps, job } = await setup();
    const withYears: Job = { ...job, requirements: job.requirements.map((item) => (item.id === 't:C#' ? { ...item, minYears: 3 } : item)) };
    await store.saveJob(withYears);
    await analyzeListing(deps, [card('ana-exemplo', 'Ana Exemplo', 'Dev | C# | .NET')]);
    const { items } = await store.listCandidates('vaga-1');
    const model = buildReport({ job: withYears, candidates: items, scope: 'top10', includeNotes: false, now: NOW });
    assert.deepEqual(model.rows[0]?.met, ['C# (tempo a conferir)', '.NET']);
    assert.deepEqual(model.requirements.map((item) => item.label).slice(0, 2), ['C# · 3 anos', '.NET']);
    // O tempo total já diz os anos no nome: não repete.
    assert.ok(model.requirements.some((item) => item.label === '5 anos'));
  });
});

describe('formato de cartão visto na página real', () => {
  const lines = (headline: string, details: string, mutual: string): readonly string[] => ['• 2º', headline, 'Cidade Inventada, Estado Inventado, Brasil', details, mutual, 'Conectar'];
  const requirements = [term('C#'), term('.NET'), term('ASP.NET'), term('SQL Server')];

  test('"@" na linha de título tira só a empresa, e o que vem depois da barra continua valendo', () => {
    const [entry] = parseResults([raw('ana-exemplo', 'Ana Exemplo', lines('Desenvolvedora @ Empresa Alfa | .NET | C# | ASP.NET Core', 'Atual: Desenvolvedora de software na Empresa Alfa - Backend em .NET para sistemas', 'Pessoa Um, Pessoa Dois e mais 2 conexões em comum'))]);
    assert.equal(entry?.headline, 'Desenvolvedora | .NET | C# | ASP.NET Core');
    assert.equal(entry?.details, 'Atual: Desenvolvedora de software - Backend em .NET para sistemas');
  });

  test('separador "•", ".Net" escrito de outro jeito e conexão em comum no singular', () => {
    const [bullets, otherCase] = parseResults([
      raw('davi-teste', 'Davi Teste', lines('.NET | C# • ASP.NET • VB.NET • SQL Server • JavaScript', 'Atual: Software Developer na Empresa Delta - Stack used: ASP.NET, C#, and SQL Server.', 'Pessoa Um é uma conexão em comum')),
      raw('bruno-teste', 'Bruno Teste', lines('Desenvolvedor .Net | C# | ASP.Net MVC | Angular', 'Atual: Desenvolvedor .Net na Empresa Beta', 'Pessoa Um, Pessoa Dois e mais 22 conexões em comum')),
    ]);
    assert.ok(bullets !== undefined && otherCase !== undefined);
    assert.equal(bullets.details.includes('conexão'), false);
    assert.equal(computeMatch(buildListingCard(bullets, requirements), requirements).score, 100);
    assert.equal(computeMatch(buildListingCard(otherCase, requirements), requirements).score, 75);
  });
});
