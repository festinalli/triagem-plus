// CA-07, a prova dos gêmeos (RF-57, P-5, RD-8): o que não conta não muda nada.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTerm } from '../../../src/core/guard/index.ts';
import { analyzeProfile } from '../../../src/core/match/analyze.ts';
import type { ProfileAnalysis } from '../../../src/core/match/analyze.ts';
import type { MatchResult, Requirement } from '../../../src/core/model.ts';
import {
  ABOUT_SENTENCES,
  BASE_PROFILE,
  CAREER_BREAK_LABELS,
  CAREER_BREAK_POSITIONS,
  OUTSIDE_VARIANTS,
  TWIN_AS_OF,
  TWIN_REQUIREMENTS,
  TWIN_URL,
  renderProfile,
  withAboutSentence,
  withCareerBreak,
  withSkillAdded,
} from '../../fixtures/twins/twins.ts';
import type { TwinProfile } from '../../fixtures/twins/twins.ts';
import { AS_OF, PROFILE_URL, free, listed, profileText, titleWord } from './helpers.ts';

function analyze(profile: TwinProfile): ProfileAnalysis {
  return analyzeProfile({ text: renderProfile(profile), url: TWIN_URL, requirements: TWIN_REQUIREMENTS, asOf: TWIN_AS_OF });
}

const base = analyze(BASE_PROFILE);

function assertTwin(variant: TwinProfile): void {
  assert.notEqual(renderProfile(variant), renderProfile(BASE_PROFILE), 'a variação não mudou o texto');
  const twin = analyze(variant);
  assert.deepEqual(twin.match, base.match);
  assert.deepEqual(twin.card, base.card);
  assert.deepEqual(twin.quality, base.quality);
  assert.equal(JSON.stringify(twin.card), JSON.stringify(base.card));
  assert.equal(JSON.stringify(twin.match), JSON.stringify(base.match));
}

describe('O perfil-base é uma prova que pode falhar', () => {
  test('resultado conferido à mão: nota 56, Parcial, com requisitos que um vazamento faria mudar', () => {
    // Pesos 3 × 8 + 1 × 6 = 30. Pontos: 3 × (0,8 + 1 + 1 + 0,5 + 0 + 0 + 5/6 + 1) + (0 + 1 + 0 + 0,5 + 0 + 0) = 16,9.
    assert.equal(base.match.score, 56);
    assert.equal(base.match.band, 'partial');
    assert.equal(base.match.requiredMet, 3);
    assert.equal(base.match.requiredTotal, 8);
    assert.deepEqual(
      Object.fromEntries(base.match.results.map((result) => [result.requirementId, result.status])),
      {
        java: 'partial',
        spring: 'met',
        go: 'met',
        python: 'partial',
        k8s: 'not_found',
        core: 'not_found',
        total: 'partial',
        senior: 'met',
        aws: 'not_found',
        ingles: 'met',
        alemao: 'not_found',
        kotlin: 'partial',
        cert: 'not_found',
        diretor: 'not_found',
      },
    );
    assert.equal(base.card.totalMonths, 120);
    assert.equal(base.quality.level, 'ok');
  });

  test('controle: mudar uma seção que conta muda a nota', () => {
    const changed = analyze(withSkillAdded('Kubernetes'));
    assert.equal(changed.match.score, 66);
    assert.notDeepEqual(changed.card, base.card);
  });

  test('controle: citar termo da vaga em Sobre muda a nota', () => {
    const changed = analyze(withAboutSentence('Estudo Kubernetes.'));
    assert.equal(changed.match.score, 61);
  });
});

describe('Grupo 1: só muda o que está fora das seções que contam', () => {
  test('há pelo menos 15 variações', () => {
    assert.ok(OUTSIDE_VARIANTS.length >= 15, `${OUTSIDE_VARIANTS.length} variações`);
  });

  for (const { name, profile } of OUTSIDE_VARIANTS) {
    test(name, () => assertTwin(profile));
  }
});

describe('Grupo 2: dado pessoal em Sobre, com vaga que não pede isso', () => {
  for (const [name, sentence] of ABOUT_SENTENCES) {
    test(name, () => assertTwin(withAboutSentence(sentence)));
  }

  test('todas as frases juntas', () => {
    assertTwin(withAboutSentence(ABOUT_SENTENCES.map(([, sentence]) => sentence).join(' ')));
  });
});

describe('A ordem das seções que contam também não muda nada', () => {
  test('Projetos primeiro e Experiência por último', () => {
    assertTwin({ ...BASE_PROFILE, sections: [...BASE_PROFILE.sections].reverse() });
  });
});

describe('Grupo 3: pausa na carreira dentro de Experiência (dado de saúde ou de família)', () => {
  for (const label of CAREER_BREAK_LABELS) {
    for (const [where, position] of Object.entries(CAREER_BREAK_POSITIONS)) {
      test(`${label}, ${where}`, () => assertTwin(withCareerBreak(label, position)));
    }
  }

  const spellings = ['LICENÇA-MATERNIDADE', 'licenca maternidade', 'licença médica', 'PAUSA NA CARREIRA', 'career break', 'SAUDE E BEM ESTAR', 'health and well being'];
  for (const label of spellings) {
    test(`grafia: ${label}`, () => assertTwin(withCareerBreak(label, 0)));
  }

  test('nada da entrada fica na ficha', () => {
    const { card } = analyze(withCareerBreak('Licença-maternidade', 0));
    assert.equal(card.currentTitle, 'Desenvolvedor(a) Sênior');
    assert.equal(card.totalMonths, 120);
    assert.doesNotMatch(JSON.stringify(card), /licen|matern|Kubernetes|família/iu);
  });
});

describe('Grupo 4: texto de fora da lista não gasta o limite do que conta', () => {
  const [header, ...sections] = renderProfile(BASE_PROFILE).split('\n\n');
  const rest = sections.join('\n\n');
  const filler = (size: number): string => 'A pessoa é ótima colega de trabalho e muito dedicada ao time.\n'.repeat(Math.ceil(size / 62));
  const assertLongTwin = (text: string): void => {
    const twin = analyzeProfile({ text, url: TWIN_URL, requirements: TWIN_REQUIREMENTS, asOf: TWIN_AS_OF });
    assert.deepEqual(twin.match, base.match);
    assert.deepEqual(twin.card, base.card);
    assert.deepEqual(twin.quality, base.quality);
  };

  test('recomendações de 105 mil caracteres antes de tudo: o caso que levava a nota de 56 a 0', () => {
    assertLongTwin(`${header}\n\nRecomendações\n${filler(105_000)}\n${rest}`);
  });

  test('formação de 900 mil caracteres no meio', () => {
    assertLongTwin(renderProfile(BASE_PROFILE).replace('2005 - 2009', `2005 - 2009\n${filler(900_000)}`));
  });

  test('cabeçalho de 900 mil caracteres', () => {
    assertLongTwin(`${header}\n${filler(900_000)}\n${rest}`);
  });

  test('1 milhão de caracteres não trava a análise', () => {
    const startedAt = performance.now();
    analyzeProfile({ text: `${header}\n\nRecomendações\n${filler(990_000)}\n${rest}`, url: TWIN_URL, requirements: TWIN_REQUIREMENTS, asOf: TWIN_AS_OF });
    const elapsed = performance.now() - startedAt;
    assert.ok(elapsed < 5000, `${elapsed.toFixed(0)} ms`);
  });
});

describe('Títulos que encerram trecho', () => {
  for (const title of ['Hobbies', 'Dados pessoais', 'Informações pessoais', 'Personal information', 'Personal details', 'Contato', 'Informações de contato', 'Contact info', 'Formação complementar']) {
    test(`${title}: o que vem depois não cai na seção anterior`, () => {
      assertTwin({ ...BASE_PROFILE, sections: BASE_PROFILE.sections.flatMap((section) => (section.title === 'Competências' ? [section, { title, lines: ['Idade: 30 anos', 'Kubernetes', 'AWS', 'Alemão', 'Rua Fictícia, 100'] }] : [section])) });
    });
  }

  test('"Recursos" na descrição não corta os cargos seguintes: o caso que levava a nota de 56 a 33', () => {
    assertTwin({
      ...BASE_PROFILE,
      sections: BASE_PROFILE.sections.map((section) => (section.title === 'Experiência'
        ? { ...section, lines: section.lines.map((line) => (line === 'Desenvolvimento de APIs de pagamento em Java.' ? `Recursos\n${line}` : line)) }
        : section)),
    });
  });
});

// Limites conhecidos. O leitor trabalha com texto e não tem como separar estes casos sem errar para o outro lado. Os testes
// fixam o que acontece hoje, para que qualquer mudança seja uma decisão, e não um acidente.
describe('Limites conhecidos: dado de fora da lista que ainda muda a nota', () => {
  const text = renderProfile(BASE_PROFILE);
  const run = (changed: string, requirements: readonly Requirement[] = TWIN_REQUIREMENTS) => analyzeProfile({ text: changed, url: TWIN_URL, requirements, asOf: TWIN_AS_OF });

  // Uma linha igual a um título é título, mesmo dentro de seção ignorada. Se a regra fosse "seção ignorada só termina em
  // outro título ignorado", tudo o que viesse depois se perderia. A pessoa teria de escrever só a palavra na linha.
  test('linha igual a título dentro de seção ignorada reabre a seção que conta', () => {
    const { card, match } = run(text.replace('2005 - 2009', '2005 - 2009\nCompetências\nKubernetes'));
    assert.deepEqual(card.terms.find((term) => term.key === 'Kubernetes')?.sections, ['skills']);
    assert.equal(match.score, 66);
  });

  // "Java, Indonésia" tem a mesma forma de "Java, Spring", e perder stack muda a nota de quem escreve assim. Só um lugar com
  // nome igual a termo da lista cai aqui.
  test('local com nome de termo da lista conta como termo', () => {
    const { card, match } = run(text.replace('Curitiba, Paraná · Presencial', 'Java, Indonésia'));
    assert.equal(card.terms.find((term) => term.key === 'Java')?.months, 120);
    assert.equal(match.score, 58);
  });

  // A trava recusa os assuntos de RF-13, e nome de faculdade não está entre eles. Se a pessoa pedir "USP" como termo livre, a nota
  // ainda acha o que estiver numa descrição de cargo. Sobre deixou de ser procurado (DP-25). É a vaga pedindo, não o texto entrando sozinho.
  test('termo livre que a trava não recusa acha o que está numa descrição', () => {
    assert.equal(checkTerm('USP').allowed, true);
    const requirements = [free('USP'), listed('Java')];
    assert.equal(run(text, requirements).match.score, 50);
    assert.equal(run(text.replace('Manutenção de sistemas legados.', 'Sistemas da USP.'), requirements).match.score, 100);
  });
});

describe('DP-25: termo livre não é procurado em Sobre', () => {
  const text = renderProfile(BASE_PROFILE);
  const run = (changed: string, requirements: readonly Requirement[]) => analyzeProfile({ text: changed, url: TWIN_URL, requirements, asOf: TWIN_AS_OF });

  for (const [word, sentence] of [['USP', 'Formada na USP em 1990.'], ['Campinas', 'Moro em Campinas.'], ['Unicamp', 'Estudei na Unicamp.']] as const) {
    test(`${word} em Sobre não muda nada`, () => {
      const requirements = [free(word), listed('Java')];
      const twin = run(text.replace('Gosto de código simples.', sentence), requirements);
      assert.deepEqual(twin.match, run(text, requirements).match);
      assert.deepEqual(twin.card, run(text, requirements).card);
    });
  }
});

describe('Títulos inexatos e UF não mudam nada (RF-40, RF-41, DP-06)', () => {
  test('títulos de fora da lista, escritos de outro jeito, e o que vem depois deles', () => {
    const titles: Readonly<Record<string, string>> = {
      'Formação acadêmica': 'FORMAÇÃO:',
      'Trabalho voluntário': 'Voluntariado:',
      Recomendações: 'Recomendações recebidas',
      Interesses: 'Hobbies e interesses',
      Causas: '• Causas que apoio',
    };
    assertTwin({ ...BASE_PROFILE, sections: BASE_PROFILE.sections.map((section) => ({ ...section, title: titles[section.title] ?? section.title })) });
  });

  for (const [title, lines] of [
    ['Formação:', ['Bacharelado em Kubernetes e AWS', '1980 - 2013', 'Competências: Kubernetes, AWS, Alemão']],
    ['Educação', ['Pós em core banking', 'jan de 1980 - dez de 2013 · 34 anos']],
    ['Voluntariado:', ['Diretor Sênior Voluntário', 'Igreja Imaginária', 'jan de 1980 - dez de 2013 · 34 anos', 'Kubernetes, AWS']],
    ['Volunteer work', ['Diretor Sênior', 'jan de 1980 - dez de 2013 · 34 anos', 'Kubernetes, AWS']],
    ['Idade', ['52 anos', 'Kubernetes']],
    ['Família', ['Mãe de dois', 'AWS']],
  ] as const) {
    test(`${title} logo depois de Experiência`, () => {
      assertTwin({
        ...BASE_PROFILE,
        sections: BASE_PROFILE.sections.flatMap((section) => (section.title === 'Experiência' ? [section, { title, lines }] : [section])),
      });
    });
  }

  test('cidade com sigla que é nome de termo', () => {
    assertTwin({
      ...BASE_PROFILE,
      sections: BASE_PROFILE.sections.map((section) => (section.title === 'Experiência'
        ? { ...section, lines: section.lines.map((line) => (line === 'Curitiba, Paraná · Presencial' ? 'Goiânia, GO' : line)) }
        : section)),
    });
  });

  test('sigla solta depois do período', () => {
    assertTwin({
      ...BASE_PROFILE,
      sections: BASE_PROFILE.sections.map((section) => (section.title === 'Experiência'
        ? { ...section, lines: section.lines.map((line) => (line === 'Curitiba, Paraná · Presencial' ? 'GO' : line)) }
        : section)),
    });
  });
});

describe('RD-8: o gênero da palavra de cargo não muda a nota', () => {
  const requirements: readonly Requirement[] = [
    titleWord('Pleno'),
    titleWord('Engenheiro'),
    titleWord('Engenheira', 'preferred'),
    free('Engenheiro de plataforma'),
    free('líder técnica', 'preferred'),
    listed('Engenheiro DevOps'),
    listed('Estagiário de software'),
    listed('Tech Lead', 'preferred'),
    listed('Documentação técnica', 'preferred'),
  ];

  const profileIn = (words: { engineer: string; level: string; intern: string; technical: string }): string =>
    profileText({
      Experiência: [
        `${words.engineer} de DevOps ${words.level}`,
        'Empresa Fictícia Alfa · Tempo integral',
        'jan de 2020 - dez de 2023 · 4 anos',
        `Atuei como ${words.engineer.toLowerCase()} de plataforma, e fui líder ${words.technical}.`,
        'Escrevi documentação técnica.',
        words.intern,
        'Empresa Fictícia Beta · Tempo integral',
        'jan de 2019 - dez de 2019 · 1 ano',
        'Apoio ao time.',
      ],
      Competências: ['Docker'],
    });

  const scoreParts = (match: MatchResult) => ({
    score: match.score,
    band: match.band,
    requiredMet: match.requiredMet,
    requiredTotal: match.requiredTotal,
    results: match.results.map((result) => ({
      id: result.requirementId,
      status: result.status,
      credit: result.credit,
      note: result.note,
      sections: result.evidence.map((evidence) => evidence.section),
      months: result.evidence.map((evidence) => evidence.months),
    })),
  });

  test('feminino e masculino dão o mesmo resultado, e tudo é encontrado', () => {
    const run = (text: string) => analyzeProfile({ text, url: PROFILE_URL, requirements, asOf: AS_OF });
    const feminine = run(profileIn({ engineer: 'Engenheira', level: 'Plena', intern: 'Estagiária de software', technical: 'técnica' }));
    const masculine = run(profileIn({ engineer: 'Engenheiro', level: 'Pleno', intern: 'Estagiário de software', technical: 'técnico' }));
    assert.deepEqual(scoreParts(feminine.match), scoreParts(masculine.match));
    assert.equal(feminine.match.score, 100);
  });

  test('a ficha guarda o rótulo neutro da lista, e fica igual nos dois gêneros', () => {
    const cardIn = (text: string) => analyzeProfile({ text, url: PROFILE_URL, requirements, asOf: AS_OF }).card;
    const feminine = cardIn(profileIn({ engineer: 'Engenheira', level: 'Plena', intern: 'Estagiária de software', technical: 'técnica' }));
    const masculine = cardIn(profileIn({ engineer: 'Engenheiro', level: 'Pleno', intern: 'Estagiário de software', technical: 'técnico' }));
    assert.equal(feminine.currentTitle, 'Engenheiro(a) DevOps Pleno');
    assert.deepEqual(feminine, masculine);
  });
});
