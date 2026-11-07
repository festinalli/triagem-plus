import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversation } from '../../../src/core/conversation/build.ts';
import { correctPerson, findAllRecords, groupPeople } from '../../../src/core/conversation/privacy.ts';
import { createMemoryArea } from '../../../src/core/store/area.ts';
import { createStore } from '../../../src/core/store/store.ts';
import type { Job } from '../../../src/core/model.ts';
import { ACCEPTED, inputWith, job, NOW, person } from './helpers.ts';

function jobB(): Job {
  return { ...job(), id: 'vaga-2', title: 'Outra vaga' };
}

async function setup() {
  const store = createStore(createMemoryArea());
  await store.saveJob(job());
  await store.saveJob(jobB());
  await store.saveCandidate(person({ id: 'a1', name: 'Ana Fictícia Müller', profileUrl: 'https://www.linkedin.com/in/ana-m/' }));
  await store.saveCandidate({ ...person({ id: 'a2', name: 'Ana F. Müller', profileUrl: 'https://www.linkedin.com/in/ana-m/' }), jobId: 'vaga-2', profileKey: '/in/pessoa-a1/' });
  await store.saveCandidate(person({ id: 'b1', name: 'Bruno Exemplo' }));
  return store;
}

describe('achar pessoa', () => {
  test('acha sem acento, em todas as vagas, e traz os registros da mesma pessoa', async () => {
    const store = await setup();
    const found = await findAllRecords(store, 'ana ficticia muller');
    assert.deepEqual(found.map((item) => item.id).sort(), ['a1', 'a2']);
    assert.equal((await findAllRecords(store, 'xyz')).length, 0);
    assert.equal((await findAllRecords(store, '   ')).length, 0);
  });

  test('agrupa por pessoa e mostra o prazo de cada registro', async () => {
    const store = await setup();
    const found = await findAllRecords(store, 'ana');
    const groups = groupPeople(found, [job(), jobB()], 180);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.records.length, 2);
    assert.deepEqual(groups[0]?.records.map((r) => r.jobTitle).sort(), ['Outra vaga', 'Pessoa Desenvolvedora Java']);
    assert.ok((groups[0]?.records[0]?.expiresAt ?? 0) > 0);
  });
});

describe('corrigir pessoa', () => {
  test('muda nome e link em todas as vagas e refaz a chave', async () => {
    const store = await setup();
    const out = await correctPerson(store, 'a1', { name: '  Ana   Corrigida ', link: 'https://www.linkedin.com/in/ana-nova/' });
    assert.deepEqual(out, { ok: true });
    const all = (await store.listAllCandidates()).items.filter((c) => c.id.startsWith('a'));
    assert.deepEqual(all.map((c) => c.name), ['Ana Corrigida', 'Ana Corrigida']);
    assert.deepEqual(all.map((c) => c.profileKey), ['/in/ana-nova/', '/in/ana-nova/']);
  });

  test('recusa nome vazio, link sem https, link sem perfil em pessoa de duas vagas e link de outra pessoa', async () => {
    const store = await setup();
    assert.deepEqual(await correctPerson(store, 'a1', { name: ' ', link: 'https://x.test/a' }), { ok: false, reason: 'no_name' });
    assert.deepEqual(await correctPerson(store, 'a1', { name: 'Ana', link: 'http://x.test/a' }), { ok: false, reason: 'bad_url' });
    assert.deepEqual(await correctPerson(store, 'a1', { name: 'Ana', link: 'https://exemplo.test/ana' }), { ok: false, reason: 'lost_link' });
    assert.deepEqual(await correctPerson(store, 'a1', { name: 'Ana', link: 'https://www.linkedin.com/in/pessoa-b1/' }), { ok: false, reason: 'taken' });
    assert.deepEqual(await correctPerson(store, 'nada', { name: 'Ana', link: 'https://www.linkedin.com/in/q/' }), { ok: false, reason: 'not_found' });
    assert.equal((await store.getCandidate('a1'))?.name, 'Ana Fictícia Müller');
  });
});

describe('conversa de privacidade', () => {
  test('o passo privacy traz três mensagens, e o espaço perto do limite aparece', () => {
    const msgs = buildConversation(inputWith([], { step: { name: 'privacy' }, privacy: { bytes: 9 * 1024 * 1024, query: '', found: null, editing: null } }));
    assert.deepEqual(msgs.map((m) => m.kind), ['privacy_info', 'privacy_people', 'privacy_data']);
    const info = msgs[0];
    assert.ok(info?.kind === 'privacy_info' && info.storage === 'near_limit');
    assert.ok(msgs[2]?.kind === 'privacy_data' && msgs[2].exportAccepted === false);
  });

  test('o passo de apagar pessoa mostra a confirmação com a contagem de vagas', () => {
    const a = person({ id: 'a1' });
    const msgs = buildConversation(inputWith([], { step: { name: 'privacy_delete', candidateId: 'a1' }, privacy: { bytes: 1, query: 'a', found: [a], editing: null } }));
    assert.ok(msgs[0]?.kind === 'confirm_person' && msgs[0].recordCount === 1);
  });

  test('o detalhe traz os três modelos preenchidos e avisa do marcador sem dado', () => {
    const a = person({ id: 'a1', name: 'Ana Teste' });
    const msgs = buildConversation(inputWith([a], { settings: { ...ACCEPTED, responsibleContact: '' }, step: { name: 'detail', candidateId: 'a1' }, now: NOW }));
    const detail = msgs[0];
    assert.ok(detail?.kind === 'candidate_detail');
    assert.equal(detail.templates.length, 3);
    assert.match(detail.templates[0]?.text ?? '', /Ana Teste/);
    assert.deepEqual(detail.templates[0]?.missing, ['{contato}']);
  });
});
