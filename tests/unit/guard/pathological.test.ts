// Entrada patológica não pode travar a tela. O cabeçalho da trava promete custo linear, e aqui isso é medido.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTerm, findForbidden, MAX_GUARD_CHARS } from '../../../src/core/guard/index.ts';
import { prepareYears } from '../../../src/core/guard/years.ts';
import { extractRequirements } from '../../../src/core/job/extract.ts';
import { makeRequirement } from '../../../src/core/job/requirements.ts';
import { buildSearch, peopleSearchUrl } from '../../../src/core/search/build.ts';

const LIMIT_MS = 200;
const N = 400_000;

const PATHOLOGICAL: Readonly<Record<string, string>> = {
  'decimal e 400 mil espaços': `3,5${' '.repeat(N)}`,
  'decimal, espaços e fim': `1,1${' '.repeat(N)}x`,
  'faixa e 400 mil espaços': `1-1${' '.repeat(N)}x`,
  'decimal e 400 mil tabulações': `5,5${'\t'.repeat(N)}x`,
  'decimal, espaços e mais': `1,1${' '.repeat(N)}+${' '.repeat(N)}x`,
  'faixa com espaços dos dois lados': `1${' '.repeat(N)}-${' '.repeat(N)}1`,
  'decimais repetidos': `1,1${' '.repeat(5000)}`.repeat(200),
  'faixas repetidas': `1${' '.repeat(5000)}-`.repeat(200),
  'um milhão de letras': 'a'.repeat(1_000_000),
  'um milhão de espaços': ' '.repeat(1_000_000),
  'um milhão de quebras': '\n'.repeat(1_000_000),
  'letra e quebra': 'a\n'.repeat(500_000),
  'letra e espaço': 'a '.repeat(500_000),
  'um milhão de dígitos': '1'.repeat(1_000_000),
  'dígito e espaço': '1 '.repeat(500_000),
  'um milhão de sinais': '!'.repeat(1_000_000),
  'letra e sinal': 'a!'.repeat(500_000),
  'corridas de sinais': `a${'!'.repeat(1000)} `.repeat(1000),
  'anos repetidos': '5 anos '.repeat(142_857),
  'teto repetido': 'até 5 anos '.repeat(90_909),
  'C++ repetido': 'C++ '.repeat(250_000),
  'parênteses': '('.repeat(1_000_000),
  'parênteses e letra': '(a'.repeat(500_000),
  'asteriscos': '*'.repeat(1_000_000),
  negrito: '**a'.repeat(333_333),
  'caractere substituto': '\uD800'.repeat(1_000_000),
  combinantes: `a${'́'.repeat(1_000_000)}`,
  'muitas frases': 'a. '.repeat(333_333),
  'muitas frases proibidas': 'mulheres. '.repeat(100_000),
};

const FUNCTIONS: Readonly<Record<string, (text: string) => unknown>> = {
  checkTerm: (text) => checkTerm(text),
  findForbidden: (text) => findForbidden(text),
  makeRequirement: (text) => makeRequirement({ kind: 'term', label: text, importance: 'required' }),
  extractRequirements: (text) => extractRequirements(text),
  'buildSearch, excluído': (text) => buildSearch({ requirements: [], excludedTerms: [text] }),
  'buildSearch, requisito': (text) => buildSearch({ requirements: [{ id: 'x', kind: 'term', importance: 'required', label: text }], excludedTerms: [] }),
  peopleSearchUrl: (text) => peopleSearchUrl(text),
};

// A melhor de três medições: mede o custo do código, não um pico de outro processo na máquina.
function elapsed(run: () => unknown): number {
  let best = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 3 && best >= LIMIT_MS; attempt++) {
    const start = performance.now();
    run();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

describe('entradas patológicas: toda função pública em menos de 200 ms', () => {
  for (const [name, run] of Object.entries(FUNCTIONS)) {
    test(name, () => {
      const slow = Object.entries(PATHOLOGICAL).flatMap(([shape, text]) => {
        const ms = elapsed(() => run(text));
        return ms < LIMIT_MS ? [] : [`${shape}: ${ms.toFixed(0)} ms`];
      });
      assert.deepEqual(slow, []);
    });
  }

  test('prepareYears, que roda dentro das outras', () => {
    for (const text of ['3,5', '1-1', '5,5']) {
      const ms = elapsed(() => prepareYears(`${text}${' '.repeat(N)}`));
      assert.ok(ms < LIMIT_MS, `${text}: ${ms.toFixed(0)} ms`);
    }
  });
});

describe('o limite de tamanho não abre brecha', () => {
  test('espaço demais não esconde o termo proibido', () => {
    const padded = `Java${' '.repeat(MAX_GUARD_CHARS + 10)}mulheres`;
    assert.equal(checkTerm(padded).allowed, false);
    assert.deepEqual(findForbidden(padded).map((hit) => hit.topic), ['gender']);
    assert.deepEqual(findForbidden(`Java${'\n'.repeat(MAX_GUARD_CHARS + 10)}mulheres`).map((hit) => hit.topic), ['gender']);
  });

  test('os anos seguem lidos com os espaços colapsados', () => {
    assert.equal(checkTerm(`até 3,5${' '.repeat(N)}anos`).allowed, false);
    assert.equal(checkTerm(`25  -  35${' '.repeat(N)}anos`).allowed, false);
    assert.equal(findForbidden(`até 3,5 ${' '.repeat(N)} + ${' '.repeat(N)} anos`).length, 1);
  });

  test('o começo do texto é lido até o limite documentado', () => {
    assert.equal(MAX_GUARD_CHARS, 100_000);
    assert.equal(checkTerm(`mulheres ${'a '.repeat(MAX_GUARD_CHARS)}`).allowed, false);
    assert.deepEqual(checkTerm(`${'a '.repeat(MAX_GUARD_CHARS)}mulheres`), { allowed: true });
  });

  test('requisito longo demais é recusado, com o motivo, em vez de passar sem ser lido', () => {
    const label = `${'a '.repeat(MAX_GUARD_CHARS)}mulheres`;
    const result = makeRequirement({ kind: 'term', label, importance: 'required' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'too_long');
      assert.ok(result.reason.length > 0);
    }
  });
});
