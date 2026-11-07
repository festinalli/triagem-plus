// Prova contra a lista inteira: a trava não pode barrar nenhum termo de tecnologia da lista.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARY_TERMS } from '../../../src/core/dictionary/index.ts';
import { checkTerm, findForbidden } from '../../../src/core/guard/index.ts';

const NAMES: readonly string[] = [...new Set(DICTIONARY_TERMS.flatMap((term) => [term.canonical, ...term.synonyms, ...term.protectedForms]))];

function refused(texts: readonly string[]): string[] {
  return texts.flatMap((text) => {
    const result = checkTerm(text);
    return result.allowed ? [] : [`${text} => ${result.topic}[${result.matched}]`];
  });
}

function fired(texts: readonly string[]): string[] {
  return texts.flatMap((text) => {
    const hit = findForbidden(text)[0];
    return hit === undefined ? [] : [`${text} => ${hit.topic}[${hit.matched}]`];
  });
}

describe('prova contra a lista de termos', () => {
  test('a lista tem o tamanho esperado, para a prova não passar sem ler nada', () => {
    assert.ok(DICTIONARY_TERMS.length > 300);
    assert.ok(NAMES.length > 900);
  });

  test('nenhum nome canônico, sinônimo ou grafia é recusado por checkTerm', () => {
    assert.deepEqual(refused(NAMES), []);
  });

  test('nem em maiúsculas', () => {
    assert.deepEqual(refused(NAMES.map((name) => name.toUpperCase())), []);
  });

  test('nenhum dispara em findForbidden, sozinho ou em frase', () => {
    assert.deepEqual(fired(NAMES), []);
    assert.deepEqual(fired(NAMES.map((name) => `Experiência com ${name} em produção`)), []);
    assert.deepEqual(fired(NAMES.map((name) => `3+ years of ${name}`)), []);
  });

  test('com anos mínimos, o nome continua passando', () => {
    assert.deepEqual(refused(NAMES.map((name) => `5 anos de ${name}`)), []);
    assert.deepEqual(refused(NAMES.map((name) => `${name} (5+ anos)`)), []);
  });
});
