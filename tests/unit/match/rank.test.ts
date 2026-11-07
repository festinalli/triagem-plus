// A ordem da lista (RF-54, RF-67): empates pelas regras, e nunca pelo nome.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { positionOf, sortCandidates, topTen } from '../../../src/core/match/rank.ts';
import type { Rankable } from '../../../src/core/match/rank.ts';

interface Row extends Rankable {
  readonly name: string;
}

function row(id: string, score: number, requiredMet: number, addedAt: number, name = 'Pessoa Fictícia'): Row {
  return { id, name, addedAt, match: { score, requiredMet } };
}

function ids(list: readonly Rankable[]): string[] {
  return list.map((candidate) => candidate.id);
}

describe('sortCandidates', () => {
  test('nota maior primeiro', () => {
    assert.deepEqual(ids(sortCandidates([row('a', 50, 9, 1), row('b', 90, 0, 9), row('c', 70, 1, 5)])), ['b', 'c', 'a']);
  });

  test('empate na nota: mais obrigatórios atendidos', () => {
    assert.deepEqual(ids(sortCandidates([row('a', 80, 1, 1), row('b', 80, 3, 9), row('c', 80, 2, 5)])), ['b', 'c', 'a']);
  });

  test('empate também nos obrigatórios: quem entrou primeiro', () => {
    assert.deepEqual(ids(sortCandidates([row('a', 80, 2, 30), row('b', 80, 2, 10), row('c', 80, 2, 20)])), ['b', 'c', 'a']);
  });

  test('empate em tudo: pelo id, o que torna a ordem sempre a mesma', () => {
    const expected = ['a', 'b', 'c'];
    assert.deepEqual(ids(sortCandidates([row('c', 80, 2, 10), row('a', 80, 2, 10), row('b', 80, 2, 10)])), expected);
    assert.deepEqual(ids(sortCandidates([row('b', 80, 2, 10), row('c', 80, 2, 10), row('a', 80, 2, 10)])), expected);
  });

  test('nomes diferentes não mudam a ordem', () => {
    const shape: ReadonlyArray<readonly [string, number, number, number]> = [
      ['a', 80, 2, 10],
      ['b', 80, 2, 10],
      ['c', 80, 2, 20],
      ['d', 80, 1, 5],
      ['e', 90, 0, 50],
    ];
    const named = (names: readonly string[]) => shape.map(([id, score, met, added], index) => row(id, score, met, added, names[index]));
    const one = sortCandidates(named(['Ana', 'Bruno', 'Carla', 'Davi', 'Eva']));
    const other = sortCandidates(named(['Zuleica', 'Yuri', 'Xavier', 'Wanda', 'Abel']));
    assert.deepEqual(ids(one), ['e', 'a', 'b', 'c', 'd']);
    assert.deepEqual(ids(other), ids(one));
  });

  test('o id compara por código de caractere, sem depender de idioma', () => {
    assert.deepEqual(ids(sortCandidates([row('a', 1, 0, 0), row('B', 1, 0, 0), row('Á', 1, 0, 0)])), ['B', 'a', 'Á']);
  });

  test('não muda a lista recebida', () => {
    const list = [row('a', 10, 0, 0), row('b', 20, 0, 0)];
    sortCandidates(list);
    assert.deepEqual(ids(list), ['a', 'b']);
  });
});

describe('topTen', () => {
  const list = Array.from({ length: 15 }, (_, index) => row(`p${String(index).padStart(2, '0')}`, index, 0, 0));

  test('os 10 de maior nota, em ordem', () => {
    const top = topTen(list);
    assert.equal(top.length, 10);
    assert.equal(top[0]?.id, 'p14');
    assert.equal(top[9]?.id, 'p05');
  });

  test('com menos de 10, os que houver', () => {
    assert.deepEqual(ids(topTen([row('a', 1, 0, 0), row('b', 2, 0, 0)])), ['b', 'a']);
    assert.deepEqual(topTen([]), []);
  });
});

describe('positionOf', () => {
  const list = [row('a', 10, 0, 0), row('b', 30, 0, 0), row('c', 20, 0, 0)];

  test('a posição a partir de 1, com a lista em qualquer ordem', () => {
    assert.equal(positionOf(list, 'b'), 1);
    assert.equal(positionOf(list, 'c'), 2);
    assert.equal(positionOf(list, 'a'), 3);
  });

  test('nulo se a pessoa não está na lista', () => {
    assert.equal(positionOf(list, 'z'), null);
    assert.equal(positionOf([], 'a'), null);
  });
});
