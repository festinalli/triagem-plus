import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryArea } from '../../../src/core/store/area.ts';
import { createStore } from '../../../src/core/store/store.ts';
import { DAY_MS, expiresAt, purgeExpired, renew, retentionState, storageState } from '../../../src/core/store/retention.ts';
import { RETENTION_DEFAULT_DAYS, SCHEMA_VERSION } from '../../../src/core/model.ts';
import type { Candidate, Job } from '../../../src/core/model.ts';

const T0 = Date.UTC(2026, 0, 1);

function job(id: string, over: Partial<Job> = {}): Job {
  return { id, title: `Vaga ${id}`, text: 'texto da vaga', requirements: [], excludedTerms: [], archived: false, createdAt: T0, updatedAt: T0, ...over };
}

function cand(id: string, jobId: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id,
    jobId,
    name: 'Joana Conceição',
    profileUrl: 'https://www.linkedin.com/in/joana-c/',
    profileKey: '/in/joana-c/',
    card: { totalMonths: 60, currentTitle: 'Dev', terms: [{ key: 'react', sections: ['skills'], months: 24, jobTitles: ['Dev'] }], searchedFreeTerms: [], sectionsRead: ['skills'], truncated: false },
    match: { score: 80, band: 'strong', results: [], requiredMet: 1, requiredTotal: 1 },
    stage: 'new',
    favorite: false,
    notes: '',
    informedAt: null,
    source: 'pasted',
    addedAt: T0,
    updatedAt: T0,
    ...over,
  };
}

function setup() {
  const area = createMemoryArea();
  return { area, store: createStore(area) };
}

describe('ajustes', () => {
  test('padrão e validação do prazo', async () => {
    const { store } = setup();
    const s = await store.getSettings();
    assert.equal(s.retentionDays, RETENTION_DEFAULT_DAYS);
    assert.equal(s.clickReadEnabled, false);
    assert.equal(s.activeJobId, null);
    assert.deepEqual(s.acceptances, {});
    assert.deepEqual(s.messageTemplates, []);
    await assert.rejects(store.updateSettings({ retentionDays: 29 }), RangeError);
    await assert.rejects(store.updateSettings({ retentionDays: 366 }), RangeError);
    await assert.rejects(store.updateSettings({ retentionDays: 90.5 }), RangeError);
    assert.equal((await store.updateSettings({ retentionDays: 30 })).retentionDays, 30);
    assert.equal((await store.updateSettings({ retentionDays: 365 })).retentionDays, 365);
    assert.equal((await store.getSettings()).retentionDays, 365);
  });

  test('grava meta com a versão', async () => {
    const { store, area } = setup();
    await store.saveJob(job('a'));
    assert.deepEqual((await area.get(['meta']))['meta'], { version: SCHEMA_VERSION });
  });
});

describe('prazo de guarda (CA-15)', () => {
  const c = cand('c1', 'j1');
  const at = (day: number) => T0 + day * DAY_MS;

  test('dia 172 ok, 173 a 180 em aviso, 181 vencido', () => {
    assert.equal(expiresAt(c, 180), at(180));
    assert.equal(retentionState(c, 180, at(172)), 'ok');
    assert.equal(retentionState(c, 180, at(173)), 'expiring');
    assert.equal(retentionState(c, 180, at(179)), 'expiring');
    // Regra: o dia 180 exato ainda não venceu; é o último dia, em aviso.
    assert.equal(retentionState(c, 180, at(180)), 'expiring');
    assert.equal(retentionState(c, 180, at(180) + 1), 'expired');
    assert.equal(retentionState(c, 180, at(181)), 'expired');
  });

  test('purgeExpired apaga no dia 181, preserva no 180 e devolve só a contagem', async () => {
    const { store } = setup();
    await store.saveJob(job('j1'));
    await store.saveCandidate(cand('c1', 'j1'));
    await store.saveCandidate(cand('c2', 'j1', { profileKey: null, updatedAt: T0 + 100 * DAY_MS }));
    assert.equal(await purgeExpired(store, at(180)), 0);
    assert.equal(await purgeExpired(store, at(181)), 1);
    const left = (await store.listCandidates('j1')).items.map((x) => x.id);
    assert.deepEqual(left, ['c2']);
  });

  test('renovar devolve o prazo', async () => {
    const { store } = setup();
    await store.saveCandidate(cand('c1', 'j1'));
    assert.equal(await renew(store, 'c1', at(175)), true);
    assert.equal(await renew(store, 'inexistente', at(175)), false);
    assert.equal(await purgeExpired(store, at(181)), 0);
    const got = await store.getCandidate('c1');
    assert.equal(got?.updatedAt, at(175));
    assert.equal(retentionState(got!, 180, at(181)), 'ok');
  });

  test('prazo mudado vale para os já guardados', async () => {
    const { store } = setup();
    await store.saveCandidate(cand('c1', 'j1'));
    await store.updateSettings({ retentionDays: 30 });
    assert.equal(await purgeExpired(store, at(31)), 1);
    await store.saveCandidate(cand('c2', 'j1'));
    await store.updateSettings({ retentionDays: 365 });
    assert.equal(await purgeExpired(store, at(300)), 0);
    assert.notEqual(await store.getCandidate('c2'), null);
  });
});

describe('limite de armazenamento', () => {
  test('aviso a partir de 80% de 10 MB', () => {
    const limit = 10 * 1024 * 1024;
    assert.equal(storageState(0), 'ok');
    assert.equal(storageState(limit * 0.8 - 1), 'ok');
    assert.equal(storageState(limit * 0.8), 'near_limit');
    assert.equal(storageState(limit), 'near_limit');
  });
});

describe('apagar (CA-16)', () => {
  test('wipeAll deixa o armazenamento vazio', async () => {
    const { store, area } = setup();
    await store.updateSettings({ responsibleName: 'Ana' });
    await store.saveJob(job('j1'));
    await store.saveCandidate(cand('c1', 'j1'));
    await store.wipeAll();
    assert.deepEqual(await area.getAll(), {});
  });

  test('deletePerson tira a pessoa de todas as vagas e poupa as outras', async () => {
    const { store } = setup();
    await store.saveCandidate(cand('c1', 'j1'));
    await store.saveCandidate(cand('c2', 'j2'));
    await store.saveCandidate(cand('c3', 'j2', { profileKey: '/in/outra/', name: 'Outra' }));
    assert.equal(await store.deletePerson(cand('x', 'j1')), 2);
    assert.deepEqual((await store.listAllCandidates()).items.map((c) => c.id), ['c3']);
  });

  test('deletePerson com chave nula apaga só aquele registro', async () => {
    const { store } = setup();
    await store.saveCandidate(cand('c1', 'j1', { profileKey: null }));
    await store.saveCandidate(cand('c2', 'j2', { profileKey: null }));
    assert.equal(await store.deletePerson(cand('c1', 'j1', { profileKey: null })), 1);
    assert.deepEqual((await store.listAllCandidates()).items.map((c) => c.id), ['c2']);
  });

  test('deleteJob leva os candidatos e limpa a vaga ativa', async () => {
    const { store } = setup();
    await store.saveJob(job('j1'));
    await store.saveJob(job('j2'));
    await store.updateSettings({ activeJobId: 'j1' });
    await store.saveCandidate(cand('c1', 'j1'));
    await store.saveCandidate(cand('c2', 'j2'));
    await store.deleteJob('j1');
    assert.equal(await store.getJob('j1'), null);
    assert.notEqual(await store.getJob('j2'), null);
    assert.deepEqual((await store.listAllCandidates()).items.map((c) => c.id), ['c2']);
    assert.equal((await store.getSettings()).activeJobId, null);
  });

  test('deleteJob de outra vaga mantém a ativa', async () => {
    const { store } = setup();
    await store.saveJob(job('j1'));
    await store.updateSettings({ activeJobId: 'j1' });
    await store.deleteJob('j2');
    assert.equal((await store.getSettings()).activeJobId, 'j1');
  });
});

describe('recusa de campos (CA-10)', () => {
  test('campos extras não ficam guardados', async () => {
    const { store, area } = setup();
    const sujo = {
      ...cand('c1', 'j1'),
      rawText: 'TEXTO-BRUTO-DO-PERFIL',
      about: 'SOBRE-MIM',
      headline: 'TITULO-LINKEDIN',
      location: 'LOCAL-X',
      photo: 'data:image/png;base64,FOTO',
      card: { ...cand('c1', 'j1').card, rawText: 'RT2', about: 'AB2' },
      match: { ...cand('c1', 'j1').match, headline: 'H2' },
    };
    await store.saveCandidate(sujo as unknown as Candidate);
    const dump = JSON.stringify(await area.getAll());
    for (const marca of ['TEXTO-BRUTO', 'SOBRE-MIM', 'TITULO-LINKEDIN', 'LOCAL-X', 'FOTO', 'RT2', 'AB2', 'H2', 'rawText', 'headline', 'photo', 'location', '"about"']) {
      assert.equal(dump.includes(marca), false, marca);
    }
    const got = await store.getCandidate('c1');
    assert.deepEqual(got, cand('c1', 'j1'));
  });

  test('upsert também descarta campos extras', async () => {
    const { store, area } = setup();
    await store.upsertByProfile({ ...cand('c1', 'j1'), rawText: 'SEGREDO' } as unknown as Candidate);
    assert.equal(JSON.stringify(await area.getAll()).includes('SEGREDO'), false);
  });
});

describe('upsert (RF-64)', () => {
  test('cria e depois atualiza preservando o que a pessoa escreveu', async () => {
    const { store } = setup();
    const first = await store.upsertByProfile(cand('c1', 'j1'));
    assert.equal(first.outcome, 'created');
    await store.saveCandidate({ ...first.candidate, stage: 'interview', favorite: true, notes: 'ligar terça', informedAt: T0 + 5 });
    const again = cand('novo-id', 'j1', {
      stage: 'new',
      notes: '',
      addedAt: T0 + 999,
      updatedAt: T0 + 10 * DAY_MS,
      match: { score: 95, band: 'strong', results: [], requiredMet: 2, requiredTotal: 2 },
    });
    const res = await store.upsertByProfile(again);
    assert.equal(res.outcome, 'updated');
    const items = (await store.listCandidates('j1')).items;
    assert.equal(items.length, 1);
    const got = items[0]!;
    assert.equal(got.id, 'c1');
    assert.equal(got.stage, 'interview');
    assert.equal(got.favorite, true);
    assert.equal(got.notes, 'ligar terça');
    assert.equal(got.informedAt, T0 + 5);
    assert.equal(got.addedAt, T0);
    assert.equal(got.match.score, 95);
    assert.equal(got.updatedAt, T0 + 10 * DAY_MS);
  });

  test('mesma pessoa em outra vaga cria; chave nula sempre cria', async () => {
    const { store } = setup();
    assert.equal((await store.upsertByProfile(cand('a', 'j1'))).outcome, 'created');
    assert.equal((await store.upsertByProfile(cand('b', 'j2'))).outcome, 'created');
    assert.equal((await store.upsertByProfile(cand('c', 'j1', { profileKey: null }))).outcome, 'created');
    assert.equal((await store.upsertByProfile(cand('d', 'j1', { profileKey: null }))).outcome, 'created');
    assert.equal((await store.listAllCandidates()).items.length, 4);
  });
});

describe('busca e exportação de pessoa', () => {
  test('findPeople ignora acento e maiúsculas, por nome ou link', async () => {
    const { store } = setup();
    await store.saveCandidate(cand('c1', 'j1'));
    await store.saveCandidate(cand('c2', 'j2', { name: 'Bruno Lima', profileKey: '/in/bruno-lima/', profileUrl: 'https://www.linkedin.com/in/bruno-lima/' }));
    assert.deepEqual((await store.findPeople('JOANA CONCEICAO')).map((c) => c.id), ['c1']);
    assert.deepEqual((await store.findPeople('conceição')).map((c) => c.id), ['c1']);
    assert.deepEqual((await store.findPeople('in/bruno-lima')).map((c) => c.id), ['c2']);
    assert.deepEqual(await store.findPeople('   '), []);
  });

  test('exportPerson e exportAll trazem versão e data e passam por JSON', async () => {
    const { store } = setup();
    await store.saveJob(job('j1'));
    await store.saveJob(job('j2'));
    await store.saveCandidate(cand('c1', 'j1'));
    await store.saveCandidate(cand('c2', 'j2'));
    await store.saveCandidate(cand('c3', 'j2', { profileKey: '/in/outra/' }));
    const one = await store.exportPerson(cand('c1', 'j1'), T0 + 7);
    assert.equal(one.schemaVersion, SCHEMA_VERSION);
    assert.equal(one.exportedAt, T0 + 7);
    assert.deepEqual(one.candidates.map((c) => c.id).sort(), ['c1', 'c2']);
    assert.deepEqual(one.jobs.map((j) => j.id).sort(), ['j1', 'j2']);
    for (const exported of one.jobs) assert.deepEqual(Object.keys(exported).sort(), ['id', 'title'], 'só o título da vaga, sem texto nem termos excluídos');
    const all = await store.exportAll(T0 + 8);
    assert.equal(all.candidates.length, 3);
    assert.equal(all.settings.retentionDays, RETENTION_DEFAULT_DAYS);
    assert.deepEqual(JSON.parse(JSON.stringify(all)), all);
  });
});

describe('robustez', () => {
  test('registro corrompido não derruba a lista e é contado', async () => {
    const { store, area } = setup();
    await store.saveCandidate(cand('c1', 'j1'));
    await area.set({
      'cand:ruim1': 'lixo',
      'cand:ruim2': { id: 'ruim2', jobId: 'j1' },
      'cand:c9': { ...cand('outro', 'j1') },
      'job:ruim': 42,
      settings: 'quebrado',
    });
    const res = await store.listCandidates('j1');
    assert.deepEqual(res.items.map((c) => c.id), ['c1']);
    assert.equal(res.skipped, 3);
    assert.equal((await store.listJobs()).skipped, 1);
    assert.equal((await store.getSettings()).retentionDays, RETENTION_DEFAULT_DAYS);
    // nada foi apagado
    assert.equal(Object.keys(await area.getAll()).includes('cand:ruim1'), true);
  });

  test('formato mais novo: lê, não rebaixa a versão e não apaga', async () => {
    const { store, area } = setup();
    await area.set({ meta: { version: SCHEMA_VERSION + 5 }, 'cand:futuro': { id: 'futuro', formatoNovo: true } });
    assert.deepEqual(await store.readMeta(), { version: SCHEMA_VERSION + 5, newer: true });
    const res = await store.listCandidates('j1');
    assert.equal(res.items.length, 0);
    assert.equal(res.skipped, 1);
    await store.saveJob(job('j1'));
    assert.equal(((await area.get(['meta']))['meta'] as { version: number }).version, SCHEMA_VERSION + 5);
    assert.equal(Object.keys(await area.getAll()).includes('cand:futuro'), true);
  });

  test('duas escritas seguidas sem esperar não se perdem', async () => {
    const { store } = setup();
    await Promise.all([
      store.saveCandidate(cand('c1', 'j1', { profileKey: null })),
      store.saveCandidate(cand('c2', 'j1', { profileKey: null })),
      store.updateSettings({ responsibleName: 'A' }),
      store.updateSettings({ responsibleContact: 'B' }),
      store.upsertByProfile(cand('c3', 'j1')),
      store.upsertByProfile(cand('c4', 'j1')),
    ]);
    assert.equal((await store.listCandidates('j1')).items.length, 3);
    const s = await store.getSettings();
    assert.equal(s.responsibleName, 'A');
    assert.equal(s.responsibleContact, 'B');
  });

  test('uma operação que falha não trava as seguintes', async () => {
    const { store } = setup();
    await assert.rejects(store.saveCandidate({ id: 'x' } as unknown as Candidate), TypeError);
    await store.saveCandidate(cand('c1', 'j1'));
    assert.equal((await store.listAllCandidates()).items.length, 1);
  });
});
