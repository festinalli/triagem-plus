// O botão Próximo perfil (D-11, RF-26): quem é o próximo e o que acontece em cada passo. Sem Chrome, porque as partes do
// navegador são trocadas. Pessoas inventadas.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../../src/background/gesture.ts';
import type { Candidate, ProfileSection } from '../../../src/core/model.ts';
import type { PageRead } from '../../../src/core/page-read.ts';
import { NEXT_PROFILE } from '../../../src/panel/click-strings.ts';
import { nextTarget, openAndRead, pendingTargets } from '../../../src/panel/next-profile.ts';
import type { NextProfileDeps } from '../../../src/panel/next-profile.ts';

function person(id: string, score: number, sections: readonly ProfileSection[], profileUrl = `https://www.linkedin.com/in/${id}?miniProfileUrn=abc`): Candidate {
  return {
    id,
    jobId: 'vaga-1',
    name: `Pessoa ${id}`,
    profileUrl,
    profileKey: `/in/${id}/`,
    card: { totalMonths: null, currentTitle: null, terms: [], searchedFreeTerms: [], sectionsRead: sections, truncated: false },
    match: { score, band: 'partial', results: [], requiredMet: 0, requiredTotal: 1 },
    stage: 'new',
    favorite: false,
    notes: '',
    informedAt: null,
    source: 'results',
    addedAt: 1,
    updatedAt: 1,
  };
}

describe('quem é o próximo', () => {
  const list = [
    person('nota-completa', 90, ['experience']),
    person('pre-baixa', 30, ['listing']),
    person('pre-alta', 50, ['listing']),
    person('fora-do-linkedin', 60, ['listing'], 'https://exemplo.test/in/fora-do-linkedin/'),
    person('lista-e-perfil', 70, ['listing', 'experience']),
  ];

  test('só quem tem só pré-nota e link de perfil, na ordem da lista, com o link limpo', () => {
    assert.deepEqual(pendingTargets(list), [
      { id: 'pre-alta', url: 'https://www.linkedin.com/in/pre-alta/' },
      { id: 'pre-baixa', url: 'https://www.linkedin.com/in/pre-baixa/' },
    ]);
  });

  test('quem já falhou fica para depois; ninguém sobrando dá nulo', () => {
    assert.equal(nextTarget(list, new Set())?.id, 'pre-alta');
    assert.equal(nextTarget(list, new Set(['pre-alta']))?.id, 'pre-baixa');
    assert.equal(nextTarget(list, new Set(['pre-alta', 'pre-baixa'])), null);
    assert.equal(nextTarget([person('so-nota', 80, ['experience'])], new Set()), null);
  });
});

describe('openAndRead', () => {
  const TARGET = { id: 'pre-alta', url: 'https://www.linkedin.com/in/pre-alta/' };
  const READ: PageRead = { url: TARGET.url, title: 'Pessoa Inventada | LinkedIn', text: 'Experiência\nDev Java' };

  function deps(overrides: Partial<NextProfileDeps> = {}) {
    const calls: string[] = [];
    const value: NextProfileDeps = {
      access: Promise.resolve(true),
      open: async (url) => {
        calls.push(`open ${url}`);
        return { tabId: 9, url };
      },
      waitContent: async () => {
        calls.push('wait');
        return true;
      },
      readProfile: async () => {
        calls.push('read');
        return READ;
      },
      ...overrides,
    };
    return { value, calls };
  }

  test('abre, espera o texto e lê', async () => {
    const { value, calls } = deps();
    assert.deepEqual(await openAndRead(TARGET, value), { ok: true, read: READ });
    assert.deepEqual(calls, [`open ${TARGET.url}`, 'wait', 'read']);
  });

  test('sem permissão: não abre nada', async () => {
    const { value, calls } = deps({ access: Promise.resolve(false) });
    assert.deepEqual(await openAndRead(TARGET, value), { ok: false, error: NEXT_PROFILE.noAccess, opened: false });
    assert.deepEqual(calls, []);
  });

  test('não abriu, ou o LinkedIn mostrou o login ou uma verificação: nada é lido', async () => {
    const notOpened = deps({ open: async () => undefined });
    assert.deepEqual(await openAndRead(TARGET, notOpened.value), { ok: false, error: NEXT_PROFILE.notOpened, opened: false });
    for (const url of ['https://www.linkedin.com/authwall?trk=x', 'https://www.linkedin.com/checkpoint/challenge/abc', 'https://www.linkedin.com/login', undefined]) {
      const { value, calls } = deps({ open: async () => ({ tabId: 9, url }) });
      assert.deepEqual(await openAndRead(TARGET, value), { ok: false, error: NEXT_PROFILE.notProfile, opened: false }, String(url));
      assert.deepEqual(calls, []);
    }
  });

  test('abriu e não deu para ler: a falha é do perfil, e o próximo clique passa para outra pessoa', async () => {
    const empty = deps({ readProfile: async () => ({ ...READ, text: '  ' }) });
    assert.deepEqual(await openAndRead(TARGET, empty.value), { ok: false, error: NEXT_PROFILE.nothingRead, opened: true });
    const blocked = deps({ readProfile: async () => Promise.reject(new Error('Cannot access contents of the page')) });
    assert.deepEqual(await openAndRead(TARGET, blocked.value), { ok: false, error: MESSAGES.blocked, opened: true });
    // A espera que falha não impede a leitura.
    const slow = deps({ waitContent: async () => Promise.reject(new Error('x')) });
    assert.deepEqual(await openAndRead(TARGET, slow.value), { ok: true, read: READ });
  });
});
