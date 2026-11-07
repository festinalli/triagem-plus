// Origem: Candidata+, marco onda-4, src/core/time/union.ts, sem mudança de comportamento.
import { monthIndex } from './year-month.ts';
import type { MonthSpan, YearMonth } from './types.ts';

/**
 * Quantidade de meses cobertos pela união dos intervalos, contando cada mês uma só vez.
 * Intervalos em aberto (`end` nulo) terminam em `asOf`, que é injetado: esta função não lê o relógio.
 * Intervalos que começam depois de `asOf` ou que terminam antes do início não contribuem.
 */
export function unionMonths(spans: readonly MonthSpan[], asOf: YearMonth): number {
  const limit = monthIndex(asOf);
  const ranges: Array<[number, number]> = [];
  for (const span of spans) {
    const start = monthIndex(span.start);
    const end = Math.min(span.end === null ? limit : monthIndex(span.end), limit);
    if (end < start) continue;
    ranges.push([start, end]);
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let total = 0;
  let curStart = NaN;
  let curEnd = NaN;
  for (const [start, end] of ranges) {
    if (Number.isNaN(curEnd) || start > curEnd + 1) {
      if (!Number.isNaN(curEnd)) total += curEnd - curStart + 1;
      curStart = start;
      curEnd = end;
    } else if (end > curEnd) {
      curEnd = end;
    }
  }
  if (!Number.isNaN(curEnd)) total += curEnd - curStart + 1;
  return total;
}
