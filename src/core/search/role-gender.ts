// As duas formas de gênero de um cargo no texto de busca (RD-8). Sem isso, "Engenheiro de dados" só acha quem escreveu no
// masculino, e o gênero da palavra escolhe quem aparece. A tabela de palavras é a mesma da nota (match/gender.ts): uma forma só
// é aceita aqui se aquela tabela a dobra de volta, então as duas listas não têm como divergir.
import { foldRoleWords } from '../match/gender.ts';

const WORD = /[\p{L}\p{M}]+/gu;

function plain(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function sameWord(a: string, b: string): boolean {
  return plain(a) === plain(b);
}

function matchCase(from: string, to: string): string {
  return from.charAt(0) === from.charAt(0).toUpperCase() ? to.charAt(0).toUpperCase() + to.slice(1) : to;
}

function feminineOf(word: string): string {
  const lower = word.toLowerCase();
  const candidate = lower.endsWith('or') ? `${word}a` : lower.endsWith('o') ? `${word.slice(0, -1)}a` : word;
  return candidate !== word && sameWord(foldRoleWords(candidate), word) ? candidate : word;
}

function masculineOf(word: string): string {
  const folded = foldRoleWords(word);
  if (sameWord(folded, word)) return word;
  const lower = word.toLowerCase();
  const candidate = lower.endsWith('ora') ? word.slice(0, -1) : lower.endsWith('a') ? `${word.slice(0, -1)}o` : word;
  return sameWord(candidate, folded) ? candidate : matchCase(word, folded);
}

/** O nome com toda palavra de cargo no masculino: serve também de identidade, para as duas formas contarem como o mesmo cargo. */
export function masculineRole(name: string): string {
  return name.replace(WORD, masculineOf);
}

/** [masculino, feminino] quando o cargo muda com o gênero, com acento e maiúscula como escritos. Senão, só o nome como veio. */
export function roleForms(name: string): readonly string[] {
  const masculine = masculineRole(name);
  const feminine = masculine.replace(WORD, feminineOf);
  return feminine === masculine ? [name] : [masculine, feminine];
}

// Adjetivos da tabela: "Técnica de vendas" e "Suporte técnico" não são cargo por causa deles.
const ADJECTIVES: ReadonlySet<string> = new Set(['tecnico', 'tecnica', 'pleno', 'plena']);

/** Termo livre que começa pela palavra de um cargo: "Fundadora", "Engenheira de Plataforma". */
export function startsWithRoleWord(name: string): boolean {
  const first = name.match(WORD)?.[0];
  if (first === undefined || ADJECTIVES.has(plain(first))) return false;
  return !sameWord(foldRoleWords(first), first) || feminineOf(first) !== first;
}
