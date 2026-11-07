// A lista fechada de cargos (RF-42, DP-23): o rótulo guardado é escrito pela lista, neutro de gênero. Sem correspondência, vazio.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { WORK_TITLES, hasWorkWord, workTitleOf } from '../../../src/core/profile/work-titles.ts';

describe('O rótulo sai da lista', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['Engenheira de Dados Sênior - Acme', 'Engenheiro(a) de dados Sênior'],
    ['Engenheiro de Dados Sênior - Acme', 'Engenheiro(a) de dados Sênior'],
    ['Engenheiro(a) de Dados Sr.', 'Engenheiro(a) de dados Sênior'],
    ['Desenvolvedora', 'Desenvolvedor(a)'],
    ['Desenvolvedor', 'Desenvolvedor(a)'],
    ['Desenvolvedor(a)', 'Desenvolvedor(a)'],
    ['Desenvolvedor/a', 'Desenvolvedor(a)'],
    ['Desenvolvedore', 'Desenvolvedor(a)'],
    ['Engenheir@ de Dados', 'Engenheiro(a) de dados'],
    ['Engenheire de Dados', 'Engenheiro(a) de dados'],
    ['Engenheirx de Dados', 'Engenheiro(a) de dados'],
    ['Desenvolvedora Sênior', 'Desenvolvedor(a) Sênior'],
    ['Desenvolvedor Plena', 'Desenvolvedor(a) Pleno'],
    ['Desenvolvedor Java Pleno', 'Desenvolvedor(a) Pleno'],
    ['Desenvolvedora Back-end Jr', 'Desenvolvedor(a) back-end Júnior'],
    ['Desenvolvedor Backend', 'Desenvolvedor(a) back-end'],
    ['Analista', 'Analista'],
    ['Analista de Sistemas - Sênior', 'Analista de sistemas Sênior'],
    ['Analista Plena', 'Analista Pleno'],
    ['Tech Lead', 'Tech Lead'],
    ['Líder Técnica', 'Líder técnico(a)'],
    ['Líder Técnico do Time', 'Líder técnico(a)'],
    ['Consultora', 'Consultor(a)'],
    ['Arquiteta de Software', 'Arquiteto(a) de software'],
    ['Gerente', 'Gerente'],
    ['Gerenta de Projetos', 'Gerente de projetos'],
    ['Coordenadora de TI', 'Coordenador(a)'],
    ['Diretora', 'Diretor(a)'],
    ['Fundadora', 'Fundador(a)'],
    ['Sócia', 'Sócio(a)'],
    ['CTO', 'CTO'],
    ['Estagiária de Software', 'Estagiário(a)'],
    ['Trainee', 'Trainee'],
    ['Pesquisadora', 'Pesquisador(a)'],
    ['Instrutora de Python', 'Instrutor(a)'],
    ['Especialista em Dados', 'Especialista'],
    ['QA', 'QA'],
    ['DevOps', 'DevOps'],
    ['SRE', 'SRE'],
    ['Senior Software Engineer', 'Engenheiro(a) de software Sênior'],
    ['Software Engineer at Acme', 'Engenheiro(a) de software'],
    ['Staff Engineer', 'Engenheiro(a)'],
    ['Junior Developer', 'Desenvolvedor(a) Júnior'],
    ['Consultant', 'Consultor(a)'],
    ['Lead Developer', 'Desenvolvedor(a)'],
    ['Partner Manager', 'Gerente'],
    ['Dev', 'Desenvolvedor(a)'],
    ['Eng', 'Engenheiro(a)'],
  ];
  for (const [line, label] of cases) {
    test(`${line} => ${label}`, () => assert.equal(workTitleOf(line), label));
  }
});

describe('Sem correspondência: vazio, e nada do texto entra', () => {
  const none = [
    '', 'Acme', 'Acme Ltda', 'Tenho 38 anos, sou casada', 'Mãe de dois, moro em Campinas', 'Austin, Texas', 'Região de Campinas', 'Cargo Um',
    'Maternidade', 'Sênior', 'Pleno', 'Senior Sistemas', 'Sentinelaempresa', 'a'.repeat(500), 'Consultoria', 'Engenharia de Dados', 'Desenvolvimento',
  ];
  for (const line of none) {
    test(`"${line.slice(0, 40)}"`, () => {
      assert.equal(workTitleOf(line), '');
      assert.equal(hasWorkWord(line), false);
    });
  }

  test('entrada que não é texto', () => {
    assert.equal(workTitleOf(null as unknown as string), '');
    assert.equal(workTitleOf(42 as unknown as string), '');
  });

  test('o que vem depois da empresa não vira nível', () => {
    assert.equal(workTitleOf('Analista na Senior Sistemas'), 'Analista');
    assert.equal(workTitleOf('Analista - Senior Sistemas'), 'Analista');
  });

  test('a saída nunca tem palavra de fora da lista', () => {
    const line = 'Engenheira de Dados Sentinelaum - Sentinelaempresa, Sentinelalocal (Sentinelapessoal)';
    assert.doesNotMatch(workTitleOf(line), /sentinela/iu);
    assert.equal(workTitleOf(line), 'Engenheiro(a) de dados');
  });
});

describe('A lista', () => {
  const required = [
    'Desenvolvedor(a)', 'Engenheiro(a) de dados', 'Analista', 'Tech Lead', 'Líder técnico(a)', 'Consultor(a)', 'Arquiteto(a) de software', 'Gerente',
    'Coordenador(a)', 'Diretor(a)', 'Fundador(a)', 'Sócio(a)', 'CTO', 'Estagiário(a)', 'Trainee', 'Pesquisador(a)', 'Instrutor(a)', 'Especialista',
    'QA', 'DevOps', 'SRE',
  ];
  const labels = new Set(WORK_TITLES.map((title) => title.neutral));
  for (const label of required) {
    test(`tem ${label}`, () => assert.ok(labels.has(label)));
  }

  test('toda entrada tem as três formas, e cada forma leva ao rótulo neutro', () => {
    for (const { masculine, feminine, neutral } of WORK_TITLES) {
      assert.ok(masculine !== '' && feminine !== '' && neutral !== '', neutral);
      assert.equal(workTitleOf(masculine), neutral, masculine);
      assert.equal(workTitleOf(feminine), neutral, feminine);
      assert.equal(workTitleOf(neutral), neutral, neutral);
    }
  });

  test('o rótulo não muda com o gênero da linha, em nenhuma entrada', () => {
    for (const { masculine, feminine } of WORK_TITLES) {
      assert.equal(workTitleOf(`${masculine} Sênior`), workTitleOf(`${feminine} Sênior`), masculine);
    }
  });

  test('nenhuma entrada é pausa, família ou saúde', () => {
    assert.doesNotMatch(JSON.stringify(WORK_TITLES), /matern|patern|licen[cç]a|cuidad|dona de casa|m[aã]e\b|volunt/iu);
  });
});
