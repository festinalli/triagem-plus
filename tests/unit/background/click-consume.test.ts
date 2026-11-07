import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AnalyzeInput, AnalyzeOutcome } from '../../../src/core/conversation/analyze-store.ts';
import { createPendingConsumer, handlePending, isPendingRead, judgePending } from '../../../src/panel/click-consume.ts';
import { CLICK_MESSAGES } from '../../../src/panel/click-strings.ts';
import type { Controller } from '../../../src/panel/app.ts';

const OK: AnalyzeOutcome = { ok: true, candidateId: 'c', updated: false, addedNothing: false, notProfileLink: false };

function fake(outcomes: AnalyzeOutcome[]) {
  const calls: AnalyzeInput[] = [];
  const ui = { banner: null as string | null, drafts: {} as Record<string, string>, errors: {} as Record<string, string> };
  const steps: string[] = [];
  const ctl = {
    ui,
    analyzeAndStore: async (input: AnalyzeInput) => {
      calls.push(input);
      return outcomes.shift() ?? OK;
    },
    go: (step: { name: string }) => void steps.push(step.name),
    redraw: () => undefined,
  } as unknown as Controller;
  return { ctl, calls, ui, steps };
}

const read = (title: string) => ({ ok: true as const, at: 1, read: { text: 'texto', url: 'https://www.linkedin.com/in/ficticia/', title } });

describe('painel consome a leitura', () => {
  test('reconhece só o formato do pendingRead', () => {
    assert.equal(isPendingRead(read('t')), true);
    assert.equal(isPendingRead({ ok: false, at: 1, error: 'x' }), true);
    assert.equal(isPendingRead({ ok: true, at: 1 }), false);
    assert.equal(isPendingRead(undefined), false);
  });

  test('o nome vem do leitor: primeira chamada sem nome e origem clicked', async () => {
    const f = fake([OK]);
    await handlePending(f.ctl, read('(3) Ana | LinkedIn'));
    assert.deepEqual(f.calls, [{ text: 'texto', url: 'https://www.linkedin.com/in/ficticia/', name: null, source: 'clicked' }]);
  });

  test('sem nome do leitor, usa o título da aba sem contador e sem sufixo', async () => {
    const f = fake([{ ok: false, reason: 'no_name' }, OK]);
    await handlePending(f.ctl, read('(3) Ana Fictícia | LinkedIn'));
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[1]?.name, 'Ana Fictícia');
  });

  test('sem nome nem título, a conversa pede o nome e não guarda nada', async () => {
    const f = fake([{ ok: false, reason: 'no_name' }]);
    await handlePending(f.ctl, read('| LinkedIn'));
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.steps, ['paste']);
    assert.equal(f.ui.errors['name'], CLICK_MESSAGES.noName);
  });

  test('sem vaga ou sem aceite: orienta na conversa', async () => {
    const f = fake([{ ok: false, reason: 'no_job' }]);
    await handlePending(f.ctl, read('x'));
    assert.equal(f.ui.banner, CLICK_MESSAGES.needJob);
    const g = fake([{ ok: false, reason: 'no_acceptance' }]);
    await handlePending(g.ctl, read('x'));
    assert.equal(g.ui.banner, CLICK_MESSAGES.needAcceptance);
  });

  test('erro de leitura aparece como mensagem simples', async () => {
    const f = fake([]);
    await handlePending(f.ctl, { ok: false, at: 1, error: 'A Triagem+ não pode ler esta página.' });
    assert.equal(f.ui.banner, 'A Triagem+ não pode ler esta página.');
    assert.equal(f.calls.length, 0);
  });
});

describe('quem consome a leitura (RF-64, RF-32)', () => {
  const NOW = 1_000_000;
  const on = { windowId: 1, now: NOW, clickReadOn: true };
  const at = (ms: number, extra: object = {}) => ({ ...read('Ana Fictícia | LinkedIn'), at: NOW - ms, ...extra });

  test('só o painel da janela do gesto consome; o de outra janela deixa onde está', () => {
    assert.equal(judgePending(at(10, { windowId: 1 }), on), 'take');
    assert.equal(judgePending(at(10, { windowId: 2 }), on), 'ignore');
    assert.equal(judgePending(at(10), on), 'take', 'sem janela registrada, qualquer painel consome');
    assert.equal(judgePending(at(10, { windowId: 2 }), { ...on, windowId: undefined }), 'take', 'sem saber a própria janela, consome');
  });

  test('com mais de 2 minutos, apaga sem analisar, de qualquer janela', () => {
    assert.equal(judgePending(at(119_000), on), 'take');
    assert.equal(judgePending(at(121_000), on), 'drop');
    assert.equal(judgePending(at(121_000, { windowId: 2 }), on), 'drop');
  });

  test('leitura de página com a opção desligada é apagada sem analisar; o aviso de erro segue', () => {
    assert.equal(judgePending(at(10), { ...on, clickReadOn: false }), 'drop');
    assert.equal(judgePending({ ok: false, at: NOW - 10, error: 'x' }, { ...on, clickReadOn: false }), 'take');
  });

  function consumer(windowId: number | undefined, clickReadOn = true) {
    const f = fake([OK, OK, OK]);
    let current: unknown;
    const removed: number[] = [];
    let listener: (value: unknown) => void = () => undefined;
    const api = createPendingConsumer(f.ctl, Promise.resolve(), {
      get: async () => current,
      remove: async () => void removed.push(1),
      watch: (fn) => void (listener = fn),
      windowId: async () => windowId,
      now: () => NOW,
      clickReadOn: async () => clickReadOn,
    });
    api.start();
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));
    return { f, removed, push: (value: unknown) => listener(value), settle, set: (value: unknown) => void (current = value), api };
  }

  test('duas janelas: só a do gesto lê e apaga; a outra não faz nada', async () => {
    const mine = consumer(1);
    const other = consumer(2);
    const pending = at(10, { windowId: 1 });
    mine.push(pending);
    other.push(pending);
    await mine.settle();
    assert.equal(mine.f.calls.length, 1);
    assert.equal(mine.removed.length, 1);
    assert.equal(other.f.calls.length, 0);
    assert.equal(other.removed.length, 0);
  });

  test('leitura velha ou com a opção desligada é apagada e não entra na lista', async () => {
    const old = consumer(1);
    old.push(at(500_000));
    await old.settle();
    assert.deepEqual([old.f.calls.length, old.removed.length], [0, 1]);
    const off = consumer(1, false);
    off.push(at(10));
    await off.settle();
    assert.deepEqual([off.f.calls.length, off.removed.length], [0, 1]);
  });

  test('a leitura que já estava guardada ao abrir também segue a regra', async () => {
    const window2 = consumer(2);
    window2.set(at(10, { windowId: 1 }));
    window2.api.start();
    await window2.settle();
    assert.equal(window2.f.calls.length, 0);
  });
});
