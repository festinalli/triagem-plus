// Nomes de lugar usados só para reconhecer uma linha de local e jogá-la fora (RF-44, DP-06). Nenhum lugar é guardado.
// A lista é pequena de propósito: ela cobre o caso comum, e não precisa ser completa para a regra funcionar.

/** Estados do Brasil e países prováveis, já passados por `normalize`. */
export const STATES_AND_COUNTRIES: ReadonlySet<string> = new Set([
  'acre', 'alagoas', 'amapa', 'amazonas', 'bahia', 'ceara', 'distrito federal', 'espirito santo', 'goias', 'maranhao',
  'mato grosso', 'mato grosso do sul', 'minas gerais', 'para', 'paraiba', 'parana', 'pernambuco', 'piaui', 'rio de janeiro',
  'rio grande do norte', 'rio grande do sul', 'rondonia', 'roraima', 'santa catarina', 'sao paulo', 'sergipe', 'tocantins',
  'brasil', 'brazil', 'portugal', 'estados unidos', 'united states',
]);

/** Siglas das unidades da federação, em maiúsculas. Em minúsculas, "Go" é a linguagem. */
export const BRAZILIAN_STATE_CODES: ReadonlySet<string> = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

// Cidades de mais de uma palavra têm a mesma forma de um nome de pessoa. Só as prováveis: o resto é limite conhecido.
const MULTI_WORD_CITIES: ReadonlySet<string> = new Set([
  'belo horizonte', 'porto alegre', 'campo grande', 'joao pessoa', 'porto velho', 'boa vista', 'rio branco', 'sao luis',
  'sao jose dos campos', 'sao bernardo do campo', 'santo andre', 'ribeirao preto', 'nova york', 'new york', 'san francisco',
]);

// Só as que não costumam ser sobrenome. "Salvador", "Natal" e "Fortaleza" ficam de fora.
const SINGLE_WORD_CITIES: ReadonlySet<string> = new Set([
  'campinas', 'curitiba', 'recife', 'manaus', 'goiania', 'florianopolis', 'sorocaba', 'londrina', 'joinville', 'uberlandia', 'niteroi', 'guarulhos', 'osasco',
]);

/** O texto inteiro, já passado por `normalize`, é um lugar conhecido. */
export function isKnownPlace(key: string): boolean {
  return STATES_AND_COUNTRIES.has(key) || MULTI_WORD_CITIES.has(key) || SINGLE_WORD_CITIES.has(key);
}
