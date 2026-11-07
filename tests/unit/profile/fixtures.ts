import { readFileSync } from 'node:fs';
import type { YearMonth } from '../../../src/core/time/types.ts';

/** Mês de referência dos testes. Todos os perfis são inventados, e os meses esperados são contados a partir daqui. */
export const AS_OF: YearMonth = { year: 2024, month: 10 };

export function fixture(name: string): string {
  return readFileSync(new URL(`../../fixtures/profiles/${name}.txt`, import.meta.url), 'utf8');
}
