// O botão "Ler esta página" (D-10, RF-25): o que ele lê e o que diz quando não lê. Sem Chrome: as partes do navegador são trocadas.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../../src/background/gesture.ts';
import { readOpenTab } from '../../../src/panel/page-read-button.ts';
import type { OpenTab, PanelReadDeps } from '../../../src/panel/page-read-button.ts';
import { PAGE_BUTTON } from '../../../src/panel/click-strings.ts';
import type { PageRead } from '../../../src/core/page-read.ts';
import type { ResultsRead } from '../../../src/core/results/parse.ts';

const RESULTS_URL = 'https://www.linkedin.com/search/results/people/?keywords=teste';
const PROFILE_URL = 'https://www.linkedin.com/in/pessoa-inventada/';
const RESULTS: ResultsRead = { url: RESULTS_URL, items: [{ href: PROFILE_URL, name: 'Pessoa Inventada', text: 'Pessoa Inventada\nDev C#' }] };
const PROFILE: PageRead = { url: PROFILE_URL, title: 'Pessoa Inventada | LinkedIn', text: 'Experiência\nDev C#' };

function deps(tab: OpenTab | undefined, overrides: Partial<PanelReadDeps> = {}) {
  const calls: string[] = [];
  const value: PanelReadDeps = {
    access: Promise.resolve(true),
    activeTab: async () => {
      calls.push('tab');
      return tab;
    },
    readResults: async () => {
      calls.push('results');
      return RESULTS;
    },
    readProfile: async () => {
      calls.push('profile');
      return PROFILE;
    },
    now: () => 7,
    ...overrides,
  };
  return { value, calls };
}

describe('readOpenTab', () => {
  test('busca de pessoas: lê a lista', async () => {
    const { value, calls } = deps({ id: 1, url: RESULTS_URL });
    assert.deepEqual(await readOpenTab(value), { ok: true, results: RESULTS, at: 7 });
    assert.deepEqual(calls, ['tab', 'results']);
  });

  test('perfil: lê o perfil', async () => {
    const { value, calls } = deps({ id: 1, url: PROFILE_URL });
    assert.deepEqual(await readOpenTab(value), { ok: true, read: PROFILE, at: 7 });
    assert.deepEqual(calls, ['tab', 'profile']);
  });

  test('sem a permissão do Chrome: nada é olhado nem lido', async () => {
    const { value, calls } = deps({ id: 1, url: RESULTS_URL }, { access: Promise.resolve(false) });
    assert.deepEqual(await readOpenTab(value), { ok: false, error: PAGE_BUTTON.noAccess, at: 7 });
    assert.deepEqual(calls, []);
    const rejected = deps({ id: 1, url: RESULTS_URL }, { access: Promise.reject(new Error('x')) });
    assert.equal((await readOpenTab(rejected.value)).ok, false);
    assert.deepEqual(rejected.calls, []);
  });

  test('outra página, ou endereço que o Chrome não mostra: nada é lido', async () => {
    for (const url of ['https://www.linkedin.com/feed/', 'https://www.linkedin.com/search/results/all/?keywords=x', 'https://exemplo.test/in/pessoa/', undefined]) {
      const { value, calls } = deps({ id: 1, url });
      assert.deepEqual(await readOpenTab(value), { ok: false, error: PAGE_BUTTON.notLinkedIn, at: 7 }, String(url));
      assert.deepEqual(calls, ['tab']);
    }
  });

  test('sem aba, leitura vazia ou página bloqueada: diz que não leu', async () => {
    assert.deepEqual(await readOpenTab(deps(undefined).value), { ok: false, error: MESSAGES.failed, at: 7 });
    assert.deepEqual(await readOpenTab(deps({ url: RESULTS_URL }).value), { ok: false, error: MESSAGES.failed, at: 7 });
    assert.deepEqual(await readOpenTab(deps({ id: 1, url: RESULTS_URL }, { readResults: async () => undefined }).value), { ok: false, error: MESSAGES.failed, at: 7 });
    const blocked = deps({ id: 1, url: PROFILE_URL }, { readProfile: async () => Promise.reject(new Error('Cannot access contents of the page')) });
    assert.deepEqual(await readOpenTab(blocked.value), { ok: false, error: MESSAGES.blocked, at: 7 });
    const broken = deps({ id: 1, url: PROFILE_URL }, { readProfile: async () => Promise.reject(new Error('outro erro')) });
    assert.deepEqual(await readOpenTab(broken.value), { ok: false, error: MESSAGES.failed, at: 7 });
  });
});
