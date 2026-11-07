// O controlador do painel sem navegador (RF-10, RF-11, RF-37, RF-60, RF-64, RF-90, RF-91, RF-93). Tudo inventado.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversation } from '../../../src/core/conversation/build.ts';
import { NO_FILTERS } from '../../../src/core/conversation/filters.ts';
import { DAY, NOW, jobOf, kit, profile, req, url } from './kit.ts';
import type { Kit } from './kit.ts';

const paste = (k: Kit, name: string, skills: string[], slug: string) => k.controller.submitPaste({ text: profile(name, skills), url: url(slug), name });
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

async function twoJobs(): Promise<Kit> {
  return kit({ jobs: [jobOf('a', 'Vaga A', [req('term', 'Java')]), jobOf('b', 'Vaga B', [req('term', 'Python')])], activeJobId: 'a' });
}

describe('editar uma vaga que não é a ativa (RF-10, RF-11)', () => {
  test('a sugestão vale para a vaga editada, e a ativa não muda', async () => {
    const k = await twoJobs();
    await paste(k, 'Ana Inventada', ['Java'], 'ana');
    const before = k.controller.snapshot().candidates[0]!.match.score;
    await k.controller.saveJob('b', { title: 'Vaga B', text: 'Requisitos:\nRust\nKotlin\nErlang' });
    const suggestion = k.controller.ui.suggestion;
    assert.ok(suggestion !== null && suggestion.jobId === 'b');
    const values: Record<string, string> = {};
    suggestion.items.forEach((item, index) => {
      values[`use-${index}`] = 'on';
      values[`label-${index}`] = item.requirement.label;
    });
    await k.controller.applySuggestion(values);
    const jobs = new Map(k.controller.snapshot().jobs.map((job) => [job.id, job.requirements.map((r) => r.label)]));
    assert.deepEqual(jobs.get('a'), ['Java'], 'a vaga ativa não ganha nada');
    assert.ok(jobs.get('b')!.includes('Rust') && jobs.get('b')!.includes('Kotlin') && jobs.get('b')!.includes('Erlang'));
    assert.equal(k.controller.snapshot().candidates[0]!.match.score, before, 'a nota de quem está na vaga ativa não muda');
  });

  test('a tela de requisitos mostra a vaga editada, só com o botão de voltar', async () => {
    const k = await twoJobs();
    await k.controller.saveJob('b', { title: 'Vaga B', text: 'Requisitos:\nRust' });
    const [message] = k.controller.messages();
    assert.ok(message && message.kind === 'requirements' && message.job.id === 'b');
    assert.deepEqual(message.actions.map((action) => action.id), ['go_home']);
  });
});

describe('filtros ficam na vaga em que foram postos (RF-60)', () => {
  test('trocar de vaga limpa os filtros', async () => {
    const k = await twoJobs();
    k.controller.setFilters({ term: 'Java', band: 'any', stage: 'any' });
    assert.equal(k.controller.ui.filters.term, 'Java');
    k.controller.run({ id: 'activate_job', jobId: 'b' });
    await settle();
    assert.equal(k.controller.snapshot().activeJob?.id, 'b');
    assert.deepEqual(k.controller.ui.filters, NO_FILTERS);
  });
});

describe('texto da sessão acompanha o candidato (RF-36, RF-45)', () => {
  test('apagar a vaga, apagar a pessoa e apagar tudo esvaziam a memória', async () => {
    const k = await twoJobs();
    await paste(k, 'Ana Inventada', ['Java'], 'ana');
    assert.ok(k.memory.value !== null);
    k.controller.run({ id: 'confirm_delete_job', jobId: 'a' });
    await settle();
    assert.equal(k.memory.value, null, 'vaga apagada');

    const k2 = await twoJobs();
    await paste(k2, 'Bia Inventada', ['Java'], 'bia');
    await k2.store.deleteCandidate(k2.controller.snapshot().candidates[0]!.id);
    await k2.load();
    assert.equal(k2.memory.value, null, 'pessoa apagada por outro caminho');

    const k3 = await twoJobs();
    await paste(k3, 'Caio Inventado', ['Java'], 'caio');
    await k3.store.wipeAll();
    await k3.load();
    assert.equal(k3.memory.value, null, 'tudo apagado, inclusive em outra janela');
  });
});

describe('outra janela apagou (RF-93, RF-37)', () => {
  test('salvar o detalhe de quem já foi apagado avisa e volta, sem ressuscitar', async () => {
    const k = await twoJobs();
    await paste(k, 'Ana Inventada', ['Java'], 'ana');
    const id = k.controller.snapshot().candidates[0]!.id;
    k.controller.go({ name: 'detail', candidateId: id });
    await k.store.wipeAll();
    await k.controller.saveCandidateDetails(id, { stage: 'new', notes: 'nota depois', favorite: 'on' });
    assert.equal((await k.store.listAllCandidates()).items.length, 0, 'nada voltou');
    assert.equal(k.controller.ui.step.name, 'home');
    assert.ok(k.controller.ui.banner !== null);
  });

  test('refresh relê o armazenamento e tira do passo atual o que não existe mais', async () => {
    const k = await twoJobs();
    await paste(k, 'Ana Inventada', ['Java'], 'ana');
    const id = k.controller.snapshot().candidates[0]!.id;
    k.controller.go({ name: 'detail', candidateId: id });
    await k.store.deleteCandidate(id);
    await k.controller.refresh();
    assert.equal(k.controller.ui.step.name, 'home');
    assert.equal(k.controller.snapshot().candidates.length, 0);
  });

  test('a vaga ativa mostrada é a guardada depois de outra janela trocar', async () => {
    const k = await twoJobs();
    await k.store.updateSettings({ activeJobId: 'b' });
    await k.controller.refresh();
    assert.equal(k.controller.snapshot().activeJob?.id, 'b');
  });

  test('se a vaga ativa mudou entre abrir o formulário e analisar, avisa e não analisa na errada', async () => {
    const k = await twoJobs();
    k.controller.go({ name: 'paste' });
    await k.store.updateSettings({ activeJobId: 'b' });
    await paste(k, 'Ana Inventada', ['Java'], 'ana');
    assert.equal((await k.store.listAllCandidates()).items.length, 0);
    assert.ok(k.controller.ui.banner !== null);
  });
});

describe('nome corrigido vale para todos os registros (RF-91)', () => {
  test('corrigir e colar de novo mantém o nome, igual nas duas vagas', async () => {
    const k = await twoJobs();
    await paste(k, 'Ana Inventada', ['Java'], 'ana');
    k.controller.run({ id: 'activate_job', jobId: 'b' });
    await settle();
    await paste(k, 'Ana Inventada', ['Python'], 'ana');
    const any = (await k.store.listAllCandidates()).items[0]!;
    await k.controller.privacy.savePerson(any.id, { name: 'Ana Corrigida', link: url('ana') });
    await paste(k, 'Ana Inventada', ['Python', 'Docker'], 'ana');
    const names = (await k.store.listAllCandidates()).items.map((c) => c.name);
    assert.deepEqual(names, ['Ana Corrigida', 'Ana Corrigida']);
  });
});

describe('reduzir o prazo pede confirmação (RF-90)', () => {
  async function withOldPerson(): Promise<Kit> {
    const k = await twoJobs();
    await paste(k, 'Ana Inventada', ['Java'], 'ana');
    await paste(k, 'Bia Inventada', ['Java'], 'bia');
    const [ana] = k.controller.snapshot().candidates;
    await k.store.saveCandidate({ ...ana!, updatedAt: NOW - 100 * DAY });
    await k.load();
    return k;
  }
  const form = (days: string) => ({ responsibleName: 'Marina Souza', responsibleContact: 'marina@exemplo.test', retentionDays: days });

  test('mostra quantas pessoas serão apagadas e não apaga nem muda nada antes de confirmar', async () => {
    const k = await withOldPerson();
    await k.controller.saveSettings(form('30'));
    assert.deepEqual(k.controller.ui.retentionConfirm, { days: 30, count: 1 });
    assert.equal(k.controller.snapshot().settings.retentionDays, 180);
    assert.equal((await k.store.listAllCandidates()).items.length, 2);
  });

  test('voltar mantém tudo; confirmar muda o prazo e apaga já, sem esperar reabrir', async () => {
    const k = await withOldPerson();
    await k.controller.saveSettings(form('30'));
    k.controller.cancelRetention();
    assert.equal(k.controller.ui.retentionConfirm, null);
    assert.equal((await k.store.listAllCandidates()).items.length, 2);
    await k.controller.saveSettings(form('30'));
    await k.controller.confirmRetention();
    assert.equal(k.controller.snapshot().settings.retentionDays, 30);
    const left = (await k.store.listAllCandidates()).items;
    assert.deepEqual(left.map((c) => c.name), ['Bia Inventada']);
  });

  test('prazo que não deixa ninguém vencido muda sem perguntar', async () => {
    const k = await withOldPerson();
    await k.controller.saveSettings(form('120'));
    assert.equal(k.controller.ui.retentionConfirm, null);
    assert.equal(k.controller.snapshot().settings.retentionDays, 120);
  });
});

describe('somar mais texto e repetição de clique (RF-34, RF-64)', () => {
  test('somar texto a quem tem link fora do LinkedIn não cria outro registro', async () => {
    const k = await twoJobs();
    await k.controller.submitPaste({ text: profile('Ana Inventada', ['Java']), url: 'https://github.com/ana-inventada', name: 'Ana Inventada' });
    const id = k.controller.snapshot().candidates[0]!.id;
    k.controller.run({ id: 'add_more_text', candidateId: id });
    await k.controller.submitPaste({ text: 'Competências\nDocker', url: 'https://github.com/ana-inventada', name: '' });
    assert.equal((await k.store.listAllCandidates()).items.length, 1);
  });

  test('duas análises seguidas da mesma pessoa viram um registro só, e a segunda é ignorada', async () => {
    const k = await twoJobs();
    const values = { text: profile('Ana Inventada', ['Java']), url: url('ana'), name: 'Ana Inventada' };
    await Promise.all([k.controller.submitPaste(values), k.controller.submitPaste(values)]);
    assert.equal((await k.store.listAllCandidates()).items.length, 1);
    assert.equal(k.controller.ui.busy, false);
  });
});

describe('título da vaga passa pela trava (RF-13)', () => {
  test('recusa o título com critério proibido e mostra o motivo; cidade é permitida', async () => {
    const k = await twoJobs();
    await k.controller.saveJob(null, { title: 'Dev Java homem até 30 anos', text: '' });
    assert.ok((k.controller.ui.errors['title'] ?? '') !== '');
    assert.equal(k.controller.snapshot().jobs.length, 2, 'nada foi guardado');
    await k.controller.saveJob(null, { title: 'Dev Java em São Paulo', text: '' });
    assert.equal(k.controller.snapshot().jobs.length, 3);
  });
});

describe('a conversa de requisitos', () => {
  test('o passo com vaga indicada não depende da ativa', async () => {
    const k = await twoJobs();
    const { settings, jobs } = k.controller.snapshot();
    const messages = buildConversation({ settings, jobs, activeJob: null, step: { name: 'requirements', jobId: 'b' }, candidates: [], now: NOW, analysis: null, filters: NO_FILTERS, report: k.controller.ui.report });
    assert.equal(messages[0]?.kind, 'requirements');
  });
});
