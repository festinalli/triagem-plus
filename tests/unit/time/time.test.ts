import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateRange, parseDateText } from '../../../src/core/time/parse-date.ts';
import { unionMonths } from '../../../src/core/time/union.ts';
import { compareYearMonth, makeYearMonth, monthIndex } from '../../../src/core/time/year-month.ts';

const AS_OF = { year: 2024, month: 10 };

describe('parseDateRange: as formas previstas no perfil', () => {
  const cases: ReadonlyArray<readonly [string, string, unknown]> = [
    ['jan de 2020', 'o momento', { start: { year: 2020, month: 1 }, end: null, current: true }],
    ['jan 2020', 'atual', { start: { year: 2020, month: 1 }, end: null, current: true }],
    ['Jan 2020', 'Present', { start: { year: 2020, month: 1 }, end: null, current: true }],
    ['2019', '2021', { start: { year: 2019, month: 1 }, end: { year: 2021, month: 12 }, current: false }],
    ['set de 2018', 'mar de 2020', { start: { year: 2018, month: 9 }, end: { year: 2020, month: 3 }, current: false }],
  ];
  for (const [start, end, expected] of cases) {
    test(`"${start} - ${end}"`, () => {
      assert.deepEqual(parseDateRange(start, end), { ok: true, ...(expected as object) });
    });
  }

  test('fim antes do início é recusado', () => {
    assert.deepEqual(parseDateRange('mar de 2021', 'jan de 2020'), { ok: false, code: 'date_range_reversed' });
  });

  test('"o momento" só vale no fim', () => {
    assert.equal(parseDateRange('o momento', '2020').ok, false);
  });
});

describe('parseDateText', () => {
  test('todos os meses abreviados em português e inglês', () => {
    const pt = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const en = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    pt.forEach((name, index) => {
      assert.deepEqual(parseDateText(`${name} de 2020`), { ok: true, kind: 'month', value: { year: 2020, month: index + 1 } });
    });
    en.forEach((name, index) => {
      assert.deepEqual(parseDateText(`${name} 2020`), { ok: true, kind: 'month', value: { year: 2020, month: index + 1 } });
    });
  });

  test('acento, ponto e maiúsculas não atrapalham', () => {
    assert.deepEqual(parseDateText('Março de 2021'), { ok: true, kind: 'month', value: { year: 2021, month: 3 } });
    assert.deepEqual(parseDateText('jan. de 2021'), { ok: true, kind: 'month', value: { year: 2021, month: 1 } });
    assert.deepEqual(parseDateText('O MOMENTO'), { ok: true, kind: 'current' });
  });

  test('o que não é data', () => {
    assert.deepEqual(parseDateText(''), { ok: false, code: 'date_empty' });
    assert.deepEqual(parseDateText('foo de 2020'), { ok: false, code: 'date_unrecognized' });
    assert.deepEqual(parseDateText('0999'), { ok: false, code: 'date_unrecognized' });
    assert.deepEqual(parseDateText('13/2020'), { ok: false, code: 'date_unrecognized' });
  });
});

describe('unionMonths', () => {
  const ym = (year: number, month: number) => ({ year, month });

  test('as duas pontas contam', () => {
    assert.equal(unionMonths([{ start: ym(2020, 1), end: ym(2020, 12) }], AS_OF), 12);
    assert.equal(unionMonths([{ start: ym(2020, 3), end: ym(2020, 3) }], AS_OF), 1);
  });

  test('sobreposição não conta duas vezes', () => {
    const spans = [
      { start: ym(2020, 1), end: ym(2020, 12) },
      { start: ym(2020, 7), end: ym(2021, 6) },
    ];
    assert.equal(unionMonths(spans, AS_OF), 18);
  });

  test('intervalo contido em outro e buraco entre intervalos', () => {
    const spans = [
      { start: ym(2020, 1), end: ym(2020, 12) },
      { start: ym(2020, 3), end: ym(2020, 4) },
      { start: ym(2022, 1), end: ym(2022, 2) },
    ];
    assert.equal(unionMonths(spans, AS_OF), 14);
  });

  test('em aberto termina em asOf, e nada passa de asOf', () => {
    assert.equal(unionMonths([{ start: ym(2020, 1), end: null }], AS_OF), 58);
    assert.equal(unionMonths([{ start: ym(2020, 1), end: null }], ym(2020, 1)), 1);
    assert.equal(unionMonths([{ start: ym(2024, 1), end: ym(2030, 1) }], AS_OF), 10);
    assert.equal(unionMonths([{ start: ym(2025, 1), end: null }], AS_OF), 0);
  });

  test('lista vazia', () => {
    assert.equal(unionMonths([], AS_OF), 0);
  });
});

describe('year-month', () => {
  test('makeYearMonth valida', () => {
    assert.deepEqual(makeYearMonth(2020, 12), { year: 2020, month: 12 });
    assert.equal(makeYearMonth(2020, 13), null);
    assert.equal(makeYearMonth(2020, 0), null);
    assert.equal(makeYearMonth(999, 1), null);
    assert.equal(makeYearMonth(2020.5, 1), null);
  });

  test('índice e comparação', () => {
    assert.equal(monthIndex({ year: 2020, month: 2 }) - monthIndex({ year: 2019, month: 12 }), 2);
    assert.ok(compareYearMonth({ year: 2019, month: 12 }, { year: 2020, month: 1 }) < 0);
    assert.equal(compareYearMonth({ year: 2020, month: 1 }, { year: 2020, month: 1 }), 0);
  });
});
