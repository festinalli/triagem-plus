// A troca de gênero das palavras de cargo, usada em termo livre e palavra de cargo (RD-8).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { foldRoleWords, foldTitleWords } from '../../../src/core/match/gender.ts';

describe('foldRoleWords', () => {
  test('troca a forma feminina, com ou sem acento, em qualquer caixa', () => {
    assert.equal(foldRoleWords('ENGENHEIRA Plena'), 'engenheiro pleno');
    assert.equal(foldRoleWords('Estagiária'), 'estagiario');
    assert.equal(foldRoleWords('Estagiária'), 'estagiario');
  });

  test('não mexe no resto', () => {
    assert.equal(foldRoleWords('Analista Sênior de C++'), 'Analista Sênior de C++');
  });
});

describe('foldRoleWords, em termo livre', () => {
  test('forma neutra entre parênteses, com barra ou com arroba', () => {
    assert.equal(foldRoleWords('Engenheiro(a) de plataforma'), 'Engenheiro de plataforma');
    assert.equal(foldRoleWords('Engenheira(o) de plataforma'), 'engenheiro de plataforma');
    assert.equal(foldRoleWords('Desenvolvedor/a'), 'Desenvolvedor');
    assert.equal(foldRoleWords('Engenheir@'), 'Engenheiro');
  });

  test('sigla com barra não é forma neutra', () => {
    assert.equal(foldRoleWords('I/O em S/A'), 'I/O em S/A');
  });

  test('não usa a regra de sufixo: palavra comum fica como está', () => {
    assert.equal(foldRoleWords('Banca de Plataforma'), 'Banca de Plataforma');
  });
});

describe('foldTitleWords, só em palavra de cargo', () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['Tecnóloga', 'tecnologo'],
    ['Tecnólogo', 'tecnologo'],
    ['Engenheira', 'engenheiro'],
    ['Desenvolvedora', 'desenvolvedor'],
    ['Estagiária', 'estagiario'],
    ['Capitã', 'capitao'],
    ['Capitão', 'capitao'],
    ['Patrona', 'patrao'],
    ['Gerenta', 'gerente'],
    ['Gerente', 'gerente'],
    ['Presidenta', 'presidente'],
    ['Chefa', 'chefe'],
    ['Mestra', 'mestre'],
    ['Bacharela', 'bacharel'],
    ['Engenheire', 'engenheiro'],
    ['Plena', 'pleno'],
  ];
  for (const [word, fold] of pairs) {
    test(`${word} => ${fold}`, () => assert.equal(foldTitleWords(word), fold));
  }

  test('as duas formas chegam à mesma coisa, com invariável e sem invariável', () => {
    assert.equal(foldTitleWords('Analista Plena'), foldTitleWords('Analista Pleno'));
    assert.equal(foldTitleWords('Dona do Produto'), foldTitleWords('Dono do Produto'));
    assert.equal(foldTitleWords('Engenheiro(a) de Dados'), foldTitleWords('Engenheira de Dados'));
  });

  test('símbolos ficam', () => {
    assert.equal(foldTitleWords('Analista C++'), 'analisto c++');
  });
});
