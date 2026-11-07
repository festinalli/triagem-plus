// DP-24, RF-43, RD-8: o tempo só conta com sinal de trabalho, e pausa na carreira não muda nada.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProfile } from '../../../src/core/match/analyze.ts';
import type { Requirement } from '../../../src/core/model.ts';
import { parseProfileText } from '../../../src/core/profile/parse.ts';
import { AS_OF, free, listed, totalYears } from './helpers.ts';

const TOTAL_5: readonly Requirement[] = [totalYears(5)];
const JOB = 'Engenheira\nAcme · Tempo integral\njan de 2021 - dez de 2021 · 1 ano\nCompetências: Python';
const OLD_JOB = 'Desenvolvedora\nBeta · Tempo integral\njan de 2017 - dez de 2018 · 2 anos\nCompetências: Python';
const experience = (...entries: readonly string[]): string => `Ana Souza\nExperiência\n${entries.join('\n')}\n`;
const run = (text: string, requirements: readonly Requirement[] = TOTAL_5) => analyzeProfile({ text, url: '', requirements, asOf: AS_OF });

describe('O caso central', () => {
  test('Maternidade com período não sobe a nota de 20 para 77', () => {
    const without = run(experience('Eng\nX · Tempo integral\njan de 2021 - dez de 2021'));
    const withBreak = run(experience('Eng\nX · Tempo integral\njan de 2021 - dez de 2021', 'Maternidade\njan de 2022 - o momento'));
    assert.equal(without.match.score, 20);
    assert.equal(withBreak.match.score, 20);
    assert.deepEqual(withBreak.card, without.card);
  });

  test('a frase pessoal e a pausa não mudam o cargo atual', () => {
    for (const label of ['Maternidade', 'Tratamento de câncer', 'Dona de casa', 'Viagem longa']) {
      const { card } = run(experience(`${label}\njan de 2023 - o momento`, 'Engenheira\nAcme · Tempo integral\njan de 2019 - dez de 2022 · 4 anos\nCompetências: Python'));
      assert.equal(card.currentTitle, 'Engenheiro(a)', label);
      assert.equal(card.totalMonths, 48, label);
    }
  });

  test('o emprego com "Saúde e bem-estar" no cargo fica', () => {
    const { card } = run(experience('Dev - Saúde e bem-estar\nX · Tempo integral\njan de 2020 - dez de 2021'));
    assert.equal(card.totalMonths, 24);
    assert.equal(card.currentTitle, 'Desenvolvedor(a)');
  });
});

// O que a revisão mediu: 45 de 50 rótulos mudavam a ficha.
const REVIEW_BREAKS = [
  'Pausa na carreira', 'Licença-maternidade', 'Licença maternidade', 'Maternidade', 'Paternidade', 'Licença-adoção', 'Licença adoção',
  'Licença para cuidar de filho', 'Cuidando dos filhos', 'Mãe', 'Dona de casa', 'Stay-at-home mom', 'Stay-at-home parent', 'Full-time parent',
  'Homemaker', 'Mat leave', 'Maternity', 'Tratamento de saúde', 'Tratamento médico', 'Licença de saúde', 'Licença saúde', 'Afastamento médico',
  'Afastamento por doença', 'Tratamento de câncer', 'Recuperação de cirurgia', 'Sabático', 'Ano sabático', 'Sabbatical', 'Gap year', 'Career gap',
  'Motivos pessoais', 'Personal leave', 'Bereavement leave', 'Family care', 'Elder care', 'Aposentadoria', 'Retired', 'Aposentada', 'Relocation',
  'Layoff', 'Desempregada', 'Unemployed', 'Pausa', 'Transição de carreira', 'Career transition', 'Health', 'Cuidado de idosos', 'Licença-luto',
  'Pausa na carreira: tratamento de câncer', 'Tratamento de câncer (pausa na carreira)', 'Cuidador', 'Cuidadora de idosos', 'Caregiver',
  'Leave of absence', 'Saúde e bem-estar', 'Licença parental',
];

describe('Gêmeo com e sem pausa: ficha e nota idênticas', () => {
  const requirements: readonly Requirement[] = [listed('Python'), totalYears(8), free('core banking', 'preferred')];
  const base = run(experience(JOB, OLD_JOB), requirements);

  test('o controle: nota e total conferidos', () => {
    assert.equal(base.card.totalMonths, 36);
    assert.equal(base.card.currentTitle, 'Engenheiro(a)');
    assert.equal(base.match.score, 59);
  });

  for (const label of REVIEW_BREAKS) {
    test(`${label}, entre dois empregos`, () => {
      const twin = run(experience(JOB, `${label}\njan de 2019 - dez de 2020 · 2 anos`, OLD_JOB), requirements);
      assert.deepEqual(twin.card, base.card);
      assert.deepEqual(twin.match, base.match);
    });

    test(`${label}, como o mais recente, com período em aberto`, () => {
      const twin = run(experience(`${label}\njan de 2022 - o momento`, JOB, OLD_JOB), requirements);
      assert.deepEqual(twin.card, base.card);
      assert.deepEqual(twin.match, base.match);
    });
  }

  for (const label of ['Maternidade', 'Licença para cuidar de filho', 'Tratamento de saúde', 'Sabático', 'Career break', 'Cuidador', 'Leave of absence']) {
    test(`${label}, com termo de tecnologia e tipo de contrato na entrada: some inteira`, () => {
      const entry = `${label}\nTempo integral\njan de 2019 - dez de 2020 · 2 anos\nEstudei Kubernetes.\nCompetências: Kubernetes, AWS`;
      const twin = run(experience(JOB, entry, OLD_JOB), requirements);
      assert.deepEqual(twin.card, base.card);
      assert.deepEqual(twin.match, base.match);
    });
  }
});

describe('Sem sinal de trabalho, o tempo não conta', () => {
  const noSignal = ['Viagem pelo mundo', 'Acme', 'Ano no exterior', 'Empresa Fictícia'];
  for (const title of noSignal) {
    test(`${title}: fora do total e sem meses`, () => {
      const { card } = run(experience(`${title}\njan de 2019 - dez de 2020`));
      assert.equal(card.totalMonths, null);
    });
  }

  test('idioma não é sinal: inglês na descrição não faz intercâmbio virar emprego', () => {
    const { card } = run(experience('Intercâmbio\njan de 2019 - dez de 2020\nEstudei inglês avançado.'));
    assert.equal(card.totalMonths, null);
    assert.equal(card.terms.find((term) => term.key === 'Inglês')?.months ?? null, null);
  });

  test('o termo livre achado na entrada fica sem meses', () => {
    const requirement = free('core banking', 'required');
    const { card, match } = run(experience('Banco Alfa\njan de 2019 - dez de 2020\nPlataforma de core banking.'), [requirement]);
    assert.equal(card.terms.find((term) => term.key === 'core banking')?.months, null);
    assert.equal(match.results[0]?.status, 'met');
  });

  test('tipo de contrato escrito numa frase não é sinal', () => {
    const { card } = run(experience('Viagem longa\njan de 2019 - dez de 2020\nLi um contrato de aluguel em tempo integral.'));
    assert.equal(card.totalMonths, null);
  });
});

describe('Qualquer um dos três sinais basta', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['palavra de cargo', 'Analista\njan de 2019 - dez de 2020'],
    ['palavra de cargo em inglês', 'Software Engineer\njan de 2019 - dez de 2020'],
    ['palavra de cargo com a empresa em cima', 'Acme\nEngenheira\njan de 2019 - dez de 2020'],
    ['tipo de contrato ao lado da empresa', 'Acme · Tempo integral\njan de 2019 - dez de 2020'],
    ['tipo de contrato em linha própria', 'Acme\nFreelance\njan de 2019 - dez de 2020'],
    ['tipo de contrato depois do período', 'Acme\njan de 2019 - dez de 2020\nPJ'],
    ['tipo de contrato em inglês', 'Acme · Self-employed\njan de 2019 - dez de 2020'],
    ['CLT', 'Acme · CLT\njan de 2019 - dez de 2020'],
    ['estágio', 'Acme · Estágio\njan de 2019 - dez de 2020'],
    ['termo de tecnologia na descrição', 'Acme\njan de 2019 - dez de 2020\nAPIs em Java.'],
    ['termo ambíguo designado na lista do cargo', 'Acme\njan de 2019 - dez de 2020\nCompetências: Go'],
  ];
  for (const [name, entry] of cases) {
    test(name, () => assert.equal(run(experience(entry)).card.totalMonths, 24));
  }

  test('o segundo cargo de um grupo herda o tipo de contrato da empresa', () => {
    const text = experience('Acme\nTempo integral · 5 anos\nCargo Um\njan de 2020 - dez de 2020\nCargo Dois\njan de 2019 - dez de 2019');
    assert.equal(parseProfileText(text, AS_OF).totalMonths, 24);
  });
});
