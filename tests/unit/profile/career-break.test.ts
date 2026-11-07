// Pausa na carreira dentro de Experiência (RD-8, RF-44): é dado de saúde ou de família, e a entrada inteira some no leitor.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isCareerBreakLine } from '../../../src/core/profile/career-break.ts';
import { parseProfileText } from '../../../src/core/profile/parse.ts';
import { CAREER_BREAK_LABELS } from '../../fixtures/twins/twins.ts';
import { AS_OF } from './fixtures.ts';

const parse = (text: string) => parseProfileText(text, AS_OF);

const SPELLINGS: readonly string[] = [
  'LICENÇA-MATERNIDADE', 'licenca maternidade', 'LICENCA MATERNIDADE', 'Licença - maternidade', 'licença–paternidade',
  'Licenca parental', 'LICENÇA MÉDICA', 'licenca medica', 'PAUSA NA CARREIRA', 'pausa na carreira', 'Pausa Profissional',
  'CAREER BREAK', 'career break', 'Career Break', 'MATERNITY LEAVE', 'parental Leave', 'CAREGIVING', 'CUIDADOS FAMILIARES',
  'Health and well being', 'HEALTH AND WELL-BEING', 'SAÚDE E BEM-ESTAR', 'saude e bem estar', 'Em licença-maternidade',
];

const JOB = ['Desenvolvedora Sênior', 'Empresa Fictícia Alfa · Tempo integral', 'jan de 2020 - dez de 2021 · 2 anos', 'Sistemas em Java.', 'Competências: Java'];
const OTHER_JOB = ['Analista', 'Empresa Fictícia Beta · Tempo integral', 'jan de 2017 - dez de 2018 · 2 anos', 'Legados em PHP.'];
const BREAK_BODY = ['jan de 2022 - dez de 2023 · 2 anos', 'Cuidando da minha filha Sentinela.', 'Competências: Kubernetes, AWS'];

const profile = (...experience: ReadonlyArray<readonly string[]>): string => ['Experiência', ...experience.flat()].join('\n');
const withoutBreak = parse(profile(JOB, OTHER_JOB));

function assertGone(text: string, label: string): void {
  const parsed = parse(text);
  assert.deepEqual(parsed.experiences, withoutBreak.experiences, label);
  assert.equal(parsed.totalMonths, withoutBreak.totalMonths, label);
  assert.doesNotMatch(JSON.stringify(parsed), /Sentinela|Kubernetes|filha/u, label);
  assert.ok(!JSON.stringify(parsed).toLowerCase().includes(label.toLowerCase()), `"${label}" ficou no resultado`);
}

describe('O rótulo é reconhecido', () => {
  for (const label of [...CAREER_BREAK_LABELS, ...SPELLINGS]) {
    test(label, () => assert.equal(isCareerBreakLine(label), true));
  }

  const combined = ['Career break · Parental leave', 'Pausa na carreira: Licença parental', 'Pausa na carreira - Cuidados familiares', 'Licença parental · Tempo integral', 'Licença-maternidade (6 meses)'];
  for (const line of combined) {
    test(`junto de outra coisa: ${line}`, () => assert.equal(isCareerBreakLine(line), true));
  }

  const notBreaks = [
    'Desenvolvedora de apps de saúde e bem-estar',
    'Analista de licença médica',
    'Engenheira de software em health and well-being',
    'Caregiving Platform Engineer',
    'Cobri a licença médica de um colega.',
    'Desenvolvedora Sênior',
    'Saúde',
    `Licença parental ${'x'.repeat(200)}`,
  ];
  for (const line of notBreaks) {
    test(`não é pausa: ${line.slice(0, 50)}`, () => assert.equal(isCareerBreakLine(line), false));
  }
});

describe('A entrada inteira some, em cada posição e forma', () => {
  for (const label of [...CAREER_BREAK_LABELS, ...SPELLINGS]) {
    test(`${label}: como cargo, na frente`, () => assertGone(profile([label, ...BREAK_BODY], JOB, OTHER_JOB), label));
    test(`${label}: como cargo, no meio`, () => assertGone(profile(JOB, [label, ...BREAK_BODY], OTHER_JOB), label));
    test(`${label}: como cargo, no fim`, () => assertGone(profile(JOB, OTHER_JOB, [label, ...BREAK_BODY]), label));
    test(`${label}: abaixo de "Pausa na carreira"`, () => assertGone(profile(JOB, ['Pausa na carreira', label, ...BREAK_BODY], OTHER_JOB), label));
    test(`${label}: acima de "Pausa na carreira"`, () => assertGone(profile(JOB, [label, 'Pausa na carreira', ...BREAK_BODY], OTHER_JOB), label));
  }

  test('com tipo de contrato e local, que também somem', () => {
    assertGone(profile(JOB, ['Licença parental', 'Tempo integral', ...BREAK_BODY.slice(0, 1), 'São Paulo, Brasil', ...BREAK_BODY.slice(1)], OTHER_JOB), 'Licença parental');
    assertGone(profile(JOB, ['Licença parental · Tempo integral', ...BREAK_BODY], OTHER_JOB), 'Licença parental');
  });

  test('tipo livre abaixo de "Career break"', () => {
    assertGone(profile(JOB, ['Career break', 'Viagem longa', ...BREAK_BODY], OTHER_JOB), 'Career break');
    assertGone(profile(JOB, ['Viagem longa', 'Career break', ...BREAK_BODY], OTHER_JOB), 'Viagem longa');
  });

  test('o tempo não é somado, mesmo sem sobrepor nada', () => {
    const parsed = parse(profile(['Licença médica', 'jan de 2000 - dez de 2009 · 10 anos'], JOB));
    assert.equal(parsed.totalMonths, 24);
    assert.deepEqual(parsed.experiences.map((experience) => experience.title), ['Desenvolvedora Sênior']);
  });

  test('só a pausa em Experiência: a seção fica como não lida', () => {
    const parsed = parse(profile(['Licença parental', 'jan de 2020 - dez de 2021 · 2 anos']));
    assert.deepEqual(parsed.experiences, []);
    assert.equal(parsed.totalMonths, null);
    assert.deepEqual(parsed.sectionsRead, []);
  });

  test('depois de um grupo de cargos da mesma empresa, nada do grupo muda', () => {
    const group = ['Empresa Fictícia Alfa', 'Tempo integral · 5 anos', 'Cargo A', 'jan de 2021 - dez de 2021 · 1 ano', 'Descrição A.', 'Cargo B', 'jan de 2020 - dez de 2020 · 1 ano', 'Descrição B.'];
    const after = ['Analista', 'Empresa Fictícia Beta · Tempo integral', 'jan de 2017 - dez de 2018 · 2 anos', 'Legados em PHP.'];
    const expected = parse(profile(group, after));
    for (const entry of [['Licença parental', ...BREAK_BODY], ['Pausa na carreira', 'Licença parental', ...BREAK_BODY]]) {
      const parsed = parse(profile(group, entry, after));
      assert.deepEqual(parsed.experiences, expected.experiences);
      assert.equal(parsed.totalMonths, expected.totalMonths);
    }
  });

  test('sem período, o bloco também some', () => {
    const undated = ['Desenvolvedora Sênior', 'Sistemas em Java.', '', 'Licença parental', 'Cuidando da minha filha Sentinela.', '', 'Analista', 'Legados em PHP.'].join('\n');
    const parsed = parse(`Experiência\n${undated}`);
    assert.deepEqual(parsed.experiences.map((experience) => experience.title), ['Desenvolvedora Sênior', 'Analista']);
    assert.doesNotMatch(JSON.stringify(parsed), /Sentinela|Licença/u);
  });
});

describe('O que não é pausa fica', () => {
  test('sem período, um bloco com palavra de cargo não some por causa da segunda linha', () => {
    const parsed = parse('Experiência\nDesenvolvedora\nCuidar da plataforma de pagamentos');
    assert.deepEqual(parsed.experiences.map((experience) => experience.title), ['Desenvolvedora']);
  });

  test('rótulo com período e sem nenhuma outra linha some', () => {
    assert.deepEqual(parse('Experiência\nPausa\njan de 2020 - dez de 2021').experiences, []);
  });

  test('cargo em empresa de saúde', () => {
    const title = 'Desenvolvedora de apps de saúde e bem-estar';
    const parsed = parse(profile([title, 'Empresa Fictícia Alfa · Tempo integral', 'jan de 2020 - dez de 2021 · 2 anos', 'Apps em Kotlin.']));
    assert.deepEqual(parsed.experiences.map((experience) => experience.title), [title]);
    assert.equal(parsed.totalMonths, 24);
  });

  test('citação na descrição não derruba o cargo', () => {
    const parsed = parse(profile(['Desenvolvedora Sênior', 'Empresa Fictícia Alfa · Tempo integral', 'jan de 2020 - dez de 2021 · 2 anos', 'Voltei da licença-maternidade em 2021 e assumi o time.', 'Sistemas em Java.'], OTHER_JOB));
    assert.deepEqual(parsed.experiences.map((experience) => experience.title), ['Desenvolvedora Sênior', 'Analista']);
    assert.equal(parsed.totalMonths, 48);
  });
});

describe('O rótulo vale pela linha inteira do cargo, por raízes (DP-24)', () => {
  const breaks = [
    'Maternidade', 'Paternidade', 'Licença', 'Pausa', 'Licença-adoção', 'Licença para cuidar de filho', 'Licença para estudar', 'Sabático', 'Ano sabático', 'Sabbatical',
    'Parental', 'Career break', 'Leave of absence', 'Cuidador', 'Cuidadora de idosos', 'Cuidando dos filhos', 'Caregiver', 'Caregiving', 'Tratamento de saúde',
    'Tratamento médico', 'Tratamento de câncer', 'Saúde e bem-estar', 'Mãe', 'Pai em tempo integral', 'Dona de casa', 'Stay-at-home mom', 'Full-time parent',
    'Mat leave', 'Sick leave', 'Personal leave', 'Afastamento médico', 'Aposentada', 'Retired', 'Desempregada', 'Unemployed',
    'Pausa na carreira: tratamento de câncer', 'Tratamento de câncer (pausa na carreira)',
  ];
  for (const line of breaks) {
    test(`é pausa: ${line}`, () => assert.equal(isCareerBreakLine(line), true));
  }

  const jobs = [
    'Dev - Saúde e bem-estar', 'Desenvolvedora - Saúde e bem-estar', 'Engenheira de Software - Saúde e bem-estar', 'Product Manager - Caregiving',
    'Desenvolvedora · Health and well-being', 'Desenvolvedora: Saúde e bem-estar', 'Analista de licença médica', 'Caregiving Platform Engineer',
    'Licenciatura em Matemática', 'Licenciamento de software', 'Pattern Matching', 'Saúde', 'Tratamento de dados', 'Cobri a licença médica de um colega.',
    'Cuidei de todo o back-end da plataforma.',
  ];
  for (const line of jobs) {
    test(`não é pausa: ${line}`, () => assert.equal(isCareerBreakLine(line), false));
  }

  const kept: ReadonlyArray<readonly [string, string]> = [
    ['Dev - Saúde e bem-estar', 'Dev - Saúde e bem-estar'],
    ['Product Manager - Caregiving', 'Product Manager - Caregiving'],
    ['Desenvolvedora · Health and well-being', 'Desenvolvedora · Health and well-being'],
    ['Luto\nDesenvolvedora', 'Desenvolvedora'],
    ['Setor: Saúde e bem-estar\nDesenvolvedora', 'Desenvolvedora'],
  ];
  for (const [header, title] of kept) {
    test(`o emprego fica: ${JSON.stringify(header)}`, () => {
      const parsed = parse(profile([header, 'Empresa Fictícia Gama · Tempo integral', 'jan de 2022 - dez de 2023 · 2 anos', 'Sistemas em Java.'], JOB, OTHER_JOB));
      assert.equal(parsed.totalMonths, 72);
      assert.ok(parsed.experiences.some((experience) => experience.title === title), JSON.stringify(parsed.experiences.map((experience) => experience.title)));
    });
  }
});
