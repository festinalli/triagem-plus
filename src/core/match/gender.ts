// Flexão de gênero das palavras de cargo (RD-8). Sem isto, uma vaga que pede "Engenheiro" não acharia "Engenheira de Plataforma",
// e o gênero da palavra mudaria a nota. Nada é deduzido da pessoa: as formas viram uma só na hora de comparar, de quem procura e
// de onde se procura. A ficha guarda o rótulo neutro da lista fechada (DP-23), e nenhuma destas formas.
//
// Há dois níveis. Termo livre usa a tabela, palavra por palavra, porque ali uma regra de sufixo confundiria "Banco" com "Banca".
// Palavra de cargo usa a regra de sufixo, porque só é comparada com a linha do cargo, e nenhuma tabela cobre todos os cargos. Os
// termos da lista trazem as duas formas no próprio dicionário, e há teste.
import { NEUTRAL_WORDS, foldNeutralSpelling } from '../profile/work-titles.ts';

const MASCULINE: ReadonlyMap<string, string> = new Map([
  ['desenvolvedora', 'desenvolvedor'],
  ['engenheira', 'engenheiro'],
  ['arquiteta', 'arquiteto'],
  ['programadora', 'programador'],
  ['consultora', 'consultor'],
  ['coordenadora', 'coordenador'],
  ['diretora', 'diretor'],
  ['supervisora', 'supervisor'],
  ['administradora', 'administrador'],
  ['estagiaria', 'estagiario'],
  ['pesquisadora', 'pesquisador'],
  ['professora', 'professor'],
  ['instrutora', 'instrutor'],
  ['gestora', 'gestor'],
  ['gerenta', 'gerente'],
  ['recrutadora', 'recrutador'],
  ['fundadora', 'fundador'],
  ['cofundadora', 'cofundador'],
  ['mentora', 'mentor'],
  ['socia', 'socio'],
  ['plena', 'pleno'],
  ['tecnica', 'tecnico'],
  ['tecnologa', 'tecnologo'],
  ['mestra', 'mestre'],
  ['auditora', 'auditor'],
  ['testadora', 'testador'],
  ['autonoma', 'autonomo'],
]);

const WORD = /[\p{L}\p{M}]+/gu;

function unaccented(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Para termo livre: só as palavras da tabela e as formas neutras. O resto fica como está. */
export function foldRoleWords(text: string): string {
  return foldNeutralSpelling(text).replace(WORD, (word) => {
    const key = unaccented(word);
    return MASCULINE.get(key) ?? NEUTRAL_WORDS.get(key) ?? word;
  });
}

/** Só as exceções. O resto sai da regra de sufixo em masculineOf. */
const IRREGULAR: ReadonlyMap<string, string> = new Map([
  ['gerenta', 'gerente'],
  ['presidenta', 'presidente'],
  ['governanta', 'governante'],
  ['chefa', 'chefe'],
  ['mestra', 'mestre'],
  ['bacharela', 'bacharel'],
  ['juiza', 'juiz'],
  ['aprendiza', 'aprendiz'],
  ['oficiala', 'oficial'],
  ['atriz', 'ator'],
]);

const MIN_LENGTH_FOR_ORA = 5;
const MIN_LENGTH_FOR_A = 4;

/**
 * -a/-o, -eira/-eiro e -óloga/-ólogo saem da mesma regra. -ora/-or, -ã/-ão e -ona/-ão têm a sua. Palavra sem flexão, como "Analista",
 * também muda, mas igual dos dois lados, e por isso não atrapalha.
 */
function masculineOf(word: string): string {
  const key = unaccented(word);
  const known = IRREGULAR.get(key) ?? NEUTRAL_WORDS.get(key);
  if (known !== undefined) return known;
  if (word.normalize('NFC').toLowerCase().endsWith('ã')) return key.slice(0, -1) + 'ao';
  if (key.length >= MIN_LENGTH_FOR_ORA && key.endsWith('ona')) return key.slice(0, -3) + 'ao';
  if (key.length >= MIN_LENGTH_FOR_ORA && key.endsWith('ora')) return key.slice(0, -1);
  if (key.length >= MIN_LENGTH_FOR_A && key.endsWith('a')) return key.slice(0, -1) + 'o';
  return key;
}

/** Para palavra de cargo: a regra de sufixo em todas as palavras. Serve só para comparar, nunca para mostrar. */
export function foldTitleWords(text: string): string {
  return foldNeutralSpelling(text).replace(WORD, masculineOf);
}
