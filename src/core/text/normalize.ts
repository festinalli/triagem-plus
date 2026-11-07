// normalize, versão 1 (especificação, seção 7.11). Função pura e versionada: a chave de busca do banco de
// respostas, as ocultas, a comparação de opções e a aderência usam esta mesma função.
// Mudar o algoritmo exige nova versão e migração a partir do valor original.

export const NORMALIZE_VERSION = 1;

// Hífen, sublinhado, barra, contrabarra e barra vertical viram separador. Entre os hífens estão o hífen-menos
// ASCII e os dois hífens Unicode de nome HYPHEN (U+2010, e U+2011, que o NFKC já leva a U+2010). Travessões
// (–, —) não entram: ver D-F04-2 em docs/slices/F04.md.
const SEPARATORS = /[-_/\\|‐‑]+/gu;
// Qualquer caractere de espaço Unicode (propriedade White_Space, inclusive os não separáveis) vira espaço comum.
// Não usa \s do JavaScript: \s inclui U+FEFF (formato, Cf) e deixa de fora U+0085 (espaço, White_Space).
const SPACES = /\p{White_Space}+/gu;
// Tudo que não é letra (L), dígito (N) ou espaço some.
const NOT_WORD_OR_SPACE = /[^\p{L}\p{N} ]/gu;
const MARKS = /\p{M}/gu;

// Decomposição canônica e remoção das marcas combinantes (categoria M).
function stripMarks(text: string): string {
  return text.normalize('NFD').replace(MARKS, '');
}

export function normalize(input: unknown): string {
  if (typeof input !== 'string') return '';
  let text = stripMarks(input.normalize('NFKC'));
  text = text.toLowerCase();
  // toLowerCase pode reintroduzir uma marca (caso de U+0130); a remoção é repetida por segurança.
  text = stripMarks(text);
  text = text.replace(SEPARATORS, ' ').replace(SPACES, ' ');
  text = text.replace(NOT_WORD_OR_SPACE, '');
  return text.replace(/ +/g, ' ').trim();
}
