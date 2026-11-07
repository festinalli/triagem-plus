// Origem: Candidata+, marco onda-4, src/core/time/year-month.ts, só com o que o leitor de perfil usa.
import type { YearMonth } from './types.ts';

const MONTHS_PER_YEAR = 12;
const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

/** Ano aceito pelo módulo: inteiro de quatro dígitos (1000 a 9999). Única regra de faixa de ano. */
export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/** Constrói um mês validado. Devolve nulo se o ano ou o mês estiver fora do intervalo. */
export function makeYearMonth(year: number, month: number): YearMonth | null {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (!isValidYear(year)) return null;
  if (month < 1 || month > MONTHS_PER_YEAR) return null;
  return { year, month };
}

/** Índice linear do mês (ano * 12 + mês - 1). Permite somar e comparar meses com aritmética simples. */
export function monthIndex(ym: YearMonth): number {
  return ym.year * MONTHS_PER_YEAR + (ym.month - 1);
}

/** Compara dois meses: negativo se `a` é anterior, zero se iguais, positivo se posterior. */
export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return monthIndex(a) - monthIndex(b);
}
