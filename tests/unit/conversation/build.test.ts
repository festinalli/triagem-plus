import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversation, DEFAULT_RULES, HOME, NOTICE_IDS, TERMS_VERSION } from '../../../src/core/conversation/build.ts';
import type { ConversationInput, ConversationMessage, ConversationRule, Step } from '../../../src/core/conversation/build.ts';
import { makeRequirement } from '../../../src/core/job/requirements.ts';
import type { Importance, Job, RequirementKind, Settings } from '../../../src/core/model.ts';
import { buildSearch } from '../../../src/core/search/build.ts';
import { defaultSettings } from '../../../src/core/store/store.ts';

const accepted = (version = TERMS_VERSION): Settings => ({ ...defaultSettings(), responsibleName: 'Ana', responsibleContact: 'ana@exemplo.test', acceptances: { terms: { version, at: 1 } } });

function req(kind: RequirementKind, label: string, importance: Importance = 'required', minYears?: number) {
  const made = makeRequirement({ kind, label, importance, ...(minYears === undefined ? {} : { minYears }) });
  assert.ok(made.ok, `requisito de teste inválido: ${label}`);
  return made.requirement;
}

function job(id: string, over: Partial<Job> = {}): Job {
  return { id, title: `Vaga ${id}`, text: '', requirements: [], excludedTerms: [], archived: false, createdAt: 1, updatedAt: 1, ...over };
}

function input(over: Partial<ConversationInput> = {}): ConversationInput {
  return { settings: accepted(), jobs: [], activeJob: null, ...over };
}

const kinds = (messages: readonly ConversationMessage[]): string[] => messages.map((m) => m.kind);
const actionIds = (message: ConversationMessage | undefined): string[] => (message?.actions ?? []).map((a) => a.id);

describe('buildConversation: primeira abertura (CA-01)', () => {
  test('sem aceite só saem os avisos e o formulário de aceite', () => {
    const messages = buildConversation(input({ settings: defaultSettings() }));
    assert.deepEqual(kinds(messages), ['notices', 'accept_form']);
    const notices = messages[0];
    assert.equal(notices?.kind, 'notices');
    if (notices?.kind === 'notices') assert.deepEqual(notices.blocks, NOTICE_IDS);
  });

  test('os cinco avisos de RF-01 estão na lista, na ordem', () => {
    assert.deepEqual([...NOTICE_IDS], ['responsibility', 'account_risk', 'no_relation', 'score_support', 'not_legal']);
  });

  test('sem aceite nenhum passo de trabalho abre, mesmo com vaga, vaga ativa e passo pedido', () => {
    const active = job('a', { requirements: [req('term', 'Java')] });
    const steps: Step[] = [HOME, { name: 'job_list' }, { name: 'job_form', jobId: null }, { name: 'requirements' }, { name: 'search' }, { name: 'settings' }, { name: 'help_affirmative' }, { name: 'confirm_delete_job', jobId: 'a' }];
    for (const step of steps) {
      const messages = buildConversation(input({ settings: defaultSettings(), jobs: [active], activeJob: active, step }));
      assert.deepEqual(kinds(messages), ['notices', 'accept_form'], `passo ${step.name}`);
    }
  });

  test('aceite de versão antiga dos avisos volta a pedir o aceite', () => {
    assert.deepEqual(kinds(buildConversation(input({ settings: accepted(TERMS_VERSION - 1) }))), ['notices', 'accept_form']);
  });

  test('o formulário traz o que já está guardado e os limites do prazo', () => {
    const settings = { ...defaultSettings(), responsibleName: 'Rui', retentionDays: 90 };
    const form = buildConversation(input({ settings })).find((m) => m.kind === 'accept_form');
    assert.ok(form && form.kind === 'accept_form');
    assert.equal(form.responsibleName, 'Rui');
    assert.equal(form.retentionDays, 90);
    assert.deepEqual(form.retention, { defaultDays: 180, minDays: 30, maxDays: 365 });
  });
});

describe('buildConversation: início depois do aceite', () => {
  test('sem vagas, convida a criar a primeira', () => {
    const [message, ...rest] = buildConversation(input());
    assert.equal(rest.length, 0);
    assert.equal(message?.kind, 'no_job');
    assert.deepEqual(message?.actions, [{ id: 'create_job', primary: true }]);
  });

  test('só vagas arquivadas: convida a criar e oferece ver as vagas', () => {
    const [message] = buildConversation(input({ jobs: [job('x', { archived: true })] }));
    assert.equal(message?.kind, 'no_job');
    if (message?.kind === 'no_job') assert.equal(message.archivedCount, 1);
    assert.deepEqual(actionIds(message), ['create_job', 'show_jobs']);
  });

  test('com vagas e sem vaga ativa, mostra a lista para escolher', () => {
    const jobs = [job('a'), job('b', { archived: true })];
    const [message] = buildConversation(input({ jobs }));
    assert.equal(message?.kind, 'job_list');
    if (message?.kind === 'job_list') {
      assert.deepEqual(message.jobs.map((j) => [j.id, j.active, j.archived]), [['a', false, false], ['b', false, true]]);
    }
  });

  test('vaga ativa arquivada conta como sem vaga ativa', () => {
    const archived = job('a', { archived: true });
    assert.equal(buildConversation(input({ jobs: [archived], activeJob: archived }))[0]?.kind, 'no_job');
  });

  test('vaga ativa sem requisitos: o próximo passo principal é cadastrar requisitos', () => {
    const active = job('a');
    const [message] = buildConversation(input({ jobs: [active], activeJob: active }));
    assert.equal(message?.kind, 'job_summary');
    assert.deepEqual(message?.actions.filter((a) => a.primary).map((a) => a.id), ['open_requirements']);
  });

  test('vaga ativa com requisitos: conta os tipos e o principal passa a ser colar um perfil', () => {
    const active = job('a', { requirements: [req('term', 'Java'), req('term', 'Docker', 'preferred'), req('language', 'Inglês')], excludedTerms: ['estágio'] });
    const [message] = buildConversation(input({ jobs: [active], activeJob: active }));
    assert.ok(message && message.kind === 'job_summary');
    assert.deepEqual([message.requiredCount, message.preferredCount, message.excludedCount], [2, 1, 1]);
    assert.deepEqual(message.actions.filter((a) => a.primary).map((a) => a.id), ['open_paste']);
    assert.ok(message.actions.some((a) => a.id === 'delete_job' && a.danger === true && a.jobId === 'a'));
  });
});

describe('buildConversation: passos', () => {
  const active = job('a', { requirements: [req('term', 'Java'), req('term', 'Kafka'), req('term', 'Docker', 'preferred')], excludedTerms: ['Estágio'] });
  const base = input({ jobs: [active], activeJob: active });
  const at = (step: Step) => buildConversation({ ...base, step });

  test('formulário de vaga: novo e edição', () => {
    const created = at({ name: 'job_form', jobId: null })[0];
    assert.ok(created && created.kind === 'job_form');
    assert.equal(created.job, null);
    const edited = at({ name: 'job_form', jobId: 'a' })[0];
    assert.ok(edited && edited.kind === 'job_form');
    assert.equal(edited.job?.id, 'a');
  });

  test('requisitos: leva a vaga ativa e o botão principal é a busca quando há obrigatório', () => {
    const [message] = at({ name: 'requirements' });
    assert.ok(message && message.kind === 'requirements');
    assert.equal(message.job.id, 'a');
    assert.deepEqual(message.actions.filter((a) => a.primary).map((a) => a.id), ['open_search']);
    const none = buildConversation({ ...base, jobs: [job('b')], activeJob: job('b'), step: { name: 'requirements' } })[0];
    assert.deepEqual(none?.actions.filter((a) => a.primary), []);
  });

  test('busca: traz as duas versões, os operadores e o que ficou de fora', () => {
    const [message] = at({ name: 'search' });
    assert.ok(message && message.kind === 'search');
    assert.deepEqual(message.built, buildSearch({ requirements: active.requirements, excludedTerms: active.excludedTerms }));
    assert.ok(message.built.full.text.startsWith('"Java" AND '));
    assert.ok(message.built.full.text.endsWith(' NOT "Estágio"'));
    assert.equal(message.built.short.text.includes('NOT'), false);
    assert.equal(message.searchableCount, 2);
  });

  test('busca com termo excluído proibido: o termo sai da busca e vem em refusedExcluded', () => {
    const risky = job('a', { requirements: [req('term', 'Java')], excludedTerms: ['mais de 40 anos'] });
    const [message] = buildConversation({ settings: accepted(), jobs: [risky], activeJob: risky, step: { name: 'search' } });
    assert.ok(message && message.kind === 'search');
    assert.equal(message.built.full.text.includes('40'), false);
    assert.equal(message.built.refusedExcluded.length, 1);
  });

  test('busca sem obrigatório de busca: texto vazio e botão principal leva aos requisitos', () => {
    const empty = job('a', { requirements: [req('total_experience', '5 anos', 'required', 5)] });
    const [message] = buildConversation({ settings: accepted(), jobs: [empty], activeJob: empty, step: { name: 'search' } });
    assert.ok(message && message.kind === 'search');
    assert.equal(message.built.full.text, '');
    assert.equal(message.searchableCount, 0);
    assert.deepEqual(message.actions.filter((a) => a.primary).map((a) => a.id), ['open_requirements']);
  });

  test('ajustes mostram o responsável e o prazo atuais', () => {
    const [message] = buildConversation({ ...base, settings: { ...accepted(), retentionDays: 60 }, step: { name: 'settings' } });
    assert.ok(message && message.kind === 'settings_form');
    assert.equal(message.retentionDays, 60);
    assert.equal(message.responsibleName, 'Ana');
  });

  test('apagar pede confirmação e a ação perigosa é a de confirmar; arquivar não é perigoso', () => {
    const del = at({ name: 'confirm_delete_job', jobId: 'a' })[0];
    assert.ok(del && del.kind === 'confirm');
    assert.equal(del.what, 'delete_job');
    assert.deepEqual(del.actions, [{ id: 'confirm_delete_job', jobId: 'a', danger: true, primary: false }, { id: 'cancel' }]);
    const arch = at({ name: 'confirm_archive_job', jobId: 'a' })[0];
    assert.ok(arch && arch.kind === 'confirm');
    assert.equal(arch.actions[0]?.danger, false);
  });

  test('ajuda de vaga afirmativa', () => {
    assert.equal(at({ name: 'help_affirmative' })[0]?.kind, 'help_affirmative');
  });

  test('passo que precisa de vaga ativa, sem ela, volta ao início', () => {
    const noActive = input({ jobs: [job('a')] });
    assert.equal(buildConversation({ ...noActive, step: { name: 'requirements' } })[0]?.kind, 'job_list');
    assert.equal(buildConversation({ ...noActive, step: { name: 'search' } })[0]?.kind, 'job_list');
    assert.equal(buildConversation({ ...noActive, step: { name: 'confirm_delete_job', jobId: 'fantasma' } })[0]?.kind, 'job_list');
  });

  test('cada mensagem tem id único dentro da conversa', () => {
    const steps: Step[] = [HOME, { name: 'requirements' }, { name: 'search' }, { name: 'settings' }];
    for (const step of steps) {
      const ids = at(step).map((m) => m.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  });
});

describe('buildConversation: pureza e extensão', () => {
  test('não muda a entrada e dá o mesmo resultado nas duas chamadas (nada é guardado, RF-69)', () => {
    const active = job('a', { requirements: [req('term', 'Java')] });
    const frozen = Object.freeze({ settings: Object.freeze(accepted()), jobs: Object.freeze([active]), activeJob: active, step: Object.freeze({ name: 'search' } as const) });
    const before = JSON.stringify(frozen);
    const first = buildConversation(frozen);
    const second = buildConversation(frozen);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(frozen), before);
  });

  test('o texto da tela não vem do núcleo: as mensagens só têm dados e ids', () => {
    const active = job('a', { title: '<img src=x onerror=alert(1)>', requirements: [req('term', 'Java')] });
    const [message] = buildConversation(input({ jobs: [active], activeJob: active }));
    assert.ok(message && message.kind === 'job_summary');
    assert.equal(message.title, '<img src=x onerror=alert(1)>');
  });

  test('uma regra nova acrescenta um tipo de mensagem sem mexer nas outras', () => {
    const extra: ConversationRule = (_input, step) => (step.name === 'home' ? [{ id: 'extra', kind: 'help_affirmative', actions: [] }] : []);
    const active = job('a');
    const messages = buildConversation(input({ jobs: [active], activeJob: active }), [...DEFAULT_RULES, extra]);
    assert.deepEqual(kinds(messages), ['job_summary', 'help_affirmative']);
    // As regras de série não mudam sem a nova.
    assert.deepEqual(kinds(buildConversation(input({ jobs: [active], activeJob: active }))), ['job_summary']);
  });
});
