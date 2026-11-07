// Analisar e guardar sozinho (RF-34, RF-36, RF-45, RF-55, RF-64, RF-67, CA-09, CA-10). Perfis e nomes inventados.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeAndStore, cleanName, reconcileMemory, recomputeMatches, removeCandidate } from '../../../src/core/conversation/analyze-store.ts';
import type { AnalyzeDeps, StoredText, TextMemory } from '../../../src/core/conversation/analyze-store.ts';
import { createMemoryArea } from '../../../src/core/store/area.ts';
import { createStore } from '../../../src/core/store/store.ts';
import type { Store } from '../../../src/core/store/store.ts';
import type { Job } from '../../../src/core/model.ts';
import { NOW, req } from './helpers.ts';

const fixture = (name: string): string => readFileSync(new URL(`../../fixtures/profiles/${name}.txt`, import.meta.url), 'utf8');

const CLARA = 'https://www.linkedin.com/in/clara-ficticia/';
const BENTO = 'https://www.linkedin.com/in/bento-imaginario/';
const OLIVIA = 'https://www.linkedin.com/in/olivia-ficticia/';

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

async function setup(requirements = [req('term', 'Java'), req('term', 'Spring'), req('term', 'Kubernetes', 'preferred')]) {
  const area = createMemoryArea();
  const store = createStore(area);
  const job: Job = { id: 'vaga-1', title: 'Vaga de teste', text: '', requirements, excludedTerms: [], archived: false, createdAt: 1, updatedAt: 1 };
  await store.saveJob(job);
  await store.updateSettings({ activeJobId: job.id, responsibleName: 'Ana', responsibleContact: 'ana@exemplo.test', acceptances: { terms: { version: 1, at: 1 } } });
  const memory = memoryPort();
  let counter = 0;
  const deps: AnalyzeDeps = { store, memory, now: () => NOW, newId: () => `id-${(counter += 1)}` };
  return { area, store, memory, deps, job };
}

const paste = (deps: AnalyzeDeps, text: string, url: string, name: string | null = null) => analyzeAndStore(deps, { text, url, name, source: 'pasted' });

describe('analyzeAndStore: a pessoa entra na lista sozinha (RF-36, RF-67)', () => {
  test('guarda a ficha na vaga ativa, com nome do leitor, origem e datas', async () => {
    const { deps, store } = await setup();
    const out = await paste(deps, fixture('pt-um-cargo'), CLARA);
    assert.ok(out.ok);
    assert.deepEqual([out.updated, out.addedNothing, out.notProfileLink], [false, false, false]);
    const { items } = await store.listCandidates('vaga-1');
    assert.equal(items.length, 1);
    const clara = items[0]!;
    assert.equal(clara.name, 'Clara Fictícia Exemplo');
    assert.equal(clara.profileKey, '/in/clara-ficticia/');
    assert.equal(clara.source, 'pasted');
    assert.equal(clara.stage, 'new');
    assert.equal(clara.informedAt, null);
    assert.deepEqual([clara.addedAt, clara.updatedAt], [NOW, NOW]);
    assert.ok(clara.match.score > 0);
  });

  test('o nome que a pessoa escreveu vale mais do que o do leitor, e a origem "clicked" é guardada', async () => {
    const { deps, store } = await setup();
    const out = await analyzeAndStore(deps, { text: fixture('pt-um-cargo'), url: CLARA, name: '  Clara   Souza  ', source: 'clicked' });
    assert.ok(out.ok);
    const c = (await store.listCandidates('vaga-1')).items[0]!;
    assert.equal(c.name, 'Clara Souza');
    assert.equal(c.source, 'clicked');
  });

  test('usa o mês atual como referência: "o momento" conta até o mês do relógio', async () => {
    const { deps, store } = await setup([req('term', 'Java')]);
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    const c = (await store.listCandidates('vaga-1')).items[0]!;
    // jan/2020 até nov/2026 passa de 6 anos; com a referência de 2024 daria menos.
    assert.ok((c.card.totalMonths ?? 0) > 6 * 12 + 6);
  });

  test('link fora do padrão do LinkedIn segue, com aviso, e a pessoa não é reconhecida de novo', async () => {
    const { deps, store } = await setup();
    const first = await paste(deps, fixture('pt-um-cargo'), 'https://exemplo.test/clara');
    assert.ok(first.ok && first.notProfileLink);
    const second = await paste(deps, fixture('pt-um-cargo'), 'https://exemplo.test/clara');
    assert.ok(second.ok && !second.updated);
    assert.equal((await store.listCandidates('vaga-1')).items.length, 2);
  });
});

describe('analyzeAndStore: recusas, sem guardar nada', () => {
  test('sem aceite, sem vaga ativa, vaga arquivada e vaga sem requisitos', async () => {
    const semAceite = await setup();
    await semAceite.store.updateSettings({ acceptances: {} });
    assert.deepEqual(await paste(semAceite.deps, fixture('pt-um-cargo'), CLARA), { ok: false, reason: 'no_acceptance' });

    const semVaga = await setup();
    await semVaga.store.updateSettings({ activeJobId: null });
    assert.deepEqual(await paste(semVaga.deps, fixture('pt-um-cargo'), CLARA), { ok: false, reason: 'no_job' });

    const arquivada = await setup();
    await arquivada.store.saveJob({ ...arquivada.job, archived: true });
    assert.deepEqual(await paste(arquivada.deps, fixture('pt-um-cargo'), CLARA), { ok: false, reason: 'no_job' });

    const semRequisitos = await setup([]);
    assert.deepEqual(await paste(semRequisitos.deps, fixture('pt-um-cargo'), CLARA), { ok: false, reason: 'no_requirements' });

    for (const s of [semAceite, semVaga, arquivada, semRequisitos]) {
      assert.equal((await s.store.listAllCandidates()).items.length, 0);
      assert.equal(s.memory.value, null);
    }
  });

  test('texto vazio, texto sem nenhuma seção, link sem https e perfil sem nome', async () => {
    const { deps, store, memory } = await setup();
    assert.deepEqual(await paste(deps, '   ', CLARA), { ok: false, reason: 'empty_text' });
    assert.deepEqual(await paste(deps, 'bom dia, tudo bem?\nsó uma conversa qualquer', CLARA, 'Alguém'), { ok: false, reason: 'nothing_read' });
    assert.deepEqual(await paste(deps, fixture('pt-um-cargo'), 'http://www.linkedin.com/in/clara-ficticia/'), { ok: false, reason: 'bad_url' });
    assert.deepEqual(await paste(deps, fixture('pt-um-cargo'), 'linkedin.com/in/clara'), { ok: false, reason: 'bad_url' });
    const semNome = 'Sobre\nTrabalho com Java.\n\nCompetências\nJava\nSpring';
    assert.deepEqual(await paste(deps, semNome, CLARA), { ok: false, reason: 'no_name' });
    assert.equal((await store.listAllCandidates()).items.length, 0);
    assert.equal(memory.value, null, 'recusa não guarda texto');
  });

  test('falha do armazenamento vira recusa simples', async () => {
    const { deps, store } = await setup();
    const quebrado: AnalyzeDeps = { ...deps, store: { ...store, upsertByProfile: async () => Promise.reject(new Error('disco cheio')) } as Store };
    assert.deepEqual(await paste(quebrado, fixture('pt-um-cargo'), CLARA), { ok: false, reason: 'save_failed' });
  });
});

describe('analyzeAndStore: mesma pessoa na mesma vaga (RF-34, RF-64)', () => {
  test('analisar de novo atualiza a ficha, sem duplicar, e guarda etapa, favorito e notas', async () => {
    const { deps, store } = await setup();
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    const first = (await store.listCandidates('vaga-1')).items[0]!;
    await store.saveCandidate({ ...first, stage: 'interview', favorite: true, notes: 'ligar na terça' });
    const later: AnalyzeDeps = { ...deps, now: () => NOW + 86_400_000 };
    const out = await paste(later, fixture('pt-um-cargo'), `${CLARA}?utm=abc`);
    assert.ok(out.ok && out.updated && out.addedNothing);
    const { items } = await store.listCandidates('vaga-1');
    assert.equal(items.length, 1);
    const c = items[0]!;
    assert.deepEqual([c.id, c.stage, c.favorite, c.notes, c.addedAt, c.updatedAt], [first.id, 'interview', true, 'ligar na terça', NOW, NOW + 86_400_000]);
  });

  test('somar texto: o texto novo se junta ao anterior e a ficha fica com o maior tempo de cada termo', async () => {
    const { deps, store, memory } = await setup([req('term', 'Kotlin'), req('term', 'Kubernetes')]);
    const completo = fixture('pt-varios-cargos');
    const [cabecalhoEExperiencia, competencias] = completo.split('\nCompetências\n');
    assert.ok(cabecalhoEExperiencia && competencias);
    const primeira = await paste(deps, cabecalhoEExperiencia, BENTO);
    assert.ok(primeira.ok);
    const antes = (await store.listCandidates('vaga-1')).items[0]!;
    assert.ok(!antes.card.sectionsRead.includes('skills'));
    const segunda = await paste(deps, `Competências\n${competencias}`, BENTO);
    assert.ok(segunda.ok && segunda.updated && !segunda.addedNothing);
    const depois = (await store.listCandidates('vaga-1')).items[0]!;
    assert.ok(depois.card.sectionsRead.includes('skills') && depois.card.sectionsRead.includes('experience'));
    assert.equal(depois.name, antes.name);
    assert.ok(memory.value?.text.includes('Experiência') && memory.value.text.includes('Competências'), 'o texto somado fica na memória');
  });

  test('sem o texto na memória, a ficha se soma à ficha (reabrir o navegador)', async () => {
    const { deps, store, memory } = await setup([req('term', 'Kotlin')]);
    const completo = fixture('pt-varios-cargos');
    const [parte1, parte2] = completo.split('\nCompetências\n');
    await paste(deps, parte1!, BENTO);
    memory.value = null;
    const out = await paste(deps, `Competências\n${parte2!}`, BENTO);
    assert.ok(out.ok && out.updated);
    const c = (await store.listCandidates('vaga-1')).items[0]!;
    assert.ok(c.card.sectionsRead.includes('skills') && c.card.sectionsRead.includes('experience'));
  });
});

describe('texto em memória (RF-34, RF-45, CA-09, CA-10)', () => {
  test('só o texto da última análise fica, com a chave do perfil; analisar outro perfil o substitui', async () => {
    const { deps, memory } = await setup();
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    assert.equal(memory.value?.profileKey, '/in/clara-ficticia/');
    assert.ok(memory.value?.text.includes('Clara Fictícia Exemplo'));
    await paste(deps, fixture('pt-varios-cargos'), BENTO);
    assert.equal(memory.value?.profileKey, '/in/bento-imaginario/');
    assert.ok(memory.value?.text.includes('Bento Imaginário Silva'));
    assert.ok(!memory.value?.text.includes('Clara Fictícia'), 'o texto anterior não existe em lugar nenhum');
  });

  test('nada do texto do perfil vai para o armazenamento permanente', async () => {
    const { deps, area } = await setup();
    const sentinelas = ['ZEBRAXPTO', 'QUIMERAXPTO', 'GIRASSOLXPTO'];
    const texto = `Mariana Inventada Prado\nEngenheira de Software\n\nSobre\nGosto de ${sentinelas[0]} e de Java.\n\nExperiência\nEngenheira de Software\nEmpresa ${sentinelas[1]} · Tempo integral\njan de 2020 - o momento · 4 anos\nSão Paulo, Brasil\nTrabalho com ${sentinelas[2]} e Java.\nCompetências: Java, Spring\n\nCompetências\nJava\nSpring\n`;
    const out = await paste(deps, texto, 'https://www.linkedin.com/in/mariana-inventada/');
    assert.ok(out.ok);
    const guardado = JSON.stringify(await area.getAll());
    for (const palavra of sentinelas) assert.ok(!guardado.includes(palavra), `${palavra} não pode ser guardada`);
    assert.ok(!guardado.includes('Engenheira de Software\\nEmpresa'), 'nenhum trecho do texto');
    assert.ok(!guardado.includes('Empresa'), 'a empresa nunca entra na ficha');
  });

  test('Tirar da lista apaga a ficha e o texto em memória (CA-09)', async () => {
    const { deps, store, memory } = await setup();
    const out = await paste(deps, fixture('pt-um-cargo'), CLARA);
    assert.ok(out.ok);
    assert.equal(await removeCandidate(deps, out.candidateId), true);
    assert.equal(await store.getCandidate(out.candidateId), null);
    assert.equal(memory.value, null);
    assert.equal((await store.listAllCandidates()).items.length, 0);
  });

  test('tirar outra pessoa da lista não apaga o texto da última análise', async () => {
    const { deps, store, memory } = await setup();
    const clara = await paste(deps, fixture('pt-um-cargo'), CLARA);
    await paste(deps, fixture('pt-varios-cargos'), BENTO);
    assert.ok(clara.ok);
    await removeCandidate(deps, clara.candidateId);
    assert.equal(memory.value?.profileKey, '/in/bento-imaginario/');
    assert.equal((await store.listAllCandidates()).items.length, 1);
  });

  test('memória da sessão que falha não perde a ficha', async () => {
    const { deps, store } = await setup();
    const quebrada: AnalyzeDeps = { ...deps, memory: { read: async () => Promise.reject(new Error('x')), write: async () => Promise.reject(new Error('x')), clear: async () => Promise.reject(new Error('x')) } };
    const out = await paste(quebrada, fixture('pt-um-cargo'), CLARA);
    assert.ok(out.ok);
    assert.equal((await store.listAllCandidates()).items.length, 1);
  });
});

describe('requisitos mudaram (RF-55)', () => {
  test('refaz a nota de todos pela ficha, sem renovar o prazo', async () => {
    const { deps, store, job } = await setup([req('term', 'Java')]);
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    await paste(deps, fixture('pt-varios-cargos'), BENTO);
    const antes = (await store.listCandidates('vaga-1')).items;
    const scoreAntes = new Map(antes.map((c) => [c.name, c.match.score]));
    const novos = { ...job, requirements: [req('term', 'Java'), req('term', 'Kotlin')] };
    await store.saveJob(novos);
    const changed = await recomputeMatches(store, novos);
    assert.ok(changed >= 1);
    const depois = (await store.listCandidates('vaga-1')).items;
    for (const c of depois) {
      assert.equal(c.match.results.length, 2, 'um resultado por requisito novo');
      assert.equal(c.updatedAt, NOW, 'o prazo não é renovado');
    }
    const bento = depois.find((c) => c.name.startsWith('Bento'))!;
    assert.equal(bento.match.results[1]?.status, 'met', 'Kotlin está na ficha do Bento');
    assert.notEqual(bento.match.score, scoreAntes.get(bento.name), 'a nota mudou');
  });

  test('termo livre novo que nunca foi procurado fica "precisa analisar de novo" e não pesa contra', async () => {
    const { deps, store, job } = await setup([req('term', 'Java')]);
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    const novos = { ...job, requirements: [req('term', 'Java'), req('term', 'Zorgblat')] };
    await store.saveJob(novos);
    await recomputeMatches(store, novos);
    const c = (await store.listCandidates('vaga-1')).items[0]!;
    assert.equal(c.match.results.find((r) => r.status === 'needs_reanalysis')?.requirementId, novos.requirements[1]!.id);
    assert.equal(c.match.requiredTotal, 1, 'o pendente fica fora da conta');
  });

  test('nada muda quando os requisitos são os mesmos', async () => {
    const { deps, store, job } = await setup();
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    assert.equal(await recomputeMatches(store, job), 0);
  });
});

describe('cleanName', () => {
  test('tira controles, junta espaços e limita o tamanho', () => {
    assert.equal(cleanName('  Ana\u0000   ​Souza\n'), 'Ana Souza');
    assert.equal(cleanName(null), '');
    assert.equal(cleanName('x'.repeat(500)).length, 120);
  });
});

describe('requisito fora da lista resolve ao analisar de novo (RF-55, RF-57)', () => {
  test('Zephyrix Quartz entra depois: colar de novo procura e a nota o considera, igual para os gêmeos', async () => {
    const { deps, store, job } = await setup([req('term', 'Java')]);
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    const novos = { ...job, requirements: [req('term', 'Java'), req('term', 'Zephyrix Quartz')] };
    await store.saveJob(novos);
    await recomputeMatches(store, novos);
    const before = (await store.listCandidates('vaga-1')).items[0]!;
    assert.ok(before.match.results.some((r) => r.status === 'needs_reanalysis'));

    await paste(deps, fixture('pt-um-cargo'), CLARA);
    const again = (await store.listCandidates('vaga-1')).items[0]!;
    assert.ok(!again.match.results.some((r) => r.status === 'needs_reanalysis'), 'não segue pedindo nova análise');
    assert.equal(again.match.results.find((r) => r.requirementId === novos.requirements[1]!.id)?.status, 'not_found');
    assert.ok(again.match.score < before.match.score, 'a nota agora considera o termo');

    await paste(deps, fixture('pt-um-cargo'), OLIVIA);
    const twin = (await store.listCandidates('vaga-1')).items.find((c) => c.profileKey === '/in/olivia-ficticia/')!;
    assert.equal(twin.match.score, again.match.score, 'o mesmo conteúdo tem a mesma nota');
  });
});

describe('nome corrigido não se desfaz (RF-91)', () => {
  test('analisar de novo mantém o nome guardado, mesmo com outro nome na tela', async () => {
    const { deps, store } = await setup();
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    const first = (await store.listAllCandidates()).items[0]!;
    await store.saveCandidate({ ...first, name: 'Clara Corrigida' });
    await paste(deps, fixture('pt-um-cargo'), CLARA, 'Clara Fictícia Exemplo');
    assert.equal((await store.listAllCandidates()).items[0]!.name, 'Clara Corrigida');
  });

  test('a mesma pessoa em outra vaga nasce com o nome já corrigido', async () => {
    const { deps, store, job } = await setup();
    await paste(deps, fixture('pt-um-cargo'), CLARA);
    const first = (await store.listAllCandidates()).items[0]!;
    await store.saveCandidate({ ...first, name: 'Clara Corrigida' });
    await store.saveJob({ ...job, id: 'vaga-2', title: 'Outra' });
    await store.updateSettings({ activeJobId: 'vaga-2' });
    await paste(deps, fixture('pt-um-cargo'), CLARA, 'Clara Fictícia Exemplo');
    const names = (await store.listAllCandidates()).items.map((c) => c.name);
    assert.deepEqual(names, ['Clara Corrigida', 'Clara Corrigida']);
  });
});

describe('somar mais texto e link limpo (RF-34, RF-64)', () => {
  test('link fora do LinkedIn: o texto novo se soma ao mesmo registro, pelo id', async () => {
    const { deps, store } = await setup();
    const url = 'https://github.com/pessoa-inventada';
    const first = await paste(deps, fixture('pt-um-cargo'), url);
    assert.ok(first.ok);
    const more = await analyzeAndStore(deps, { text: 'Competências\nDocker', url, name: null, source: 'pasted', candidateId: first.candidateId });
    assert.ok(more.ok && more.updated && more.candidateId === first.candidateId);
    assert.equal((await store.listAllCandidates()).items.length, 1);
  });

  test('guarda o link canônico do perfil, sem o que vem depois do nome', async () => {
    const { deps, store } = await setup();
    await paste(deps, fixture('pt-um-cargo'), `${CLARA}details/skills/?lipi=urn%3Ali%3Apage`);
    assert.equal((await store.listAllCandidates()).items[0]!.profileUrl, CLARA);
    await paste(deps, fixture('pt-varios-cargos'), 'https://exemplo.test/bento?x=1');
    assert.equal((await store.listAllCandidates()).items[1]!.profileUrl, 'https://exemplo.test/bento?x=1', 'fora do LinkedIn fica como veio');
  });
});

describe('o texto da sessão acompanha o candidato (RF-36, RF-45, RF-69)', () => {
  test('sai quando o candidato deixou de existir, por qualquer caminho', async () => {
    const { deps, store, memory } = await setup();
    const out = await paste(deps, fixture('pt-um-cargo'), CLARA);
    assert.ok(out.ok && memory.value !== null);
    assert.equal(await reconcileMemory(store, memory), false, 'candidato existe: o texto fica');
    assert.ok(memory.value !== null);
    await store.deleteJob('vaga-1');
    assert.equal(await reconcileMemory(store, memory), true);
    assert.equal(memory.value, null);
  });
});
