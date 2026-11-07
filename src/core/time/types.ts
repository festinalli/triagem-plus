// Origem: Candidata+, marco onda-4, src/core/time/types.ts, sem o tipo de experiência daquele perfil.
// Tipos de tempo do núcleo. Tudo é mês inteiro: o produto trabalha com anos e meses, nunca com instantes.
// Não há relógio aqui; quem precisa de "agora" recebe `asOf` por parâmetro.

/** Mês do calendário gregoriano. `month` vai de 1 (janeiro) a 12 (dezembro). */
export interface YearMonth {
  readonly year: number;
  readonly month: number;
}

/**
 * Intervalo de meses, inclusivo nas duas pontas. `end` nulo significa "até o mês de referência"
 * (`asOf`), usado para o emprego atual.
 */
export interface MonthSpan {
  readonly start: YearMonth;
  readonly end: YearMonth | null;
}

export type DateErrorCode =
  | 'date_empty'
  | 'date_unrecognized'
  | 'date_range_reversed';

export interface DateError {
  readonly ok: false;
  readonly code: DateErrorCode;
}
