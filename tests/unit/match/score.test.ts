// A conta da nota, linha a linha do Apêndice A (CA-08, RF-50 a RF-55).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProfile } from '../../../src/core/match/analyze.ts';
import { computeMatch, isScored } from '../../../src/core/match/score.ts';
import type { RequirementResult } from '../../../src/core/model.ts';
import { AS_OF, PROFILE_URL, cardOf, cardTerm, free, language, listed, profileText, titleWord, totalYears } from './helpers.ts';

function only(results: readonly RequirementResult[]): RequirementResult {
  const [first] = results;
  assert.ok(first !== undefined && results.length === 1);
  return first;
}

describe('CA-08: o exemplo do Apêndice A', () => {
  const requirements = [listed('Java', 'required', 5), free('Spring'), listed('AWS', 'preferred'), language('Inglês', 'preferred')];

  test('pela ficha: nota 80, faixa Parcial, crédito a crédito', () => {
    const card = cardOf(
      [cardTerm('Java', ['experience'], 48, ['Desenvolvedora']), cardTerm('spring', ['skills']), cardTerm('Inglês', ['languages'])],
      { searchedFreeTerms: ['spring'], totalMonths: 48 },
    );
    const match = computeMatch(card, requirements);
    assert.equal(match.score, 80);
    assert.equal(match.band, 'partial');
    assert.deepEqual(match.results.map((result) => result.credit), [0.8, 1, 0, 1]);
    assert.deepEqual(match.results.map((result) => result.status), ['partial', 'met', 'not_found', 'met']);
    assert.equal(match.requiredMet, 1);
    assert.equal(match.requiredTotal, 2);
  });

  test('pelo texto: o mesmo resultado, passando pelo leitor', () => {
    const { match } = analyzeProfile({
      text: profileText({
        Experiência: [
          'Desenvolvedora',
          'Empresa Fictícia Alfa · Tempo integral',
          'jan de 2018 - dez de 2019 · 2 anos',
          'APIs de pagamento em Java.',
          'Analista',
          'Empresa Fictícia Beta · Tempo integral',
          'jan de 2021 - dez de 2022 · 2 anos',
          'Manutenção de sistemas em Java.',
        ],
        Competências: ['Spring'],
        Idiomas: ['Inglês', 'Avançado'],
      }),
      url: PROFILE_URL,
      requirements,
      asOf: AS_OF,
    });
    assert.equal(match.score, 80);
    assert.equal(match.band, 'partial');
    assert.deepEqual(match.results.map((result) => result.credit), [0.8, 1, 0, 1]);
  });
});

describe('Apêndice A: uma linha da tabela de crédito por teste', () => {
  for (const section of ['experience', 'skills', 'certifications', 'languages'] as const) {
    test(`termo em ${section}: crédito 1`, () => {
      const result = only(computeMatch(cardOf([cardTerm('Java', [section])]), [listed('Java')]).results);
      assert.equal(result.credit, 1);
      assert.equal(result.status, 'met');
      assert.equal(result.note, undefined);
    });
  }

  for (const section of ['about', 'projects'] as const) {
    test(`termo só em ${section}: crédito 0,5, citado sem prova de uso`, () => {
      const result = only(computeMatch(cardOf([cardTerm('Java', [section])]), [listed('Java')]).results);
      assert.equal(result.credit, 0.5);
      assert.equal(result.status, 'partial');
      assert.equal(result.note, 'mentioned_only');
    });
  }

  test('em Sobre e em Competências ao mesmo tempo: vale a prova, crédito 1', () => {
    const result = only(computeMatch(cardOf([cardTerm('Java', ['about', 'skills'])]), [listed('Java')]).results);
    assert.equal(result.credit, 1);
    assert.equal(result.note, undefined);
  });

  test('termo não encontrado: crédito 0', () => {
    const result = only(computeMatch(cardOf([]), [listed('Java')]).results);
    assert.equal(result.credit, 0);
    assert.equal(result.status, 'not_found');
    assert.deepEqual(result.evidence, []);
  });

  test('termo com anos mínimos: A ÷ N', () => {
    const result = only(computeMatch(cardOf([cardTerm('Java', ['experience'], 30)]), [listed('Java', 'required', 5)]).results);
    assert.equal(result.credit, 0.5);
    assert.equal(result.status, 'partial');
    assert.equal(result.note, undefined);
  });

  test('termo com anos mínimos: no máximo 1', () => {
    const result = only(computeMatch(cardOf([cardTerm('Java', ['experience'], 120)]), [listed('Java', 'required', 5)]).results);
    assert.equal(result.credit, 1);
    assert.equal(result.status, 'met');
  });

  test('termo com anos mínimos, exatamente N anos: crédito 1', () => {
    const result = only(computeMatch(cardOf([cardTerm('Java', ['experience'], 30)]), [listed('Java', 'required', 2.5)]).results);
    assert.equal(result.credit, 1);
  });

  test('termo com anos mínimos, encontrado, sem tempo medível: 0,5 e o aviso', () => {
    const result = only(computeMatch(cardOf([cardTerm('Java', ['skills'], null)]), [listed('Java', 'required', 5)]).results);
    assert.equal(result.credit, 0.5);
    assert.equal(result.status, 'partial');
    assert.equal(result.note, 'time_not_measurable');
  });

  test('termo com anos mínimos, não encontrado: crédito 0', () => {
    const result = only(computeMatch(cardOf([]), [listed('Java', 'required', 5)]).results);
    assert.equal(result.credit, 0);
    assert.equal(result.note, undefined);
  });

  test('experiência total mínima: A ÷ N', () => {
    const result = only(computeMatch(cardOf([], { totalMonths: 36 }), [totalYears(6)]).results);
    assert.equal(result.credit, 0.5);
    assert.equal(result.status, 'partial');
  });

  test('experiência total mínima: no máximo 1', () => {
    const result = only(computeMatch(cardOf([], { totalMonths: 240 }), [totalYears(6)]).results);
    assert.equal(result.credit, 1);
    assert.equal(result.status, 'met');
  });

  test('experiência total sem datas legíveis: crédito 0 e confira no perfil', () => {
    const result = only(computeMatch(cardOf([], { totalMonths: null }), [totalYears(6)]).results);
    assert.equal(result.credit, 0);
    assert.equal(result.status, 'not_found');
    assert.equal(result.note, 'check_profile');
  });
});

describe('Pesos e arredondamento', () => {
  test('obrigatório pesa 3 e desejável pesa 1', () => {
    const card = cardOf([cardTerm('Java', ['skills'])]);
    assert.equal(computeMatch(card, [listed('Java'), listed('AWS', 'preferred')]).score, 75);
    assert.equal(computeMatch(card, [listed('Java', 'preferred'), listed('AWS')]).score, 25);
  });

  test('72,5 vira 73, mesmo quando o ponto flutuante diria 72,49999', () => {
    // 3 × 0,6 em ponto flutuante é 1,7999999999999998. Exato: (1,8 + 3 + 1) ÷ 8 = 72,5.
    const card = cardOf([cardTerm('Java', ['experience'], 36), cardTerm('Spring Boot', ['skills']), cardTerm('AWS', ['skills'])]);
    const match = computeMatch(card, [listed('Java', 'required', 5), listed('Spring Boot'), listed('AWS', 'preferred'), language('Inglês', 'preferred')]);
    assert.equal(match.score, 73);
  });

  test('62,5 vira 63, e 37,5 vira 38', () => {
    const half = cardOf([cardTerm('Java', ['about']), cardTerm('AWS', ['skills'])]);
    assert.equal(computeMatch(half, [listed('Java'), listed('AWS', 'preferred')]).score, 63);
    const low = cardOf([cardTerm('Java', ['about'])]);
    assert.equal(computeMatch(low, [listed('Java'), listed('AWS', 'preferred')]).score, 38);
  });

  test('confere contra a conta em inteiros, para todos os meses e anos mínimos', () => {
    for (let minYears = 1; minYears <= 10; minYears++) {
      for (let months = 0; months <= 130; months++) {
        const card = cardOf([cardTerm('Java', ['experience'], months), cardTerm('Spring Boot', ['skills']), cardTerm('AWS', ['skills'])]);
        const { score } = computeMatch(card, [listed('Java', 'required', minYears), listed('Spring Boot'), listed('AWS', 'preferred'), language('Inglês', 'preferred')]);
        // (3 × min(m, 12N) ÷ 12N + 3 + 1) ÷ 8 × 100, com denominador comum, e meio para cima.
        const needed = 12 * minYears;
        const num = 100 * (3 * Math.min(months, needed) + 4 * needed);
        const den = 8 * needed;
        const doubled = 2 * num + den;
        const expected = (doubled - (doubled % (2 * den))) / (2 * den);
        assert.equal(score, expected, `${months} meses, ${minYears} anos`);
      }
    }
  });
});

describe('Faixas', () => {
  const requirements = (count: number) => Array.from({ length: count }, (_, index) => listed(`Termo${index}`, 'preferred'));

  test('Forte: 75 exatos e nenhum obrigatório na vaga', () => {
    const card = cardOf([], { searchedFreeTerms: ['termo0', 'termo1', 'termo2', 'termo3'], terms: ['termo0', 'termo1', 'termo2'].map((key) => cardTerm(key, ['skills'])) });
    const match = computeMatch(card, requirements(4));
    assert.equal(match.score, 75);
    assert.equal(match.band, 'strong');
  });

  test('Forte: nota alta e todos os obrigatórios atendidos', () => {
    const match = computeMatch(cardOf([cardTerm('Java', ['skills'])]), [listed('Java')]);
    assert.equal(match.score, 100);
    assert.equal(match.band, 'strong');
  });

  test('Parcial: nota alta com obrigatório pendente', () => {
    const terms = [cardTerm('Java', ['experience'], 57), cardTerm('Spring Boot', ['skills']), cardTerm('AWS', ['skills'])];
    const match = computeMatch(cardOf(terms), [listed('Java', 'required', 5), listed('Spring Boot'), listed('AWS', 'preferred')]);
    assert.ok(match.score >= 75, `nota ${match.score}`);
    assert.equal(match.band, 'partial');
  });

  test('Parcial: 74 com todos os obrigatórios atendidos', () => {
    const preferred = [listed('Java', 'preferred', 10)];
    const match = computeMatch(cardOf([cardTerm('Java', ['experience'], 89)]), preferred);
    assert.equal(match.score, 74);
    assert.equal(match.band, 'partial');
  });

  test('Parcial: 50 exatos', () => {
    const card = cardOf([cardTerm('Java', ['experience'], 60)]);
    const match = computeMatch(card, [listed('Java', 'preferred', 10)]);
    assert.equal(match.score, 50);
    assert.equal(match.band, 'partial');
  });

  test('Fraco: 49', () => {
    const card = cardOf([cardTerm('Java', ['experience'], 59)]);
    const match = computeMatch(card, [listed('Java', 'preferred', 10)]);
    assert.equal(match.score, 49);
    assert.equal(match.band, 'weak');
  });

  test('Fraco: nota baixa mesmo com todos os obrigatórios atendidos', () => {
    const match = computeMatch(cardOf([cardTerm('Java', ['skills'])]), [listed('Java'), ...['AWS', 'Docker', 'Rust', 'Python'].map((name) => listed(name, 'preferred'))]);
    assert.equal(match.score, 43);
    assert.equal(match.requiredMet, match.requiredTotal);
    assert.equal(match.band, 'weak');
  });
});

describe('RF-55: termo novo não pesa até nova análise', () => {
  const card = cardOf([cardTerm('Java', ['skills'])], { searchedFreeTerms: [] });

  test('termo livre não procurado fica needs_reanalysis e fora da conta', () => {
    const before = computeMatch(card, [listed('Java'), listed('AWS', 'preferred')]);
    const after = computeMatch(card, [listed('Java'), listed('AWS', 'preferred'), free('core banking')]);
    assert.equal(after.results[2]?.status, 'needs_reanalysis');
    assert.equal(after.results[2]?.credit, 0);
    assert.deepEqual(after.results[2]?.evidence, []);
    assert.equal(after.score, before.score);
    assert.equal(before.band, 'strong');
    assert.equal(after.band, 'partial'); // O obrigatório pendente tira de Forte (Apêndice A).
    assert.equal(after.requiredTotal, before.requiredTotal);
    assert.equal(after.requiredMet, before.requiredMet);
  });

  test('palavra de cargo não procurada também', () => {
    const after = computeMatch(card, [listed('Java'), titleWord('Sênior')]);
    assert.equal(after.results[1]?.status, 'needs_reanalysis');
    assert.equal(after.score, 100);
    assert.equal(after.requiredTotal, 1);
  });

  test('termo da lista está sempre avaliado: ausente é não encontrado', () => {
    const after = computeMatch(card, [listed('Java'), listed('Kubernetes')]);
    assert.equal(after.results[1]?.status, 'not_found');
    assert.equal(after.score, 50);
    assert.equal(after.requiredTotal, 2);
  });

  test('termo livre procurado e não achado é não encontrado, e pesa', () => {
    const searched = cardOf([cardTerm('Java', ['skills'])], { searchedFreeTerms: ['core banking'] });
    const after = computeMatch(searched, [listed('Java'), free('core banking')]);
    assert.equal(after.results[1]?.status, 'not_found');
    assert.equal(after.score, 50);
  });

  test('requisito sem nenhuma palavra nunca conta nem pesa', () => {
    const after = computeMatch(card, [listed('Java'), free('++')]);
    assert.equal(after.results[1]?.status, 'needs_reanalysis');
    assert.equal(after.score, 100);
  });

  test('nenhum requisito avaliável: 0, Fraco e requiredTotal 0', () => {
    for (const requirements of [[], [free('core banking')], [titleWord('Sênior')]]) {
      const match = computeMatch(cardOf([]), requirements);
      assert.equal(match.score, 0);
      assert.equal(match.band, 'weak');
      assert.equal(match.requiredTotal, 0);
      assert.equal(match.requiredMet, 0);
      assert.equal(match.results.length, requirements.length);
    }
  });
});

describe('RF-51: a prova de cada resultado', () => {
  const term = cardTerm('Java', ['about', 'experience', 'skills'], 48, ['Desenvolvedora Sênior', 'Analista']);

  test('uma evidência por seção, com cargo e tempo só em experiência', () => {
    const { evidence } = only(computeMatch(cardOf([term]), [listed('Java')]).results);
    assert.deepEqual(evidence, [
      { section: 'about', term: 'Java', jobTitles: [], months: null },
      { section: 'experience', term: 'Java', jobTitles: ['Desenvolvedora Sênior', 'Analista'], months: 48 },
      { section: 'skills', term: 'Java', jobTitles: [], months: null },
    ]);
  });

  test('o termo da prova é o nome da lista, ou o texto do requisito em termo livre', () => {
    const synonym = { ...listed('Java'), label: 'java se' };
    assert.equal(only(computeMatch(cardOf([term]), [synonym]).results).evidence[0]?.term, 'Java');
    const card = cardOf([cardTerm('core banking', ['about'])], { searchedFreeTerms: ['core banking'] });
    assert.equal(only(computeMatch(card, [free('Core Banking')]).results).evidence[0]?.term, 'Core Banking');
  });

  test('experiência total mostra os meses medidos', () => {
    const { evidence } = only(computeMatch(cardOf([], { totalMonths: 60 }), [totalYears(4)]).results);
    assert.deepEqual(evidence, [{ section: 'experience', term: 'Experiência total', jobTitles: [], months: 60 }]);
  });

  test('resultados saem na ordem dos requisitos', () => {
    const { results } = computeMatch(cardOf([term]), [listed('AWS'), listed('Java'), totalYears(1)]);
    assert.deepEqual(results.map((result) => result.requirementId), ['AWS', 'Java', 'total']);
  });
});

describe('Pendência nas faixas (Apêndice A, RF-55)', () => {
  const card = cardOf([cardTerm('Java', ['skills'])]);

  test('obrigatório pendente: a faixa não pode ser Forte, e a nota não muda', () => {
    const match = computeMatch(card, [listed('Java'), free('core banking')]);
    assert.equal(match.score, 100);
    assert.equal(match.band, 'partial');
    assert.equal(match.requiredMet, 1);
    assert.equal(match.requiredTotal, 1);
  });

  test('palavra de cargo obrigatória pendente também', () => {
    assert.equal(computeMatch(card, [listed('Java'), titleWord('Sênior')]).band, 'partial');
  });

  test('desejável pendente não tira de Forte', () => {
    assert.equal(computeMatch(card, [listed('Java'), free('core banking', 'preferred')]).band, 'strong');
  });

  test('depois da nova análise, volta a poder ser Forte', () => {
    const searched = cardOf([cardTerm('Java', ['skills']), cardTerm('core banking', ['skills'])], { searchedFreeTerms: ['core banking'] });
    assert.equal(computeMatch(searched, [listed('Java'), free('core banking')]).band, 'strong');
  });

  test('nota baixa com pendência continua Fraco', () => {
    assert.equal(computeMatch(cardOf([]), [listed('Java'), free('core banking')]).band, 'weak');
  });
});

describe('isScored: há nota, ou a tela diz "sem nota"', () => {
  test('sem requisitos, sem nota', () => {
    assert.equal(isScored(computeMatch(cardOf([]), [])), false);
  });

  test('só requisito pendente, sem nota', () => {
    assert.equal(isScored(computeMatch(cardOf([]), [free('core banking')])), false);
    assert.equal(isScored(computeMatch(cardOf([]), [titleWord('Sênior'), free('x', 'preferred')])), false);
  });

  test('um avaliado basta, mesmo com crédito 0', () => {
    assert.equal(isScored(computeMatch(cardOf([]), [listed('Java')])), true);
    assert.equal(isScored(computeMatch(cardOf([]), [listed('Java'), free('core banking')])), true);
  });

  test('experiência total sem datas também foi avaliada', () => {
    assert.equal(isScored(computeMatch(cardOf([]), [totalYears(3)])), true);
  });
});
