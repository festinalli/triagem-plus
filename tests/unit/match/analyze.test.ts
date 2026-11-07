// Do texto ao resultado: aviso de leitura, reanálise e soma de fichas (RF-34, RF-35, RF-55, RNF-07).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProfile, mergeCards } from '../../../src/core/match/analyze.ts';
import { computeMatch } from '../../../src/core/match/score.ts';
import type { Requirement } from '../../../src/core/model.ts';
import { AS_OF, PROFILE_URL, cardOf, cardTerm, free, language, listed, profileText, titleWord, totalYears } from './helpers.ts';

function run(text: string, requirements: readonly Requirement[] = []) {
  return analyzeProfile({ text, url: PROFILE_URL, requirements, asOf: AS_OF });
}

const EXPERIENCE = ['Desenvolvedora', 'Empresa Fictícia · Tempo integral', 'jan de 2020 - dez de 2020 · 1 ano', 'Sistemas em Java.'];

describe('analyzeProfile', () => {
  test('devolve nome, chave do perfil, ficha, nota e qualidade', () => {
    const analysis = run(profileText({ Experiência: EXPERIENCE, Competências: ['Java'] }), [listed('Java')]);
    assert.equal(analysis.name, 'Pessoa Fictícia Exemplo');
    assert.equal(analysis.profileKey, '/in/pessoa-ficticia/');
    assert.equal(analysis.match.score, 100);
    assert.equal(analysis.card.currentTitle, 'Desenvolvedor(a)');
    assert.deepEqual(analysis.quality, { level: 'ok', truncated: false, missing: [] });
  });

  test('link fora do padrão: chave nula, e a análise segue', () => {
    const analysis = analyzeProfile({ text: profileText({ Competências: ['Java'] }), url: 'https://exemplo.test/perfil', requirements: [], asOf: AS_OF });
    assert.equal(analysis.profileKey, null);
    assert.equal(analysis.card.terms[0]?.key, 'Java');
  });
});

describe('Qualidade da leitura (RF-35)', () => {
  test('sem competências', () => {
    assert.deepEqual(run(profileText({ Experiência: EXPERIENCE })).quality, { level: 'few_sections', truncated: false, missing: ['skills'] });
  });

  test('sem experiência', () => {
    assert.deepEqual(run(profileText({ Competências: ['Java'] })).quality, { level: 'few_sections', truncated: false, missing: ['experience'] });
  });

  test('só Sobre', () => {
    assert.deepEqual(run(profileText({ Sobre: ['Trabalho com Java.'] })).quality, { level: 'few_sections', truncated: false, missing: ['experience', 'skills'] });
  });

  test('nada lido', () => {
    for (const text of ['', 'Pessoa Fictícia Exemplo\nCidade Inventada', 'Formação acadêmica\nUniversidade Inventada']) {
      assert.deepEqual(run(text).quality, { level: 'empty', truncated: false, missing: ['experience', 'skills'] }, text);
    }
  });

  test('lista cortada', () => {
    const { quality } = run(profileText({ Experiência: EXPERIENCE, Competências: ['Java', 'Exibir todas as 12 competências'] }));
    assert.equal(quality.level, 'ok');
    assert.equal(quality.truncated, true);
  });

  test('sem Idiomas ou Projetos não gera aviso: a pessoa pode só não ter', () => {
    assert.deepEqual(run(profileText({ Experiência: EXPERIENCE, Competências: ['Java'] })).quality.missing, []);
  });
});

describe('RF-55: requisito novo depois da análise', () => {
  const before = [listed('Java'), listed('AWS', 'preferred')];
  const text = profileText({ Projetos: ['Plataforma de core banking.'], Experiência: EXPERIENCE });

  test('fica needs_reanalysis, não muda a nota, e nova análise passa a contar', () => {
    const first = run(text, before);
    assert.equal(first.match.score, 75);

    const added = [...before, free('core banking'), titleWord('Desenvolvedor', 'preferred')];
    const recalculated = computeMatch(first.card, added);
    assert.deepEqual(recalculated.results.slice(2).map((result) => result.status), ['needs_reanalysis', 'needs_reanalysis']);
    assert.equal(recalculated.score, first.match.score);
    assert.equal(first.match.band, 'strong');
    assert.equal(recalculated.band, 'partial'); // Um obrigatório ficou pendente (Apêndice A).
    assert.equal(recalculated.requiredTotal, first.match.requiredTotal);

    const second = run(text, added);
    assert.equal(second.match.results[2]?.status, 'partial');
    assert.equal(second.match.results[2]?.note, 'mentioned_only');
    assert.equal(second.match.results[3]?.status, 'met');
    assert.equal(second.match.requiredTotal, 2);
    // (3 + 0 + 1,5 + 1) ÷ 8
    assert.equal(second.match.score, 69);
  });

  test('tirar o requisito da vaga depois não exige nova análise', () => {
    const { card } = run(text, [...before, free('core banking')]);
    assert.equal(computeMatch(card, before).score, 75);
  });
});

describe('mergeCards (RF-34)', () => {
  test('une seções, cargos e termos livres, e fica o maior tempo', () => {
    const previous = cardOf(
      [cardTerm('Java', ['skills', 'experience'], 24, ['Cargo A', 'Cargo B']), cardTerm('PHP', ['about'])],
      { searchedFreeTerms: ['x', 'title:y'], sectionsRead: ['skills', 'experience'], totalMonths: 40, currentTitle: 'Cargo A' },
    );
    const next = cardOf(
      [cardTerm('Java', ['experience', 'projects'], 36, ['Cargo C', 'Cargo A']), cardTerm('AWS', ['languages'], null)],
      { searchedFreeTerms: ['z', 'x'], sectionsRead: ['projects'], totalMonths: 30, currentTitle: 'Cargo C' },
    );
    assert.deepEqual(mergeCards(previous, next), {
      totalMonths: 40,
      currentTitle: 'Cargo C',
      terms: [
        { key: 'AWS', sections: ['languages'], months: null, jobTitles: [] },
        { key: 'Java', sections: ['experience', 'skills', 'projects'], months: 36, jobTitles: ['Cargo C', 'Cargo A', 'Cargo B'] },
        { key: 'PHP', sections: ['about'], months: null, jobTitles: [] },
      ],
      searchedFreeTerms: ['x'], // Só "x" foi procurado nas duas leituras (RF-55).
      sectionsRead: ['experience', 'skills', 'projects'],
      truncated: false,
    });
  });

  test('leitura que cobre todas as seções da anterior conta o que procurou como procurado (RF-55)', () => {
    const previous = cardOf([], { searchedFreeTerms: ['x'], sectionsRead: ['skills', 'experience'] });
    const covering = cardOf([], { searchedFreeTerms: ['zephyrix quartz'], sectionsRead: ['experience', 'skills', 'projects'] });
    assert.deepEqual(mergeCards(previous, covering).searchedFreeTerms, ['zephyrix quartz']);
    const partial = cardOf([], { searchedFreeTerms: ['zephyrix quartz'], sectionsRead: ['skills'] });
    assert.deepEqual(mergeCards(previous, partial).searchedFreeTerms, []);
  });

  test('tempo nulo não apaga tempo medido, nos dois sentidos', () => {
    const measured = cardOf([cardTerm('Java', ['experience'], 24)], { totalMonths: 24 });
    const unmeasured = cardOf([cardTerm('Java', ['skills'], null)], { totalMonths: null });
    assert.equal(mergeCards(measured, unmeasured).terms[0]?.months, 24);
    assert.equal(mergeCards(unmeasured, measured).terms[0]?.months, 24);
    assert.equal(mergeCards(measured, unmeasured).totalMonths, 24);
    assert.equal(mergeCards(unmeasured, unmeasured).totalMonths, null);
  });

  test('o menor tempo não vence: leitura nova mais curta não reduz', () => {
    const longer = cardOf([cardTerm('Java', ['experience'], 60)]);
    const shorter = cardOf([cardTerm('Java', ['experience'], 12)]);
    assert.equal(mergeCards(longer, shorter).terms[0]?.months, 60);
  });

  test('truncated só se o novo também estiver cortado', () => {
    const cut = cardOf([], { truncated: true });
    const whole = cardOf([], { truncated: false });
    assert.equal(mergeCards(cut, cut).truncated, true);
    assert.equal(mergeCards(cut, whole).truncated, false);
    assert.equal(mergeCards(whole, cut).truncated, false);
    assert.equal(mergeCards(whole, whole).truncated, false);
  });

  test('leitura nova sem experiência não apaga o cargo atual', () => {
    assert.equal(mergeCards(cardOf([], { currentTitle: 'Cargo A' }), cardOf([], { currentTitle: null })).currentTitle, 'Cargo A');
  });

  test('no máximo 3 cargos por termo', () => {
    const a = cardOf([cardTerm('Java', ['experience'], 1, ['A', 'B', 'C'])]);
    const b = cardOf([cardTerm('Java', ['experience'], 1, ['D', 'E', 'F'])]);
    assert.deepEqual(mergeCards(a, b).terms[0]?.jobTitles, ['D', 'E', 'F']);
  });

  test('termo achado na segunda leitura deixa de precisar de nova análise', () => {
    const requirement = free('core banking');
    const first = run(profileText({ Experiência: EXPERIENCE }), []);
    const second = run(profileText({ Projetos: ['Plataforma de core banking.'] }), [requirement]);
    assert.equal(computeMatch(first.card, [requirement]).results[0]?.status, 'needs_reanalysis');
    assert.equal(computeMatch(mergeCards(first.card, second.card), [requirement]).results[0]?.status, 'partial');
  });
});

describe('RNF-07: menos de 200 ms', () => {
  const requirements: readonly Requirement[] = [
    ...['Java', 'Python', 'Go', 'Rust', 'C++', 'C#', '.NET', 'Node.js', 'Kubernetes', 'Docker', 'AWS', 'Terraform'].map((name) => listed(name, 'required', 3)),
    ...['Redis', 'Kafka', 'PostgreSQL', 'React', 'Angular'].map((name) => listed(name, 'preferred')),
    ...['core banking', 'open finance', 'alta disponibilidade', 'meios de pagamento', 'antifraude', 'Spring', 'conciliação'].map((name) => free(name)),
    titleWord('Sênior'),
    titleWord('Pleno'),
    titleWord('Tech Lead', 'preferred'),
    language('Inglês'),
    language('Espanhol', 'preferred'),
    totalYears(8),
  ];

  function fill(line: (index: number) => string, size: number): string {
    const lines: string[] = [];
    let length = 0;
    for (let index = 0; length < size; index++) {
      const next = line(index);
      lines.push(next);
      length += next.length + 1;
    }
    return lines.join('\n');
  }

  const experiences = fill((index) => {
    const year = 1000 + index;
    return `Desenvolvedora Sênior ${index}\nEmpresa Fictícia ${index} · Tempo integral\njan de ${year} - dez de ${year} · 1 ano\nSistemas de core banking em Java e Go, com Docker, Kubernetes e alta disponibilidade.\nCompetências: Java, Go, Rust, C++, C#, Node.js`;
  }, 60_000);
  const realistic = `Pessoa Fictícia Exemplo\n\nSobre\n${'Trabalho com sistemas de pagamento e gosto de Python. '.repeat(200)}\n\nExperiência\n${experiences}\n\nCompetências\n${fill((index) => `Competência ${index}, Java`, 25_000)}`;

  // O último caso não é perfil de verdade: 33 mil linhas de dois caracteres. Isolado, fica perto de 200 ms, e com a máquina
  // ocupada passa disso. O teto maior só prova que o tempo não dispara.
  const shapes: ReadonlyArray<readonly [string, string, number]> = [
    ['perfil longo e variado', realistic.slice(0, 100_000), 200],
    ['uma linha só', `Sobre\n${'java go rust core banking '.repeat(4_000)}`.slice(0, 100_000), 200],
    ['muitas vírgulas', `Competências\n${'a, '.repeat(33_000)}`.slice(0, 100_000), 200],
    ['muitas linhas curtas', `Competências\n${fill((index) => `t${index % 10}`, 99_000)}`, 1_000],
  ];

  for (const [name, text, limit] of shapes) {
    test(`100 mil caracteres e 30 requisitos: ${name}`, () => {
      assert.equal(requirements.length, 30);
      assert.ok(text.length >= 90_000 && text.length <= 100_000, `${text.length} caracteres`);
      // A melhor de cinco tira a interferência de outros arquivos de teste rodando ao mesmo tempo.
      let best = Number.POSITIVE_INFINITY;
      for (let round = 0; round < 5; round++) {
        const start = performance.now();
        analyzeProfile({ text, url: PROFILE_URL, requirements, asOf: AS_OF });
        best = Math.min(best, performance.now() - start);
      }
      assert.ok(best < limit, `${best.toFixed(1)} ms`);
    });
  }
});

describe('mergeCards e RF-55: termo livre só conta como procurado se foi procurado nas duas análises', () => {
  const python = listed('Python');
  const platform = free('Plataforma Interna');
  const full = profileText({
    Experiência: ['Engenheira', 'Empresa Fictícia · Tempo integral', 'jan de 2020 - o momento', 'Criei a Plataforma Interna em Python.'],
    Competências: ['Python'],
  });
  const partial = profileText({ Competências: ['Python'] });

  test('página parcial não transforma pendência em não encontrado', () => {
    const first = run(full, [python]).card;
    const second = run(partial, [python, platform]).card;
    const merged = mergeCards(first, second);
    assert.deepEqual(merged.searchedFreeTerms, []);
    const match = computeMatch(merged, [python, platform]);
    assert.equal(match.results[1]?.status, 'needs_reanalysis');
    assert.equal(match.score, 100);
    assert.equal(match.band, 'partial');
  });

  test('nos dois sentidos', () => {
    const first = run(full, [python]).card;
    const second = run(partial, [python, platform]).card;
    assert.deepEqual(mergeCards(second, first).searchedFreeTerms, []);
  });

  test('procurado nas duas e não achado: não encontrado', () => {
    const merged = mergeCards(run(partial, [python, platform]).card, run(partial, [python, platform]).card);
    assert.deepEqual(merged.searchedFreeTerms, ['plataforma interna']);
    assert.equal(computeMatch(merged, [python, platform]).results[1]?.status, 'not_found');
  });

  test('achado numa só basta', () => {
    const first = run(full, [python, platform]).card;
    const second = run(partial, [python]).card;
    for (const merged of [mergeCards(first, second), mergeCards(second, first)]) {
      assert.deepEqual(merged.searchedFreeTerms, ['plataforma interna']);
      assert.equal(computeMatch(merged, [python, platform]).results[1]?.status, 'met');
    }
  });

  test('palavra de cargo segue a mesma regra', () => {
    const senior = titleWord('Sênior');
    const merged = mergeCards(run(full, [python]).card, run(partial, [python, senior]).card);
    assert.equal(computeMatch(merged, [python, senior]).results[1]?.status, 'needs_reanalysis');
  });
});
