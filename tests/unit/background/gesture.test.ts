import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clickReadActive, decideGesture } from '../../../src/background/gesture.ts';
import { isProfileAddress, nameFromTitle } from '../../../src/core/page-read.ts';

describe('decideGesture', () => {
  test('desligada: não lê, em perfil ou fora dele', () => {
    assert.equal(decideGesture({ enabled: false, tabUrl: 'https://www.linkedin.com/in/ficticia/' }), 'off');
    assert.equal(decideGesture({ enabled: false, tabUrl: 'https://exemplo.test/' }), 'off');
    assert.equal(decideGesture({ enabled: false, tabUrl: undefined }), 'off');
  });

  test('ligada em perfil: lê', () => {
    assert.equal(decideGesture({ enabled: true, tabUrl: 'https://www.linkedin.com/in/ficticia/' }), 'read');
    assert.equal(decideGesture({ enabled: true, tabUrl: 'https://www.linkedin.com/in/ficticia' }), 'read');
    assert.equal(decideGesture({ enabled: true, tabUrl: 'https://www.linkedin.com/in/ficticia/?trk=x' }), 'read');
  });

  test('ligada em /in/x/details/skills/ também conta como perfil', () => {
    assert.equal(decideGesture({ enabled: true, tabUrl: 'https://www.linkedin.com/in/ficticia/details/skills/' }), 'read');
  });

  test('ligada fora de perfil (inclusive o atalho em outro site): não lê', () => {
    for (const tabUrl of [
      'https://exemplo.test/in/ficticia/',
      'https://www.linkedin.com/feed/',
      'https://www.linkedin.com/in/',
      'https://www.linkedin.com/in',
      'https://www.linkedin.com/company/in/x',
      'https://www.linkedin.com.exemplo.test/in/ficticia/',
      'https://exemplo.test/?u=https://www.linkedin.com/in/ficticia/',
      'http://www.linkedin.com/in/ficticia/',
      'https://linkedin.com/in/ficticia/',
      'chrome://extensions',
      'texto qualquer',
      '',
      undefined,
    ]) {
      assert.equal(decideGesture({ enabled: true, tabUrl }), 'not_profile', String(tabUrl));
    }
  });
});

describe('clickReadActive', () => {
  const accepted = { version: 1, at: 1 };
  test('exige ligada e aviso aceito', () => {
    assert.equal(clickReadActive({ clickReadEnabled: true, acceptances: { clickRead: accepted } }), true);
    assert.equal(clickReadActive({ clickReadEnabled: true, acceptances: {} }), false);
    assert.equal(clickReadActive({ clickReadEnabled: false, acceptances: { clickRead: accepted } }), false);
  });
});

describe('isProfileAddress', () => {
  test('só https://www.linkedin.com/in/<nome>', () => {
    assert.equal(isProfileAddress('https://www.linkedin.com/in/a'), true);
    assert.equal(isProfileAddress('https://www.linkedin.com/in/a#x'), true);
    assert.equal(isProfileAddress('https://www.linkedin.com/in//'), false);
  });
});

describe('nameFromTitle', () => {
  test('tira o contador do começo e o sufixo do fim', () => {
    assert.equal(nameFromTitle('(3) Ana Fictícia Souza | LinkedIn'), 'Ana Fictícia Souza');
    assert.equal(nameFromTitle('Ana Fictícia Souza | LinkedIn'), 'Ana Fictícia Souza');
    assert.equal(nameFromTitle('(12) Ana Souza'), 'Ana Souza');
  });
  test('passa pelo limpador: pronomes, cargo e empresa não são nome (RF-44, RF-42)', () => {
    assert.equal(nameFromTitle('Ana Souza (Ela/Dela)'), 'Ana Souza');
    assert.equal(nameFromTitle('(2) Ana Souza (Ela/Dela) | LinkedIn'), 'Ana Souza');
    assert.equal(nameFromTitle('Bia Souza - Engenheira de Software - Banco Alfa'), 'Bia Souza');
    assert.equal(nameFromTitle('Bia Souza · Engenheira de Software | LinkedIn'), 'Bia Souza');
    assert.equal(nameFromTitle('Ana-Maria Souza - Dev'), 'Ana-Maria Souza');
  });
  test('sem nome válido, vazio: a conversa pede o nome', () => {
    assert.equal(nameFromTitle('Engenheira de Software - Banco Alfa'), '');
    assert.equal(nameFromTitle('Ana | Souza | LinkedIn'), '');
    assert.equal(nameFromTitle('São Paulo, Brasil | LinkedIn'), '');
  });
  test('sem sobra, devolve vazio', () => {
    assert.equal(nameFromTitle('(3) | LinkedIn'), '');
    assert.equal(nameFromTitle(''), '');
  });
});
