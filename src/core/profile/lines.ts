// Corte do texto em linhas limpas. Tudo no leitor trabalha sobre estas linhas.

/**
 * Limite bruto da entrada, em caracteres. O que passa disso nem é lido, e o resultado sai com `truncated`. É o que mantém a
 * leitura sem travar com qualquer entrada e a memória da sessão limitada quando textos são somados (RF-34).
 */
export const MAX_INPUT_CHARS = 1_000_000;

/**
 * Limite do texto das seções que contam. Um perfil inteiro, somado às páginas de "ver tudo", cabe com folga. Seção ignorada
 * e cabeçalho não gastam este limite: se gastassem, uma lista longa de recomendações cortaria as competências e mudaria a
 * nota (RF-57). O que passa disso é cortado (o começo fica) e o resultado sai com `truncated`.
 */
export const MAX_PROFILE_CHARS = 100_000;

/**
 * Linha acima disto não é título, período, cargo, nome, local nem aviso da página, e nenhuma expressão regular de
 * reconhecimento roda sobre ela. Garante tempo linear mesmo com uma linha enorme.
 */
export const MAX_SHORT_LINE = 160;

// Hífen discreto, espaços de largura zero, marcas de direção, seletores de variação e BOM.
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFE00-\uFE0F\uFEFF]/gu;
const LINE_BREAK = /\r\n|[\n\r\v\f\u0085\u2028\u2029]/u;

/** Entrada de qualquer tipo vira texto dentro do limite. O leitor nunca lança erro por causa da entrada. */
export function clipProfileText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
}

function cleanLine(raw: string): string {
  return raw.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/gu, ' ').trim();
}

/** Linhas sem espaço sobrando, em NFC. Linha em branco vira texto vazio, e a posição dela é mantida. */
export function toLines(text: unknown): string[] {
  return clipProfileText(text).split(LINE_BREAK).map(cleanLine);
}
