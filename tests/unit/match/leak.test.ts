// A ficha não vaza (RF-42, RF-44, RF-45, seção 9): palavras-sentinela em cada lugar de texto livre não chegam a ela.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProfile, mergeCards } from '../../../src/core/match/analyze.ts';
import type { Requirement } from '../../../src/core/model.ts';
import { AS_OF, PROFILE_URL, free, listed, titleWord, totalYears } from './helpers.ts';

const REQUIREMENTS: readonly Requirement[] = [
  listed('Java', 'required', 2),
  listed('Python', 'preferred'),
  listed('Inglês', 'preferred'),
  free('core banking'),
  free('Spring'),
  titleWord('Sênior'),
  totalYears(3),
];

const HEADER = [
  'Sentinelanome Fictícia',
  'Sentinelapronome',
  'Sentinelacabecalho na Empresa',
  'Sentinelacidade, Sentinelaestado, Brasil · Informações de contato',
  '1.234 sentinelaseguidores',
];

const OTHER_SECTIONS = [
  'Sobre',
  'Sentinelasobre: estudo Python, mas sentinelaidade e sentinelareligiao ficam em mim.',
  '',
  'Formação acadêmica',
  'Sentinelafaculdade',
  'Bacharelado em Sentinelacurso',
  '2005 - 2009',
  '',
  'Trabalho voluntário',
  'Sentinelavoluntario',
  '',
  'Competências',
  'Spring',
  'Sentinelacompetencia',
  '',
  'Licenças e certificados',
  'Sentinelacertificado',
  'Sentinelaemissor',
  '',
  'Idiomas',
  'Inglês',
  'Sentinelanivel',
  '',
  'Projetos',
  'Sentinelaprojeto em Python',
  '',
  'Recomendações',
  'Sentinelarecomendacao',
];

const FORMATS: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    'um cargo, com tipo de contrato',
    [
      'Desenvolvedora Sênior',
      'Sentinelaempresa · Tempo integral',
      'jan de 2020 - dez de 2023 · 4 anos',
      'Sentinelalocal, Brasil · Remota',
      'Sentineladescricao de sistemas em Java.',
    ],
  ],
  [
    'vários cargos na mesma empresa',
    [
      'Sentinelaempresa',
      'Tempo integral · 5 anos',
      'Desenvolvedora Sênior',
      'jan de 2021 - dez de 2023 · 3 anos',
      'Sentinelalocal, Brasil · Híbrida',
      'Sentineladescricao de sistemas em Java.',
      'Desenvolvedora Plena',
      'jan de 2019 - dez de 2020 · 2 anos',
      'Sentinelalocal, Brasil',
      'Sentineladescricao de legados em Java.',
    ],
  ],
  [
    'cargo e empresa sem tipo de contrato',
    [
      'Desenvolvedora Sênior',
      'Sentinelaempresa',
      'jan de 2020 - dez de 2023 · 4 anos',
      'Sentineladescricao de sistemas em Java.',
    ],
  ],
  [
    'empresa com contrato logo depois de outra empresa',
    [
      'Desenvolvedora Sênior',
      'Sentinelaempresa · Tempo integral',
      'jan de 2020 - dez de 2023 · 4 anos',
      'Sentineladescricao de sistemas em Java.',
      'Desenvolvedora Plena',
      'Sentinelaempresa · Meio período',
      'jan de 2018 - dez de 2019 · 2 anos',
      'Sentineladescricao de legados em Java.',
    ],
  ],
  [
    'em inglês',
    [
      'Senior Developer',
      'Sentinelaempresa · Full-time',
      'Jan 2020 - Dec 2023 · 4 yrs',
      'Sentinelalocal, Brazil · Remote',
      'Sentineladescricao of systems in Java.',
    ],
  ],
];

function textFor(experience: readonly string[]): string {
  return [...HEADER, '', 'Experiência', ...experience, '', ...OTHER_SECTIONS].join('\n');
}

function assertNoSentinel(experience: readonly string[]): void {
  const text = textFor(experience);
  const { card, match } = analyzeProfile({ text, url: PROFILE_URL, requirements: REQUIREMENTS, asOf: AS_OF });
  for (const [what, json] of [['ficha', JSON.stringify(card)], ['resultado', JSON.stringify(match)]] as const) {
    assert.ok(!/sentinela/iu.test(json), `palavra-sentinela na ${what}: ${json}`);
  }
}

describe('Nenhuma palavra-sentinela chega à ficha nem ao resultado', () => {
  for (const [name, experience] of FORMATS) {
    test(name, () => {
      assertNoSentinel(experience);
      // E a leitura aconteceu de verdade: uma ficha vazia passaria sem provar nada.
      const { card } = analyzeProfile({ text: textFor(experience), url: PROFILE_URL, requirements: REQUIREMENTS, asOf: AS_OF });
      assert.ok(card.terms.some((term) => term.key === 'Java' && term.sections.includes('experience') && term.months !== null));
      assert.ok(card.sectionsRead.includes('about'));
      assert.ok(card.sectionsRead.includes('skills'));
    });
  }

  test('o cargo é permitido e aparece', () => {
    const { card } = analyzeProfile({ text: textFor(FORMATS[0]?.[1] ?? []), url: PROFILE_URL, requirements: REQUIREMENTS, asOf: AS_OF });
    assert.equal(card.currentTitle, 'Desenvolvedor(a) Sênior');
    assert.deepEqual(card.terms.find((term) => term.key === 'title:senior')?.jobTitles, ['Desenvolvedor(a) Sênior']);
  });

  test('a ficha só tem os campos da seção 9', () => {
    const { card } = analyzeProfile({ text: textFor(FORMATS[0]?.[1] ?? []), url: PROFILE_URL, requirements: REQUIREMENTS, asOf: AS_OF });
    assert.deepEqual(Object.keys(card).sort(), ['currentTitle', 'searchedFreeTerms', 'sectionsRead', 'terms', 'totalMonths', 'truncated']);
    for (const term of card.terms) assert.deepEqual(Object.keys(term).sort(), ['jobTitles', 'key', 'months', 'sections']);
  });

  test('as chaves vêm da lista de termos ou da vaga, nunca do perfil', () => {
    const { card } = analyzeProfile({ text: textFor(FORMATS[0]?.[1] ?? []), url: PROFILE_URL, requirements: REQUIREMENTS, asOf: AS_OF });
    assert.deepEqual(card.searchedFreeTerms, ['core banking', 'spring', 'title:senior']);
    assert.deepEqual(card.terms.map((term) => term.key), ['Desenvolvedor de software', 'Inglês', 'Java', 'Python', 'Spring', 'Sênior', 'spring', 'title:senior']);
  });
});

describe('A empresa não vira cargo (RF-42, DP-23)', () => {
  test('cargo único sem tipo de contrato, logo depois de um grupo de cargos', () => {
    const experience = [
      'Empresa Fictícia Alfa',
      'Tempo integral · 5 anos',
      'Desenvolvedora Sênior',
      'jan de 2021 - dez de 2023 · 3 anos',
      'Sistemas em Java.',
      'Desenvolvedora Plena',
      'Sentinelaempresa',
      'jan de 2018 - dez de 2020 · 3 anos',
      'Legados em Java.',
    ];
    assertNoSentinel(experience);
    const { card } = analyzeProfile({ text: textFor(experience), url: PROFILE_URL, requirements: REQUIREMENTS, asOf: AS_OF });
    assert.deepEqual(card.terms.find((term) => term.key === 'Java')?.jobTitles, ['Desenvolvedor(a) Sênior', 'Desenvolvedor(a) Pleno']);
    assert.equal(card.totalMonths, 72);
  });

  test('só empresa e período, sem linha de cargo', () => {
    const experience = ['Sentinelaempresa', 'jan de 2020 - dez de 2023 · 4 anos', 'Sistemas em Java.'];
    assertNoSentinel(experience);
    const { card } = analyzeProfile({ text: textFor(experience), url: PROFILE_URL, requirements: REQUIREMENTS, asOf: AS_OF });
    assert.equal(card.currentTitle, null);
    assert.equal(card.terms.find((term) => term.key === 'Java')?.months, 48);
  });

  // Todas as formas que a revisão achou. Em nenhuma sobra palavra de fora da lista, e o cargo é lido sempre que está lá.
  const shapes: ReadonlyArray<readonly [string, readonly string[], string | null]> = [
    ['cargo - empresa', ['Engenheira de Software - Sentinelaempresa', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['cargo at empresa', ['Engenheira de Software at Sentinelaempresa', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['cargo @ empresa', ['Engenheira de Software @ Sentinelaempresa', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['cargo na empresa', ['Engenheira de Software na Sentinelaempresa', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['cargo, empresa', ['Engenheira de Software, Sentinelaempresa', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['cargo | empresa', ['Engenheira de Software | Sentinelaempresa', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['empresa em cima, cargo', ['Sentinelaempresa', 'Engenheira de Software', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['local acima do período, fora da lista', ['Engenheira de Software', 'Sentinelaempresa · Tempo integral', 'Austin, Texas', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['grupo com cidade solta', ['Sentinelaempresa', '5 anos', 'Sentinelacidade', 'Engenheira de Software', 'Tempo integral', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['grupo com região', ['Sentinelaempresa', '5 anos', 'Região de Sentinelalocal', 'Engenheira de Software', 'Tempo integral', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['frase pessoal antes do próximo cargo', ['Desenvolvedora', 'jan de 2018 - dez de 2019', 'Sentinela mãe de dois e casada', 'Engenheira de Software', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['pessoal entre parênteses no cargo', ['Engenheira de Software (PCD, Sentinelapessoal)', 'Acme · Tempo integral', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['selo no cargo', ['Engenheira de Software · Sentinelalocal · Remoto', 'jan de 2020 - o momento', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['empresa com ponto do meio, sem cargo', ['Sentinelaempresa · Sentinelalocal', 'jan de 2020 - o momento', 'Competências: Python'], null],
    ['sem período, frase pessoal', ['Tenho 38 anos, sou casada Sentinelapessoal', 'Python no dia a dia.'], null],
    ['sem período, frase com empresa', ['Trabalhei na Sentinelaempresa usando Python', '', 'Moro em Sentinelalocal, tenho 38 anos e dois filhos', 'Python'], null],
    ['tudo numa linha', ['Engenheira de Software | Sentinelaempresa | Sentinelalocal | 2020 - 2022', 'Competências: Python'], 'Engenheiro(a) de software'],
    ['período entre parênteses, junto da empresa', ['Sentinelaempresa (jan 2020 - dez 2022)', 'Engenheira de Software', 'Competências: Python'], 'Engenheiro(a) de software'],
  ];
  for (const [name, experience, title] of shapes) {
    test(name, () => {
      assertNoSentinel(experience);
      const { card } = analyzeProfile({ text: textFor(experience), url: PROFILE_URL, requirements: REQUIREMENTS, asOf: AS_OF });
      assert.equal(card.currentTitle, title);
    });
  }

  test('nenhuma frase pessoal chega ao cargo atual', () => {
    for (const line of ['Tenho 38 anos, sou casada', 'Mãe de dois, moro em Campinas', 'Sou católica e tenho deficiência auditiva']) {
      const { card } = analyzeProfile({ text: `Ana Souza\nExperiência\n${line}\nPython no dia a dia.\n`, url: PROFILE_URL, requirements: [], asOf: AS_OF });
      assert.equal(card.currentTitle, null, line);
      assert.doesNotMatch(JSON.stringify(card), /38|casada|Campinas|católica/u, line);
    }
  });
});

describe('RF-44 na soma de fichas', () => {
  test('o que a primeira leitura leu pela lista continua vindo só da lista', () => {
    const one = analyzeProfile({ text: `Ana\nExperiência\nEngenheira de Dados - Sentinelaempresa\nAcme · Tempo integral\njan de 2020 - o momento\n`, url: PROFILE_URL, requirements: [], asOf: AS_OF });
    const other = analyzeProfile({ text: 'Ana\nCompetências\nPython\n', url: PROFILE_URL, requirements: [], asOf: AS_OF });
    const merged = mergeCards(one.card, other.card);
    assert.equal(merged.currentTitle, 'Engenheiro(a) de dados');
    assert.doesNotMatch(JSON.stringify(merged), /sentinela/iu);
  });
});
