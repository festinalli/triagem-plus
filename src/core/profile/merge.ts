// Soma de textos da mesma pessoa e reconhecimento do perfil pelo endereço (RF-34).
import { MAX_INPUT_CHARS, clipProfileText, toLines } from './lines.ts';
import { readNameFromLines } from './name.ts';
import { titleRole } from './sections.ts';

/**
 * Junta um texto novo ao que já havia, de forma que o leitor reconheça as seções do texto novo.
 *
 * O cabeçalho do texto novo sai: tudo antes do primeiro título. Sem isso, nome, cargo e cidade do topo da segunda página
 * cairiam dentro da última seção do texto anterior e chegariam a um campo, o que RF-44 proíbe. O nome só é aproveitado se
 * o texto anterior não tinha nenhum, como quando a primeira leitura foi a página "ver todas as competências".
 *
 * Texto novo sem nenhum título de seção não tem onde entrar, e o resultado é `previous`, sem mudança. Quem chama pode
 * comparar os dois para avisar que nada foi somado. O mesmo vale para um trecho que já está no texto, então repetir o
 * gesto na mesma página não muda nada. O total respeita o limite bruto, e o texto mais antigo tem preferência. O limite do
 * que conta fica com o leitor, que sabe o que é seção ignorada.
 */
export function mergeProfileText(previous: string, added: string): string {
  const before = clipProfileText(previous);
  const addedLines = toLines(added);
  if (before.trim() === '') return addedLines.join('\n');

  const firstTitle = addedLines.findIndex((line) => line !== '' && titleRole(line) !== null);
  if (firstTitle === -1) return before;

  const body = addedLines.slice(firstTitle).join('\n').trimEnd();
  const beforeLines = toLines(before);
  if (`\n${beforeLines.join('\n')}\n`.includes(`\n${body}\n`)) return before;

  const missingName = readNameFromLines(beforeLines) === null ? readNameFromLines(addedLines) : null;
  const merged = `${missingName === null ? '' : `${missingName}\n`}${before.trimEnd()}\n\n${body}`;
  return merged.slice(0, MAX_INPUT_CHARS);
}

const MAX_URL_CHARS = 2048;
// Sem a classe URL, que não existe no núcleo. O domínio vem logo depois do esquema e seguido de "/in/", o que recusa
// "linkedin.com.exemplo.test", "linkedin.com@exemplo.test", porta e "http:". Aceita subdomínio curto, como "www" e "br".
const PROFILE_URL = /^https:\/\/(?:[a-z]{1,3}\.)?linkedin\.com\/in\/([^/?#]+)(?:[/?#].*)?$/i;
const VALID_SLUG = /^[\p{L}\p{M}\p{N}._~-]+$/u;
const SLUG_HAS_WORD = /[\p{L}\p{N}]/u;

/** O trecho "/in/<nome>/" do link, em minúsculas e decodificado. Nulo fora do padrão. Reconhece o mesmo perfil (RF-34). */
export function profileKeyOf(url: string): string | null {
  if (typeof url !== 'string' || url.length > MAX_URL_CHARS) return null;
  const encoded = PROFILE_URL.exec(url.trim())?.[1];
  if (encoded === undefined) return null;

  let slug: string;
  try {
    slug = decodeURIComponent(encoded);
  } catch {
    return null; // Sequência de escape inválida, como "%E0%A4%A".
  }
  // A checagem depois de decodificar recusa barra escondida ("%2F"), espaço e "..".
  if (!VALID_SLUG.test(slug) || !SLUG_HAS_WORD.test(slug)) return null;
  return `/in/${slug.normalize('NFC').toLowerCase()}/`;
}

/**
 * O link limpo do perfil, https://www.linkedin.com/in/<nome>/, sem o que vem depois do nome ("/details/skills/", "?lipi=...").
 * Nulo quando o link não é de perfil do LinkedIn: nesse caso quem chama guarda o link como veio.
 */
export function canonicalProfileUrl(url: string): string | null {
  if (profileKeyOf(url) === null) return null;
  const encoded = PROFILE_URL.exec(url.trim())?.[1];
  return encoded === undefined ? null : `https://www.linkedin.com/in/${encoded}/`;
}
